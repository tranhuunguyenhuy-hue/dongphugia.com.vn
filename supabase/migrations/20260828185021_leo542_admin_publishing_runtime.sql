-- LEO-542 Phase A: authenticated Admin and Publishing runtime boundary.
-- Non-Production isolated Preview target only. No Production activation.

begin;

do $$
begin
  if not exists (
    select 1 from dpg_control.target_contract
    where singleton
      and project_name = 'dongphugia-runtime'
      and region = 'ap-southeast-1'
      and environment = 'preview'
      and production_writes_allowed is false
  ) then
    raise exception 'LEO542_TARGET_CONTRACT_FAILED';
  end if;
end
$$;

alter table dpg_app.admin_users
  add column if not exists supabase_auth_user_id uuid;
alter table dpg_app.publishing_machine_identities
  add column if not exists supabase_auth_user_id uuid;
alter table dpg_app.products
  add column if not exists version integer not null default 1;
alter table dpg_app.products
  drop constraint if exists products_version_positive;
alter table dpg_app.products
  add constraint products_version_positive check (version >= 1);

alter table dpg_app.audit_logs
  add column if not exists auth_user_id uuid,
  add column if not exists auth_session_id uuid,
  add column if not exists request_id uuid,
  add column if not exists idempotency_key_hash char(64),
  add column if not exists changed_fields text[] not null default array[]::text[];
alter table dpg_app.publishing_audit_events
  add column if not exists auth_user_id uuid,
  add column if not exists auth_session_id uuid;

create unique index if not exists uq_admin_users_supabase_auth_user
  on dpg_app.admin_users (supabase_auth_user_id)
  where supabase_auth_user_id is not null;
create unique index if not exists uq_publishing_identities_supabase_auth_user
  on dpg_app.publishing_machine_identities (supabase_auth_user_id)
  where supabase_auth_user_id is not null;

alter table dpg_app.publishing_idempotency_records enable row level security;
alter table dpg_app.publishing_idempotency_records force row level security;
alter table dpg_app.publishing_rate_limit_windows enable row level security;
alter table dpg_app.publishing_rate_limit_windows force row level security;
alter table dpg_app.publishing_audit_events enable row level security;
alter table dpg_app.publishing_audit_events force row level security;
alter table dpg_app.audit_logs enable row level security;
alter table dpg_app.audit_logs force row level security;

create or replace function dpg_app.leo542_actor_context()
returns table (
  actor_kind text,
  auth_user_id uuid,
  auth_session_id uuid,
  admin_id integer,
  admin_role text,
  machine_identity_id uuid
)
language plpgsql
stable
security definer
set search_path = pg_catalog, dpg_app, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_session uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  v_admin record;
  v_machine record;
begin
  if v_uid is null then raise exception 'UNAUTHORIZED'; end if;

  select a.id, a.role into v_admin
  from dpg_app.admin_users a
  where a.supabase_auth_user_id = v_uid and a.is_active;

  select m.id into v_machine
  from dpg_app.publishing_machine_identities m
  where m.supabase_auth_user_id = v_uid and m.is_active and m.disabled_at is null;

  if v_admin.id is not null and v_machine.id is not null then
    raise exception 'FORBIDDEN_AMBIGUOUS_PRINCIPAL';
  elsif v_admin.id is not null then
    return query select 'admin'::text, v_uid, v_session, v_admin.id::integer, v_admin.role::text, null::uuid;
  elsif v_machine.id is not null then
    return query select 'machine'::text, v_uid, v_session, null::integer, null::text, v_machine.id::uuid;
  end if;

  raise exception 'FORBIDDEN_UNMAPPED_PRINCIPAL';
end
$$;

create or replace function dpg_app.leo542_admin_can(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, dpg_app, auth
as $$
  with actor as (select * from dpg_app.leo542_actor_context())
  select coalesce((
    select case
      when actor_kind <> 'admin' then false
      when admin_role = 'admin' then p_permission = any(array[
        'orders:read','orders:update_status','orders:assign','orders:cancel','orders:edit_note','orders:edit',
        'quotes:read','quotes:create','quotes:update','customers:read','customers:write',
        'products:read','products:write','products:publish','categories:read','categories:write',
        'brands:read','brands:write','taxonomy:read','taxonomy:write','product_types:read','product_types:write',
        'specifications:read','specifications:write','documents:read','documents:write','commerce:write',
        'visibility:write','seo:write','blog:read','blog:write','blog:publish','media:reference',
        'users:read','dashboard:read','reports:read','audit:read'
      ])
      when admin_role = 'sale_manager' then p_permission = any(array[
        'orders:read','orders:update_status','orders:assign','orders:cancel','orders:edit_note',
        'quotes:read','quotes:create','quotes:update','customers:read','customers:write',
        'products:read','categories:read','dashboard:read','reports:read'
      ])
      when admin_role = 'sale' then p_permission = any(array[
        'orders:read_assigned','orders:update_status','orders:edit_note',
        'quotes:read_assigned','quotes:create','quotes:update','customers:read','products:read','dashboard:read_own'
      ])
      else false
    end from actor
  ), false)
$$;

create or replace function dpg_app.leo542_machine_can(p_capability text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, dpg_app, auth
as $$
  with actor as (select * from dpg_app.leo542_actor_context())
  select coalesce(exists (
    select 1
    from actor
    join dpg_app.publishing_identity_capabilities c
      on c.identity_id = actor.machine_identity_id
    where actor.actor_kind = 'machine'
      and p_capability = any(array['posts:write','posts:publish','media:write'])
      and c.capability = p_capability
      and c.revoked_at is null
  ), false)
$$;

revoke all on function dpg_app.leo542_actor_context(),
  dpg_app.leo542_admin_can(text), dpg_app.leo542_machine_can(text)
  from public, anon, service_role;
grant execute on function dpg_app.leo542_actor_context(),
  dpg_app.leo542_admin_can(text), dpg_app.leo542_machine_can(text)
  to authenticated;

-- No direct anonymous access. SECURITY INVOKER RPCs receive only the exact
-- table privileges below and remain constrained by forced RLS.
revoke all on table dpg_app.admin_users,
  dpg_app.publishing_machine_identities, dpg_app.publishing_identity_capabilities,
  dpg_app.publishing_identity_ip_allowlist, dpg_app.publishing_global_controls,
  dpg_app.blog_posts, dpg_app.blog_categories, dpg_app.blog_tags, dpg_app.blog_post_tags,
  dpg_app.publishing_managed_media, dpg_app.publishing_blog_post_media,
  dpg_app.publishing_idempotency_records, dpg_app.publishing_rate_limit_windows,
  dpg_app.publishing_audit_events, dpg_app.audit_logs,
  dpg_app.products, dpg_app.product_images, dpg_app.product_relationships,
  dpg_app.orders, dpg_app.order_items, dpg_app.quote_requests, dpg_app.quote_items,
  dpg_app.customers, dpg_app.banners, dpg_app.partners, dpg_app.projects,
  dpg_app.categories, dpg_app.subcategories, dpg_app.brands, dpg_app.colors,
  dpg_app.origins, dpg_app.materials, dpg_app.filter_definitions,
  dpg_app.catalog_taxons, dpg_app.product_types, dpg_app.product_sub_types,
  dpg_app.spec_definitions, dpg_app.spec_options, dpg_app.product_spec_values,
  dpg_app.product_documents, dpg_app.product_taxon_assignments,
  dpg_app.product_variant_groups
  from anon, authenticated, service_role;

grant select on table dpg_app.admin_users,
  dpg_app.publishing_machine_identities, dpg_app.publishing_identity_capabilities,
  dpg_app.publishing_identity_ip_allowlist, dpg_app.publishing_global_controls,
  dpg_app.blog_categories, dpg_app.blog_tags,
  dpg_app.categories, dpg_app.subcategories, dpg_app.brands, dpg_app.colors,
  dpg_app.origins, dpg_app.materials, dpg_app.filter_definitions,
  dpg_app.catalog_taxons, dpg_app.product_types, dpg_app.product_sub_types,
  dpg_app.spec_definitions, dpg_app.spec_options, dpg_app.product_variant_groups
  to authenticated;
grant select, insert, update on table dpg_app.blog_posts, dpg_app.blog_post_tags,
  dpg_app.publishing_managed_media, dpg_app.publishing_blog_post_media,
  dpg_app.products, dpg_app.product_images, dpg_app.product_relationships,
  dpg_app.product_spec_values, dpg_app.product_documents, dpg_app.product_taxon_assignments,
  dpg_app.orders, dpg_app.order_items, dpg_app.quote_requests, dpg_app.quote_items,
  dpg_app.customers, dpg_app.banners, dpg_app.partners, dpg_app.projects
  to authenticated;
grant select, insert, update on table dpg_app.runtime_idempotency_records,
  dpg_app.publishing_idempotency_records, dpg_app.publishing_rate_limit_windows
  to authenticated;
grant select, insert on table dpg_app.runtime_audit_events,
  dpg_app.publishing_audit_events, dpg_app.audit_logs
  to authenticated;
grant usage, select on sequence dpg_app.blog_posts_id_seq, dpg_app.products_id_seq,
  dpg_app.product_images_id_seq, dpg_app.product_relationships_id_seq,
  dpg_app.product_documents_id_seq, dpg_app.orders_id_seq, dpg_app.order_items_id_seq,
  dpg_app.quote_requests_id_seq, dpg_app.quote_items_id_seq, dpg_app.customers_id_seq,
  dpg_app.banners_id_seq, dpg_app.partners_id_seq, dpg_app.projects_id_seq,
  dpg_app.audit_logs_id_seq, dpg_app.publishing_audit_events_id_seq,
  dpg_app.runtime_audit_events_id_seq
  to authenticated;

-- Identity and control reads.
create policy leo542_admin_users_select on dpg_app.admin_users for select to authenticated
  using (supabase_auth_user_id = auth.uid() or dpg_app.leo542_admin_can('users:read'));
create policy leo542_machine_identity_select on dpg_app.publishing_machine_identities for select to authenticated
  using (supabase_auth_user_id = auth.uid() or dpg_app.leo542_admin_can('audit:read'));
create policy leo542_machine_capability_select on dpg_app.publishing_identity_capabilities for select to authenticated
  using (identity_id = (select machine_identity_id from dpg_app.leo542_actor_context()) or dpg_app.leo542_admin_can('audit:read'));
create policy leo542_machine_ip_select on dpg_app.publishing_identity_ip_allowlist for select to authenticated
  using (identity_id = (select machine_identity_id from dpg_app.leo542_actor_context()) or dpg_app.leo542_admin_can('audit:read'));
create policy leo542_publishing_control_select on dpg_app.publishing_global_controls for select to authenticated
  using (dpg_app.leo542_admin_can('blog:read') or dpg_app.leo542_machine_can('posts:write'));

-- Admin read policies. Existing backup/runtime policies are preserved.
create policy leo542_blog_categories_select on dpg_app.blog_categories for select to authenticated
  using (dpg_app.leo542_admin_can('blog:read') or dpg_app.leo542_machine_can('posts:write'));
create policy leo542_blog_tags_select on dpg_app.blog_tags for select to authenticated
  using (dpg_app.leo542_admin_can('blog:read') or dpg_app.leo542_machine_can('posts:write'));
create policy leo542_blog_posts_select_admin on dpg_app.blog_posts for select to authenticated
  using (dpg_app.leo542_admin_can('blog:read'));
create policy leo542_blog_posts_insert_admin on dpg_app.blog_posts for insert to authenticated
  with check (dpg_app.leo542_admin_can('blog:write') and publishing_identity_id is null);
create policy leo542_blog_posts_update_admin on dpg_app.blog_posts for update to authenticated
  using (dpg_app.leo542_admin_can('blog:write')) with check (dpg_app.leo542_admin_can('blog:write'));
create policy leo542_blog_posts_select_machine on dpg_app.blog_posts for select to authenticated
  using (publishing_identity_id = (select machine_identity_id from dpg_app.leo542_actor_context()));
create policy leo542_blog_posts_insert_machine on dpg_app.blog_posts for insert to authenticated
  with check (publishing_identity_id = (select machine_identity_id from dpg_app.leo542_actor_context()) and dpg_app.leo542_machine_can('posts:write'));
create policy leo542_blog_posts_update_machine on dpg_app.blog_posts for update to authenticated
  using (publishing_identity_id = (select machine_identity_id from dpg_app.leo542_actor_context()) and dpg_app.leo542_machine_can('posts:write'))
  with check (publishing_identity_id = (select machine_identity_id from dpg_app.leo542_actor_context()) and dpg_app.leo542_machine_can('posts:write'));

create policy leo542_blog_post_tags_select on dpg_app.blog_post_tags for select to authenticated
  using (exists (select 1 from dpg_app.blog_posts p where p.id = post_id));
create policy leo542_blog_post_tags_insert on dpg_app.blog_post_tags for insert to authenticated
  with check (exists (select 1 from dpg_app.blog_posts p where p.id = post_id));
create policy leo542_media_select on dpg_app.publishing_managed_media for select to authenticated
  using (dpg_app.leo542_admin_can('media:reference') or identity_id = (select machine_identity_id from dpg_app.leo542_actor_context()));
create policy leo542_post_media_select on dpg_app.publishing_blog_post_media for select to authenticated
  using (exists (select 1 from dpg_app.blog_posts p where p.id = post_id));
create policy leo542_post_media_insert on dpg_app.publishing_blog_post_media for insert to authenticated
  with check (
    exists (select 1 from dpg_app.blog_posts p where p.id = post_id)
    and exists (select 1 from dpg_app.publishing_managed_media m where m.id = media_id and m.status = 'ready')
  );

create policy leo542_products_select_admin on dpg_app.products for select to authenticated
  using (dpg_app.leo542_admin_can('products:read'));
create policy leo542_products_insert_admin on dpg_app.products for insert to authenticated
  with check (dpg_app.leo542_admin_can('products:write'));
create policy leo542_products_update_admin on dpg_app.products for update to authenticated
  using (dpg_app.leo542_admin_can('products:write')) with check (dpg_app.leo542_admin_can('products:write'));

-- Generic Admin lookup tables are read-only through Phase A.
create policy leo542_categories_select on dpg_app.categories for select to authenticated using (dpg_app.leo542_admin_can('categories:read') or dpg_app.leo542_admin_can('products:read'));
create policy leo542_subcategories_select on dpg_app.subcategories for select to authenticated using (dpg_app.leo542_admin_can('categories:read') or dpg_app.leo542_admin_can('products:read'));
create policy leo542_brands_select on dpg_app.brands for select to authenticated using (dpg_app.leo542_admin_can('brands:read') or dpg_app.leo542_admin_can('products:read'));
create policy leo542_colors_select on dpg_app.colors for select to authenticated using (dpg_app.leo542_admin_can('products:read'));
create policy leo542_origins_select on dpg_app.origins for select to authenticated using (dpg_app.leo542_admin_can('products:read'));
create policy leo542_materials_select on dpg_app.materials for select to authenticated using (dpg_app.leo542_admin_can('products:read'));
create policy leo542_filter_definitions_select on dpg_app.filter_definitions for select to authenticated using (dpg_app.leo542_admin_can('products:read'));
create policy leo542_catalog_taxons_select on dpg_app.catalog_taxons for select to authenticated using (dpg_app.leo542_admin_can('taxonomy:read') or dpg_app.leo542_admin_can('products:read'));
create policy leo542_product_types_select on dpg_app.product_types for select to authenticated using (dpg_app.leo542_admin_can('product_types:read') or dpg_app.leo542_admin_can('products:read'));
create policy leo542_product_sub_types_select on dpg_app.product_sub_types for select to authenticated using (dpg_app.leo542_admin_can('product_types:read') or dpg_app.leo542_admin_can('products:read'));
create policy leo542_spec_definitions_select on dpg_app.spec_definitions for select to authenticated using (dpg_app.leo542_admin_can('specifications:read') or dpg_app.leo542_admin_can('products:read'));
create policy leo542_spec_options_select on dpg_app.spec_options for select to authenticated using (dpg_app.leo542_admin_can('specifications:read') or dpg_app.leo542_admin_can('products:read'));
create policy leo542_product_variant_groups_select on dpg_app.product_variant_groups for select to authenticated using (dpg_app.leo542_admin_can('products:read'));

create policy leo542_orders_select_admin on dpg_app.orders for select to authenticated
  using (dpg_app.leo542_admin_can('orders:read') or (dpg_app.leo542_admin_can('orders:read_assigned') and assigned_to = (select admin_id from dpg_app.leo542_actor_context())));
create policy leo542_orders_update_admin on dpg_app.orders for update to authenticated
  using (dpg_app.leo542_admin_can('orders:update_status') and (dpg_app.leo542_admin_can('orders:read') or assigned_to = (select admin_id from dpg_app.leo542_actor_context())))
  with check (dpg_app.leo542_admin_can('orders:update_status'));
create policy leo542_order_items_select_admin on dpg_app.order_items for select to authenticated
  using (exists (select 1 from dpg_app.orders o where o.id = order_id));
create policy leo542_quotes_select_admin on dpg_app.quote_requests for select to authenticated
  using (dpg_app.leo542_admin_can('quotes:read') or (dpg_app.leo542_admin_can('quotes:read_assigned') and assigned_to = (select admin_id from dpg_app.leo542_actor_context())));
create policy leo542_quotes_update_admin on dpg_app.quote_requests for update to authenticated
  using (dpg_app.leo542_admin_can('quotes:update') and (dpg_app.leo542_admin_can('quotes:read') or assigned_to = (select admin_id from dpg_app.leo542_actor_context())))
  with check (dpg_app.leo542_admin_can('quotes:update'));
create policy leo542_quote_items_select_admin on dpg_app.quote_items for select to authenticated
  using (exists (select 1 from dpg_app.quote_requests q where q.id = quote_id));
create policy leo542_customers_select_admin on dpg_app.customers for select to authenticated using (dpg_app.leo542_admin_can('customers:read'));
create policy leo542_customers_update_admin on dpg_app.customers for update to authenticated
  using (dpg_app.leo542_admin_can('customers:write')) with check (dpg_app.leo542_admin_can('customers:write'));

create policy leo542_banners_select on dpg_app.banners for select to authenticated using (dpg_app.leo542_admin_can('categories:read'));
create policy leo542_banners_update on dpg_app.banners for update to authenticated using (dpg_app.leo542_admin_can('categories:write')) with check (dpg_app.leo542_admin_can('categories:write'));
create policy leo542_partners_select on dpg_app.partners for select to authenticated using (dpg_app.leo542_admin_can('categories:read'));
create policy leo542_partners_update on dpg_app.partners for update to authenticated using (dpg_app.leo542_admin_can('categories:write')) with check (dpg_app.leo542_admin_can('categories:write'));
create policy leo542_projects_select on dpg_app.projects for select to authenticated using (dpg_app.leo542_admin_can('categories:read'));
create policy leo542_projects_update on dpg_app.projects for update to authenticated using (dpg_app.leo542_admin_can('categories:write')) with check (dpg_app.leo542_admin_can('categories:write'));

-- Existing LEO-541 own-row policies remain in force for runtime idempotency/audit.
create policy leo542_runtime_audit_select_admin on dpg_app.runtime_audit_events for select to authenticated
  using (dpg_app.leo542_admin_can('audit:read'));
create policy leo542_publishing_idempotency_select on dpg_app.publishing_idempotency_records for select to authenticated
  using (identity_id = (select machine_identity_id from dpg_app.leo542_actor_context()));
create policy leo542_publishing_idempotency_insert on dpg_app.publishing_idempotency_records for insert to authenticated
  with check (identity_id = (select machine_identity_id from dpg_app.leo542_actor_context()));
create policy leo542_publishing_idempotency_update on dpg_app.publishing_idempotency_records for update to authenticated
  using (identity_id = (select machine_identity_id from dpg_app.leo542_actor_context()))
  with check (identity_id = (select machine_identity_id from dpg_app.leo542_actor_context()));
create policy leo542_publishing_rate_select on dpg_app.publishing_rate_limit_windows for select to authenticated
  using (identity_id = (select machine_identity_id from dpg_app.leo542_actor_context()));
create policy leo542_publishing_rate_insert on dpg_app.publishing_rate_limit_windows for insert to authenticated
  with check (identity_id = (select machine_identity_id from dpg_app.leo542_actor_context()));
create policy leo542_publishing_rate_update on dpg_app.publishing_rate_limit_windows for update to authenticated
  using (identity_id = (select machine_identity_id from dpg_app.leo542_actor_context()))
  with check (identity_id = (select machine_identity_id from dpg_app.leo542_actor_context()));
create policy leo542_publishing_audit_insert on dpg_app.publishing_audit_events for insert to authenticated
  with check (
    auth_user_id = auth.uid()
    and ((actor_kind = 'admin' and admin_actor_id = (select admin_id from dpg_app.leo542_actor_context()))
      or (actor_kind = 'machine' and identity_id = (select machine_identity_id from dpg_app.leo542_actor_context())))
  );
create policy leo542_publishing_audit_select on dpg_app.publishing_audit_events for select to authenticated
  using (dpg_app.leo542_admin_can('audit:read') or identity_id = (select machine_identity_id from dpg_app.leo542_actor_context()));
create policy leo542_audit_logs_insert on dpg_app.audit_logs for insert to authenticated
  with check (auth_user_id = auth.uid() and user_id = (select admin_id from dpg_app.leo542_actor_context()));
create policy leo542_audit_logs_select on dpg_app.audit_logs for select to authenticated
  using (dpg_app.leo542_admin_can('audit:read'));

-- Read RPCs return bounded JSON and never expose password/session/credential data.
create or replace function public.leo542_admin_commerce_list(p_resource text, p_limit integer default 25, p_offset integer default 0)
returns jsonb language plpgsql stable security invoker set search_path = pg_catalog, dpg_app as $$
begin
  if p_limit < 1 or p_limit > 100 or p_offset < 0 then raise exception 'INVALID_PAGINATION'; end if;
  if p_resource = 'orders' then
    return coalesce((select jsonb_agg(to_jsonb(x)) from (
      select id,order_number,customer_name,customer_phone,status,payment_status,total,assigned_to,created_at,updated_at
      from dpg_app.orders order by created_at desc,id desc limit p_limit offset p_offset
    ) x),'[]'::jsonb);
  elsif p_resource = 'quotes' then
    return coalesce((select jsonb_agg(to_jsonb(x)) from (
      select id,quote_number,name,phone,status,assigned_to,created_at,updated_at
      from dpg_app.quote_requests order by created_at desc,id desc limit p_limit offset p_offset
    ) x),'[]'::jsonb);
  elsif p_resource = 'customers' then
    return coalesce((select jsonb_agg(to_jsonb(x)) from (
      select id,full_name,phone,email,created_at,updated_at from dpg_app.customers
      order by created_at desc,id desc limit p_limit offset p_offset
    ) x),'[]'::jsonb);
  end if;
  raise exception 'INVALID_RESOURCE';
end $$;

create or replace function public.leo542_admin_commerce_get(p_resource text, p_id integer)
returns jsonb language plpgsql stable security invoker set search_path = pg_catalog, dpg_app as $$
begin
  if p_resource = 'orders' then return (select to_jsonb(x) from (select * from dpg_app.orders where id=p_id) x);
  elsif p_resource = 'quotes' then return (select to_jsonb(x) from (select * from dpg_app.quote_requests where id=p_id) x);
  elsif p_resource = 'customers' then return (select to_jsonb(x) from (select * from dpg_app.customers where id=p_id) x);
  end if;
  raise exception 'INVALID_RESOURCE';
end $$;

create or replace function public.leo542_admin_commerce_patch(p_resource text, p_id integer, p_patch jsonb, p_idempotency_key text, p_request_id uuid)
returns jsonb language plpgsql volatile security invoker set search_path = pg_catalog, dpg_app, extensions as $$
declare v_actor record; v_key char(64); v_hash char(64); v_existing record; v_result jsonb; v_fields text[];
begin
  select * into v_actor from dpg_app.leo542_actor_context();
  if v_actor.actor_kind <> 'admin' then raise exception 'FORBIDDEN'; end if;
  if length(p_idempotency_key) < 8 then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
  perform pg_advisory_xact_lock(hashtextextended('leo542:admin-commerce:'||p_resource||':'||p_id,0));
  v_key := encode(digest(p_idempotency_key,'sha256'),'hex');
  v_hash := encode(digest((p_resource||':'||p_id||':'||p_patch::text)::bytea,'sha256'),'hex');
  insert into dpg_app.runtime_idempotency_records(owner_id,operation,key_hash,request_hash,safe_response,resource_type,resource_id,expires_at)
  values(auth.uid(),'admin.'||p_resource||'.patch',v_key,v_hash,'{}',p_resource,p_id::text,now()+interval '24 hours') on conflict do nothing;
  if not found then
    select * into v_existing from dpg_app.runtime_idempotency_records where owner_id=auth.uid() and operation='admin.'||p_resource||'.patch' and key_hash=v_key;
    if v_existing.request_hash<>v_hash then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
    if v_existing.safe_response='{}' then raise exception 'IDEMPOTENCY_IN_PROGRESS'; end if;
    return v_existing.safe_response;
  end if;
  v_fields := array(select jsonb_object_keys(p_patch));
  if p_resource='orders' then
    if not dpg_app.leo542_admin_can('orders:update_status') then raise exception 'FORBIDDEN'; end if;
    update dpg_app.orders set
      status=case when p_patch?'status' then p_patch->>'status' else status end,
      payment_status=case when p_patch?'payment_status' then p_patch->>'payment_status' else payment_status end,
      assigned_to=case when p_patch?'assigned_to' then nullif(p_patch->>'assigned_to','')::integer else assigned_to end,
      internal_note=case when p_patch?'internal_note' then p_patch->>'internal_note' else internal_note end,
      updated_at=now() where id=p_id returning jsonb_build_object('id',id,'status',status,'payment_status',payment_status,'updated_at',updated_at) into v_result;
  elsif p_resource='quotes' then
    if not dpg_app.leo542_admin_can('quotes:update') then raise exception 'FORBIDDEN'; end if;
    update dpg_app.quote_requests set status=case when p_patch?'status' then p_patch->>'status' else status end,
      assigned_to=case when p_patch?'assigned_to' then nullif(p_patch->>'assigned_to','')::integer else assigned_to end,
      admin_notes=case when p_patch?'admin_notes' then p_patch->>'admin_notes' else admin_notes end,
      updated_at=now() where id=p_id returning jsonb_build_object('id',id,'status',status,'updated_at',updated_at) into v_result;
  elsif p_resource='customers' then
    if not dpg_app.leo542_admin_can('customers:write') then raise exception 'FORBIDDEN'; end if;
    update dpg_app.customers set full_name=case when p_patch?'full_name' then p_patch->>'full_name' else full_name end,
      email=case when p_patch?'email' then nullif(p_patch->>'email','') else email end,
      updated_at=now() where id=p_id returning jsonb_build_object('id',id,'updated_at',updated_at) into v_result;
  else raise exception 'INVALID_RESOURCE'; end if;
  if v_result is null then raise exception 'RESOURCE_NOT_FOUND'; end if;
  insert into dpg_app.audit_logs(user_id,action,entity_type,entity_id,auth_user_id,auth_session_id,request_id,idempotency_key_hash,changed_fields)
  values(v_actor.admin_id,'leo542.'||p_resource||'.updated',p_resource,p_id,auth.uid(),v_actor.auth_session_id,p_request_id,v_key,v_fields);
  update dpg_app.runtime_idempotency_records set safe_response=v_result where owner_id=auth.uid() and operation='admin.'||p_resource||'.patch' and key_hash=v_key;
  return v_result;
end $$;

create or replace function public.leo542_admin_content_snapshot()
returns jsonb language sql stable security invoker set search_path = pg_catalog, dpg_app as $$
  select jsonb_build_object(
    'banners',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from dpg_app.banners order by sort_order,id limit 200) x),'[]'::jsonb),
    'partners',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from dpg_app.partners order by sort_order,id limit 200) x),'[]'::jsonb),
    'projects',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from dpg_app.projects order by created_at desc,id limit 200) x),'[]'::jsonb),
    'categories',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from dpg_app.categories order by sort_order,id) x),'[]'::jsonb),
    'brands',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from dpg_app.brands order by sort_order,id) x),'[]'::jsonb),
    'taxons',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from dpg_app.catalog_taxons order by depth,sort_order,id limit 500) x),'[]'::jsonb),
    'product_types',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from dpg_app.product_types order by sort_order,id limit 300) x),'[]'::jsonb),
    'spec_definitions',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from dpg_app.spec_definitions order by sort_order,id limit 300) x),'[]'::jsonb)
  )
$$;

create or replace function public.leo542_admin_content_patch(p_resource text,p_id integer,p_patch jsonb,p_idempotency_key text,p_request_id uuid)
returns jsonb language plpgsql volatile security invoker set search_path=pg_catalog,dpg_app,extensions as $$
declare v_actor record; v_key char(64); v_hash char(64); v_existing record; v_result jsonb;
begin
 select * into v_actor from dpg_app.leo542_actor_context();
 if not (dpg_app.leo542_admin_can('categories:write') or dpg_app.leo542_admin_can('taxonomy:write') or dpg_app.leo542_admin_can('product_types:write') or dpg_app.leo542_admin_can('specifications:write')) then raise exception 'FORBIDDEN'; end if;
 if length(p_idempotency_key)<8 then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
 perform pg_advisory_xact_lock(hashtextextended('leo542:admin-content:'||p_resource||':'||p_id,0));
 v_key:=encode(digest(p_idempotency_key,'sha256'),'hex'); v_hash:=encode(digest((p_resource||':'||p_id||':'||p_patch::text)::bytea,'sha256'),'hex');
 insert into dpg_app.runtime_idempotency_records(owner_id,operation,key_hash,request_hash,safe_response,resource_type,resource_id,expires_at)
 values(auth.uid(),'admin.content.patch',v_key,v_hash,'{}',p_resource,p_id::text,now()+interval '24 hours') on conflict do nothing;
 if not found then select * into v_existing from dpg_app.runtime_idempotency_records where owner_id=auth.uid() and operation='admin.content.patch' and key_hash=v_key;
  if v_existing.request_hash<>v_hash then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if; if v_existing.safe_response='{}' then raise exception 'IDEMPOTENCY_IN_PROGRESS'; end if; return v_existing.safe_response; end if;
 if p_resource='banner' then
  update dpg_app.banners set title=case when p_patch?'title' then p_patch->>'title' else title end,is_active=coalesce((p_patch->>'is_active')::boolean,is_active),sort_order=coalesce((p_patch->>'sort_order')::integer,sort_order),updated_at=now() where id=p_id returning jsonb_build_object('id',id,'updated_at',updated_at) into v_result;
 elsif p_resource='partner' then
  update dpg_app.partners set name=coalesce(p_patch->>'name',name),is_active=coalesce((p_patch->>'is_active')::boolean,is_active),sort_order=coalesce((p_patch->>'sort_order')::integer,sort_order),updated_at=now() where id=p_id returning jsonb_build_object('id',id,'updated_at',updated_at) into v_result;
 elsif p_resource='project' then
  update dpg_app.projects set title=coalesce(p_patch->>'title',title),is_active=coalesce((p_patch->>'is_active')::boolean,is_active),is_featured=coalesce((p_patch->>'is_featured')::boolean,is_featured),sort_order=coalesce((p_patch->>'sort_order')::integer,sort_order),updated_at=now() where id=p_id returning jsonb_build_object('id',id,'updated_at',updated_at) into v_result;
 else raise exception 'INVALID_RESOURCE'; end if;
 if v_result is null then raise exception 'RESOURCE_NOT_FOUND'; end if;
 insert into dpg_app.audit_logs(user_id,action,entity_type,entity_id,auth_user_id,auth_session_id,request_id,idempotency_key_hash,changed_fields)
 values(v_actor.admin_id,'leo542.'||p_resource||'.updated',p_resource,p_id,auth.uid(),v_actor.auth_session_id,p_request_id,v_key,array(select jsonb_object_keys(p_patch)));
 update dpg_app.runtime_idempotency_records set safe_response=v_result where owner_id=auth.uid() and operation='admin.content.patch' and key_hash=v_key;
 return v_result;
end $$;

create or replace function public.leo542_admin_blog_list(p_limit integer default 25,p_offset integer default 0,p_status text default null)
returns jsonb language sql stable security invoker set search_path=pg_catalog,dpg_app as $$
 select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (
  select id,title,slug,status,version,published_at,updated_at,thumbnail_url,cover_image_url
  from dpg_app.blog_posts where p_status is null or status=p_status order by updated_at desc,id desc limit p_limit offset p_offset
 ) x
$$;
create or replace function public.leo542_admin_blog_get(p_post_id integer)
returns jsonb language sql stable security invoker set search_path=pg_catalog,dpg_app as $$
 select to_jsonb(x) from (select * from dpg_app.blog_posts where id=p_post_id) x
$$;

create or replace function public.leo542_admin_blog_put(p_post_id integer,p_expected_version integer,p_input jsonb,p_idempotency_key text,p_request_id uuid)
returns jsonb language plpgsql volatile security invoker set search_path=pg_catalog,dpg_app,extensions as $$
declare v_actor record; v_post dpg_app.blog_posts%rowtype; v_old dpg_app.blog_posts%rowtype; v_key char(64); v_hash char(64); v_existing record; v_result jsonb; v_status text; v_media jsonb;
begin
 select * into v_actor from dpg_app.leo542_actor_context();
 if not dpg_app.leo542_admin_can('blog:write') then raise exception 'FORBIDDEN'; end if;
 if length(p_idempotency_key)<8 then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
 perform pg_advisory_xact_lock(hashtextextended('leo542:admin-blog:'||coalesce(p_post_id::text,p_input->>'slug'),0));
 v_key:=encode(digest(p_idempotency_key,'sha256'),'hex'); v_hash:=encode(digest(p_input::text::bytea,'sha256'),'hex');
 insert into dpg_app.runtime_idempotency_records(owner_id,operation,key_hash,request_hash,safe_response,resource_type,resource_id,expires_at)
 values(auth.uid(),'admin.blog.put',v_key,v_hash,'{}','blog_post',coalesce(p_post_id::text,'pending'),now()+interval '24 hours') on conflict do nothing;
 if not found then select * into v_existing from dpg_app.runtime_idempotency_records where owner_id=auth.uid() and operation='admin.blog.put' and key_hash=v_key;
  if v_existing.request_hash<>v_hash then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if; if v_existing.safe_response='{}' then raise exception 'IDEMPOTENCY_IN_PROGRESS'; end if; return v_existing.safe_response; end if;
 v_status:=coalesce(p_input->>'status','draft');
 if v_status not in ('draft','scheduled','published','schedule_blocked') then raise exception 'INVALID_BLOG_STATUS'; end if;
 if v_status='published' and not dpg_app.leo542_admin_can('blog:publish') then raise exception 'FORBIDDEN'; end if;
 if p_post_id is null then
  insert into dpg_app.blog_posts(title,slug,excerpt,content,category_id,thumbnail_url,cover_image_url,seo_title,seo_description,seo_keywords,status,published_at,first_published_at,author_name,is_featured,is_pinned,publishing_identity_id,external_id,version)
  values(p_input->>'title',p_input->>'slug',p_input->>'excerpt',coalesce(p_input->>'content',''),(p_input->>'category_id')::integer,p_input->>'thumbnail_url',p_input->>'cover_image_url',p_input->>'seo_title',p_input->>'seo_description',p_input->>'seo_keywords',v_status,case when v_status='published' then now() end,case when v_status='published' then now() end,coalesce(p_input->>'author_name','Ban Biên Tập Đông Phú Gia'),coalesce((p_input->>'is_featured')::boolean,false),coalesce((p_input->>'is_pinned')::boolean,false),null,null,1) returning * into v_post;
 else
  select * into v_old from dpg_app.blog_posts where id=p_post_id for update;
  if not found then raise exception 'RESOURCE_NOT_FOUND'; end if;
  if p_expected_version is null or v_old.version<>p_expected_version then raise exception 'STALE_VERSION'; end if;
  update dpg_app.blog_posts set title=coalesce(p_input->>'title',title),slug=coalesce(p_input->>'slug',slug),excerpt=case when p_input?'excerpt' then p_input->>'excerpt' else excerpt end,content=coalesce(p_input->>'content',content),category_id=coalesce((p_input->>'category_id')::integer,category_id),thumbnail_url=case when p_input?'thumbnail_url' then p_input->>'thumbnail_url' else thumbnail_url end,cover_image_url=case when p_input?'cover_image_url' then p_input->>'cover_image_url' else cover_image_url end,seo_title=case when p_input?'seo_title' then p_input->>'seo_title' else seo_title end,seo_description=case when p_input?'seo_description' then p_input->>'seo_description' else seo_description end,status=coalesce(p_input->>'status',status),published_at=case when coalesce(p_input->>'status',status)='published' then coalesce(published_at,now()) else published_at end,first_published_at=case when coalesce(p_input->>'status',status)='published' then coalesce(first_published_at,now()) else first_published_at end,version=version+1,updated_at=now() where id=p_post_id returning * into v_post;
 end if;
 if p_input?'media_refs' then
  for v_media in select value from jsonb_array_elements(p_input->'media_refs') loop
   if not exists(select 1 from dpg_app.publishing_managed_media where id=(v_media->>'media_id')::uuid and status='ready') then raise exception 'MEDIA_NOT_READY'; end if;
   insert into dpg_app.publishing_blog_post_media(post_id,media_id,usage) values(v_post.id,(v_media->>'media_id')::uuid,coalesce(v_media->>'usage','inline')) on conflict do nothing;
  end loop;
 end if;
 insert into dpg_app.publishing_audit_events(actor_kind,admin_actor_id,action,post_id,request_id,idempotency_key_hash,from_version,to_version,from_state,to_state,changed_fields,content_hash,auth_user_id,auth_session_id)
 values('admin',v_actor.admin_id,case when p_post_id is null then 'post.created' else 'post.updated' end,v_post.id,p_request_id,v_key,v_old.version,v_post.version,v_old.status,v_post.status,array(select jsonb_object_keys(p_input)),encode(digest(v_post.content::bytea,'sha256'),'hex'),auth.uid(),v_actor.auth_session_id);
 v_result:=jsonb_build_object('id',v_post.id,'status',v_post.status,'version',v_post.version,'updated_at',v_post.updated_at);
 update dpg_app.runtime_idempotency_records set safe_response=v_result,resource_id=v_post.id::text where owner_id=auth.uid() and operation='admin.blog.put' and key_hash=v_key;
 return v_result;
end $$;

create or replace function public.leo542_admin_product_list(p_limit integer default 25,p_offset integer default 0,p_publication_status text default null)
returns jsonb language sql stable security invoker set search_path=pg_catalog,dpg_app as $$
 select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (
  select id,sku,name,slug,publication_status,pdp_visibility,listing_visibility,search_visibility,image_main_url,version,updated_at
  from dpg_app.products where p_publication_status is null or publication_status=p_publication_status order by updated_at desc,id desc limit p_limit offset p_offset
 ) x
$$;
create or replace function public.leo542_admin_product_get(p_product_id integer)
returns jsonb language sql stable security invoker set search_path=pg_catalog,dpg_app as $$
 select to_jsonb(x) from (select * from dpg_app.products where id=p_product_id) x
$$;
create or replace function public.leo542_admin_product_put(p_product_id integer,p_expected_version integer,p_input jsonb,p_idempotency_key text,p_request_id uuid)
returns jsonb language plpgsql volatile security invoker set search_path=pg_catalog,dpg_app,extensions as $$
declare v_actor record; v_product dpg_app.products%rowtype; v_old dpg_app.products%rowtype; v_key char(64); v_hash char(64); v_existing record; v_result jsonb; v_state text;
begin
 select * into v_actor from dpg_app.leo542_actor_context(); if not dpg_app.leo542_admin_can('products:write') then raise exception 'FORBIDDEN'; end if;
 if length(p_idempotency_key)<8 then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
 perform pg_advisory_xact_lock(hashtextextended('leo542:admin-product:'||coalesce(p_product_id::text,p_input->>'sku'),0));
 v_key:=encode(digest(p_idempotency_key,'sha256'),'hex'); v_hash:=encode(digest(p_input::text::bytea,'sha256'),'hex');
 insert into dpg_app.runtime_idempotency_records(owner_id,operation,key_hash,request_hash,safe_response,resource_type,resource_id,expires_at)
 values(auth.uid(),'admin.product.put',v_key,v_hash,'{}','product',coalesce(p_product_id::text,'pending'),now()+interval '24 hours') on conflict do nothing;
 if not found then select * into v_existing from dpg_app.runtime_idempotency_records where owner_id=auth.uid() and operation='admin.product.put' and key_hash=v_key;
  if v_existing.request_hash<>v_hash then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if; if v_existing.safe_response='{}' then raise exception 'IDEMPOTENCY_IN_PROGRESS'; end if; return v_existing.safe_response; end if;
 v_state:=coalesce(p_input->>'publication_status','draft'); if v_state not in ('draft','public') then raise exception 'INVALID_PRODUCT_STATUS'; end if;
 if v_state='public' and not dpg_app.leo542_admin_can('products:publish') then raise exception 'FORBIDDEN'; end if;
 if p_product_id is null then
  insert into dpg_app.products(sku,name,slug,category_id,subcategory_id,brand_id,description,image_main_url,is_active,publication_status,pdp_visibility,listing_visibility,search_visibility,seo_indexing,sitemap_include,source_system,version)
  values(p_input->>'sku',p_input->>'name',p_input->>'slug',(p_input->>'category_id')::integer,nullif(p_input->>'subcategory_id','')::integer,nullif(p_input->>'brand_id','')::integer,p_input->>'description',p_input->>'image_main_url',coalesce((p_input->>'is_active')::boolean,false),v_state,coalesce(p_input->>'pdp_visibility','hidden'),coalesce(p_input->>'listing_visibility','hidden'),coalesce(p_input->>'search_visibility','hidden'),coalesce(p_input->>'seo_indexing','noindex'),coalesce((p_input->>'sitemap_include')::boolean,false),'leo542-synthetic',1) returning * into v_product;
 else
  select * into v_old from dpg_app.products where id=p_product_id for update; if not found then raise exception 'RESOURCE_NOT_FOUND'; end if;
  if p_expected_version is null or v_old.version<>p_expected_version then raise exception 'STALE_VERSION'; end if;
  update dpg_app.products set name=coalesce(p_input->>'name',name),slug=coalesce(p_input->>'slug',slug),description=case when p_input?'description' then p_input->>'description' else description end,image_main_url=case when p_input?'image_main_url' then p_input->>'image_main_url' else image_main_url end,publication_status=coalesce(p_input->>'publication_status',publication_status),pdp_visibility=coalesce(p_input->>'pdp_visibility',pdp_visibility),listing_visibility=coalesce(p_input->>'listing_visibility',listing_visibility),search_visibility=coalesce(p_input->>'search_visibility',search_visibility),seo_indexing=coalesce(p_input->>'seo_indexing',seo_indexing),sitemap_include=coalesce((p_input->>'sitemap_include')::boolean,sitemap_include),is_active=coalesce((p_input->>'is_active')::boolean,is_active),version=version+1,updated_at=now() where id=p_product_id returning * into v_product;
 end if;
 insert into dpg_app.audit_logs(user_id,action,entity_type,entity_id,auth_user_id,auth_session_id,request_id,idempotency_key_hash,changed_fields)
 values(v_actor.admin_id,case when p_product_id is null then 'leo542.product.created' else 'leo542.product.updated' end,'product',v_product.id,auth.uid(),v_actor.auth_session_id,p_request_id,v_key,array(select jsonb_object_keys(p_input)));
 v_result:=jsonb_build_object('id',v_product.id,'sku',v_product.sku,'publication_status',v_product.publication_status,'version',v_product.version,'updated_at',v_product.updated_at);
 update dpg_app.runtime_idempotency_records set safe_response=v_result,resource_id=v_product.id::text where owner_id=auth.uid() and operation='admin.product.put' and key_hash=v_key; return v_result;
end $$;

create or replace function public.leo542_admin_audit_list(p_limit integer default 50,p_offset integer default 0)
returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,dpg_app as $$
begin if not dpg_app.leo542_admin_can('audit:read') then raise exception 'FORBIDDEN'; end if;
 return jsonb_build_object(
  'admin',coalesce((select jsonb_agg(to_jsonb(x)) from (select id,user_id,action,entity_type,entity_id,request_id,changed_fields,created_at from dpg_app.audit_logs order by created_at desc,id desc limit p_limit offset p_offset)x),'[]'::jsonb),
  'publishing',coalesce((select jsonb_agg(to_jsonb(x)) from (select id,actor_kind,identity_id,admin_actor_id,action,post_id,request_id,from_version,to_version,from_state,to_state,changed_fields,created_at from dpg_app.publishing_audit_events order by created_at desc,id desc limit p_limit offset p_offset)x),'[]'::jsonb)
 ); end $$;

create or replace function public.leo542_publishing_post_list(p_limit integer default 25,p_offset integer default 0,p_status text default null)
returns jsonb language sql stable security invoker set search_path=pg_catalog,dpg_app as $$
 select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (
  select id,external_id,title,slug,status,version,published_at,updated_at from dpg_app.blog_posts
  where publishing_identity_id=(select machine_identity_id from dpg_app.leo542_actor_context()) and (p_status is null or status=p_status)
  order by updated_at desc,id desc limit p_limit offset p_offset
 )x
$$;
create or replace function public.leo542_publishing_post_get(p_post_id integer,p_external_id text default null)
returns jsonb language sql stable security invoker set search_path=pg_catalog,dpg_app as $$
 select to_jsonb(x) from (select * from dpg_app.blog_posts where publishing_identity_id=(select machine_identity_id from dpg_app.leo542_actor_context()) and ((p_post_id is not null and id=p_post_id) or (p_external_id is not null and external_id=p_external_id)))x
$$;
create or replace function public.leo542_publishing_post_put(p_post_id integer,p_expected_version integer,p_input jsonb,p_idempotency_key text,p_request_id uuid)
returns jsonb language plpgsql volatile security invoker set search_path=pg_catalog,dpg_app,extensions as $$
declare v_actor record; v_post dpg_app.blog_posts%rowtype; v_old dpg_app.blog_posts%rowtype; v_key char(64); v_hash char(64); v_existing record; v_result jsonb; v_status text; v_id uuid:=gen_random_uuid();
begin
 select * into v_actor from dpg_app.leo542_actor_context(); if not dpg_app.leo542_machine_can('posts:write') then raise exception 'FORBIDDEN'; end if;
 perform pg_advisory_xact_lock(hashtextextended('leo542:publishing-global-gate',0)); perform pg_advisory_xact_lock(hashtextextended('leo542:publishing-identity:'||v_actor.machine_identity_id,0));
 if not exists(select 1 from dpg_app.publishing_global_controls where id=1 and publishing_enabled) then raise exception 'PUBLISHING_DISABLED'; end if;
 if length(p_idempotency_key)<8 then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
 v_key:=encode(digest(p_idempotency_key,'sha256'),'hex'); v_hash:=encode(digest(p_input::text::bytea,'sha256'),'hex');
 insert into dpg_app.publishing_idempotency_records(id,identity_id,key_hash,request_hash,operation,status,safe_response,resource_type,resource_id,expires_at)
 values(v_id,v_actor.machine_identity_id,v_key,v_hash,'post.put','in_progress',null,'blog_post',coalesce(p_post_id::text,'pending'),now()+interval '30 days') on conflict(identity_id,key_hash) do nothing;
 if not found then select * into v_existing from dpg_app.publishing_idempotency_records where identity_id=v_actor.machine_identity_id and key_hash=v_key;
  if v_existing.request_hash<>v_hash then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if; if v_existing.status<>'completed' then raise exception 'IDEMPOTENCY_IN_PROGRESS'; end if; return v_existing.safe_response; end if;
 v_status:=coalesce(p_input->>'status','draft'); if v_status='published' and not dpg_app.leo542_machine_can('posts:publish') then raise exception 'FORBIDDEN'; end if;
 if p_post_id is null then
  insert into dpg_app.blog_posts(title,slug,excerpt,content,category_id,status,published_at,first_published_at,publishing_identity_id,external_id,version)
  values(p_input->>'title',p_input->>'slug',p_input->>'excerpt',coalesce(p_input->>'content',''),(p_input->>'category_id')::integer,v_status,case when v_status='published' then now() end,case when v_status='published' then now() end,v_actor.machine_identity_id,p_input->>'external_id',1) returning * into v_post;
 else
  select * into v_old from dpg_app.blog_posts where id=p_post_id and publishing_identity_id=v_actor.machine_identity_id for update; if not found then raise exception 'RESOURCE_NOT_FOUND'; end if;
  if p_expected_version is null or v_old.version<>p_expected_version then raise exception 'STALE_VERSION'; end if;
  update dpg_app.blog_posts set title=coalesce(p_input->>'title',title),slug=coalesce(p_input->>'slug',slug),excerpt=case when p_input?'excerpt' then p_input->>'excerpt' else excerpt end,content=coalesce(p_input->>'content',content),status=coalesce(p_input->>'status',status),published_at=case when coalesce(p_input->>'status',status)='published' then coalesce(published_at,now()) else published_at end,first_published_at=case when coalesce(p_input->>'status',status)='published' then coalesce(first_published_at,now()) else first_published_at end,version=version+1,updated_at=now() where id=p_post_id returning * into v_post;
 end if;
 insert into dpg_app.publishing_audit_events(actor_kind,identity_id,sponsor_user_id,action,post_id,external_id,request_id,idempotency_key_hash,from_version,to_version,from_state,to_state,changed_fields,content_hash,auth_user_id,auth_session_id)
 select 'machine',v_actor.machine_identity_id,m.sponsor_user_id,case when p_post_id is null then 'post.created' else 'post.updated' end,v_post.id,v_post.external_id,p_request_id,v_key,v_old.version,v_post.version,v_old.status,v_post.status,array(select jsonb_object_keys(p_input)),encode(digest(v_post.content::bytea,'sha256'),'hex'),auth.uid(),v_actor.auth_session_id from dpg_app.publishing_machine_identities m where m.id=v_actor.machine_identity_id;
 v_result:=jsonb_build_object('id',v_post.id,'external_id',v_post.external_id,'status',v_post.status,'version',v_post.version,'updated_at',v_post.updated_at);
 update dpg_app.publishing_idempotency_records set status='completed',response_status=200,safe_response=v_result,resource_id=v_post.id::text,completed_at=now() where id=v_id; return v_result;
end $$;

create or replace function public.leo542_publishing_media_list(p_limit integer default 25,p_offset integer default 0)
returns jsonb language sql stable security invoker set search_path=pg_catalog,dpg_app as $$
 select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (
  select id,purpose,status,source_mime,source_bytes,source_sha256,primary_url,variants,created_at,updated_at
  from dpg_app.publishing_managed_media where identity_id=(select machine_identity_id from dpg_app.leo542_actor_context())
  order by created_at desc,id limit p_limit offset p_offset
 )x
$$;
create or replace function public.leo542_publishing_media_reference(p_post_id integer,p_media_id uuid,p_usage text,p_idempotency_key text,p_request_id uuid)
returns jsonb language plpgsql volatile security invoker set search_path=pg_catalog,dpg_app,extensions as $$
declare v_actor record; v_post dpg_app.blog_posts%rowtype; v_key char(64); v_hash char(64); v_id uuid:=gen_random_uuid(); v_existing record; v_result jsonb;
begin
 select * into v_actor from dpg_app.leo542_actor_context(); if not dpg_app.leo542_machine_can('posts:write') then raise exception 'FORBIDDEN'; end if;
 perform pg_advisory_xact_lock(hashtextextended('leo542:publishing-post:'||p_post_id,0));
 select * into v_post from dpg_app.blog_posts where id=p_post_id and publishing_identity_id=v_actor.machine_identity_id for update; if not found then raise exception 'RESOURCE_NOT_FOUND'; end if;
 if not exists(select 1 from dpg_app.publishing_managed_media where id=p_media_id and identity_id=v_actor.machine_identity_id and status='ready') then raise exception 'MEDIA_NOT_READY'; end if;
 v_key:=encode(digest(p_idempotency_key,'sha256'),'hex'); v_hash:=encode(digest((p_post_id||':'||p_media_id||':'||p_usage)::bytea,'sha256'),'hex');
 insert into dpg_app.publishing_idempotency_records(id,identity_id,key_hash,request_hash,operation,status,safe_response,resource_type,resource_id,expires_at)
 values(v_id,v_actor.machine_identity_id,v_key,v_hash,'media.reference','in_progress',null,'blog_post',p_post_id::text,now()+interval '30 days') on conflict(identity_id,key_hash) do nothing;
 if not found then select * into v_existing from dpg_app.publishing_idempotency_records where identity_id=v_actor.machine_identity_id and key_hash=v_key;
  if v_existing.request_hash<>v_hash then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if; if v_existing.status<>'completed' then raise exception 'IDEMPOTENCY_IN_PROGRESS'; end if; return v_existing.safe_response; end if;
 insert into dpg_app.publishing_blog_post_media(post_id,media_id,usage) values(p_post_id,p_media_id,p_usage) on conflict do nothing;
 v_result:=jsonb_build_object('post_id',p_post_id,'media_id',p_media_id,'usage',p_usage,'preserved',true);
 insert into dpg_app.publishing_audit_events(actor_kind,identity_id,action,post_id,request_id,idempotency_key_hash,changed_fields,auth_user_id,auth_session_id)
 values('machine',v_actor.machine_identity_id,'media.referenced',p_post_id,p_request_id,v_key,array['media_reference'],auth.uid(),v_actor.auth_session_id);
 update dpg_app.publishing_idempotency_records set status='completed',response_status=200,safe_response=v_result,completed_at=now() where id=v_id; return v_result;
end $$;

-- Acceptance-only rollback probe: exact synthetic rows on the Preview target.
create or replace function public.leo542_acceptance_force_rollback(p_resource text,p_id integer)
returns void language plpgsql volatile security invoker set search_path=pg_catalog,dpg_app as $$
begin
 if not dpg_app.leo542_admin_can('audit:read') then raise exception 'FORBIDDEN'; end if;
 if not exists(select 1 from dpg_control.target_contract where singleton and environment='preview' and production_writes_allowed=false) then raise exception 'LEO542_TARGET_CONTRACT_FAILED'; end if;
 if p_resource='blog' then
  update dpg_app.blog_posts set excerpt='LEO542-ROLLBACK-PROBE',updated_at=now() where id=p_id and slug like 'leo542-%';
 elsif p_resource='product' then
  update dpg_app.products set description='LEO542-ROLLBACK-PROBE',updated_at=now() where id=p_id and source_system='leo542-synthetic';
 else raise exception 'INVALID_RESOURCE'; end if;
 if not found then raise exception 'RESOURCE_NOT_FOUND'; end if;
 raise exception 'LEO542_FORCED_ROLLBACK';
end $$;

revoke all on function public.leo542_admin_commerce_list(text,integer,integer), public.leo542_admin_commerce_get(text,integer), public.leo542_admin_commerce_patch(text,integer,jsonb,text,uuid),
 public.leo542_admin_content_snapshot(), public.leo542_admin_content_patch(text,integer,jsonb,text,uuid), public.leo542_admin_blog_list(integer,integer,text), public.leo542_admin_blog_get(integer), public.leo542_admin_blog_put(integer,integer,jsonb,text,uuid),
 public.leo542_admin_product_list(integer,integer,text), public.leo542_admin_product_get(integer), public.leo542_admin_product_put(integer,integer,jsonb,text,uuid), public.leo542_admin_audit_list(integer,integer),
 public.leo542_publishing_post_list(integer,integer,text), public.leo542_publishing_post_get(integer,text), public.leo542_publishing_post_put(integer,integer,jsonb,text,uuid),
 public.leo542_publishing_media_list(integer,integer), public.leo542_publishing_media_reference(integer,uuid,text,text,uuid), public.leo542_acceptance_force_rollback(text,integer)
 from public, anon, service_role;
grant execute on function public.leo542_admin_commerce_list(text,integer,integer), public.leo542_admin_commerce_get(text,integer), public.leo542_admin_commerce_patch(text,integer,jsonb,text,uuid),
 public.leo542_admin_content_snapshot(), public.leo542_admin_content_patch(text,integer,jsonb,text,uuid), public.leo542_admin_blog_list(integer,integer,text), public.leo542_admin_blog_get(integer), public.leo542_admin_blog_put(integer,integer,jsonb,text,uuid),
 public.leo542_admin_product_list(integer,integer,text), public.leo542_admin_product_get(integer), public.leo542_admin_product_put(integer,integer,jsonb,text,uuid), public.leo542_admin_audit_list(integer,integer),
 public.leo542_publishing_post_list(integer,integer,text), public.leo542_publishing_post_get(integer,text), public.leo542_publishing_post_put(integer,integer,jsonb,text,uuid),
 public.leo542_publishing_media_list(integer,integer), public.leo542_publishing_media_reference(integer,uuid,text,text,uuid), public.leo542_acceptance_force_rollback(text,integer)
 to authenticated;

commit;
