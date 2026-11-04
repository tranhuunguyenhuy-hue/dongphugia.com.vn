-- Phase 2 Admin order inbox for guest order requests.
-- Source only. Do not apply until Issue #270 target, backup/restore, and
-- migration-history reconciliation gates have passed.

do $target_preflight$
begin
  if to_regclass('dpg_control.target_contract') is null
     or not exists (
       select 1 from dpg_control.target_contract
       where singleton
         and project_name = 'dongphugia-runtime'
         and region = 'ap-southeast-1'
         and environment = 'preview'
         and data_class = 'production-derived-reduced-runtime'
         and production_data_allowed
         and not production_credentials_allowed
         and not production_writes_allowed
         and hard_database_ceiling_bytes = 367001600
         and pg_database_size(current_database()) <= hard_database_ceiling_bytes
     ) then
    raise exception 'DPG_PHASE2_ADMIN_TARGET_CONTRACT_FAILED';
  end if;

  if to_regprocedure('dpg_app.leo542_actor_context()') is null
     or to_regprocedure('dpg_app.leo542_admin_can(text)') is null
     or to_regprocedure('public.guest_order_request_create(jsonb,text,uuid)') is null
     or to_regclass('dpg_app.guest_order_idempotency_records') is null
     or not exists (
       select 1 from information_schema.columns
       where table_schema = 'dpg_app' and table_name = 'admin_users'
         and column_name = 'supabase_auth_user_id'
     )
     or not exists (
       select 1 from information_schema.columns
       where table_schema = 'dpg_app' and table_name = 'orders'
         and column_name = 'order_origin'
     )
     or not exists (
       select 1 from information_schema.columns
       where table_schema = 'dpg_app' and table_name = 'orders'
         and column_name = 'shipping_fee_status'
     )
     or not exists (
       select 1 from information_schema.columns
       where table_schema = 'dpg_app' and table_name = 'order_items'
         and column_name = 'commercial_snapshot'
     )
     or not exists (
       select 1 from information_schema.columns
       where table_schema = 'dpg_app' and table_name = 'audit_logs'
         and column_name in ('auth_user_id', 'auth_session_id', 'request_id', 'idempotency_key_hash', 'changed_fields')
       group by table_schema, table_name having count(*) = 5
     )
     or (
       select count(*) from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'dpg_app'
         and c.relname in ('orders', 'audit_logs')
         and c.relrowsecurity and c.relforcerowsecurity
     ) <> 2 then
    raise exception 'DPG_PHASE2_ADMIN_BASELINE_MISSING';
  end if;

  if has_schema_privilege('dpg_migration', 'public', 'CREATE')
     or not has_schema_privilege('dpg_migration', 'public', 'USAGE')
     or not has_schema_privilege('dpg_migration', 'dpg_app', 'USAGE')
     or not has_schema_privilege(current_user, 'public', 'CREATE')
     or not exists (
       select 1 from pg_roles
       where rolname = 'dpg_migration'
         and not rolsuper and not rolbypassrls and not rolcanlogin
         and not rolcreatedb and not rolcreaterole and not rolreplication and not rolinherit
     )
     or not has_table_privilege('dpg_migration', 'dpg_app.orders', 'SELECT')
     or not has_table_privilege('dpg_migration', 'dpg_app.orders', 'UPDATE')
     or not has_table_privilege('dpg_migration', 'dpg_app.order_items', 'SELECT')
     or not has_table_privilege('dpg_migration', 'dpg_app.audit_logs', 'INSERT')
     or not has_table_privilege('authenticated', 'dpg_app.orders', 'UPDATE') then
    raise exception 'DPG_PHASE2_ADMIN_PRIVILEGE_BASELINE_MISMATCH';
  end if;

  if to_regclass('dpg_app.phase2_admin_order_status_idempotency') is not null
     or to_regprocedure('public.phase2_admin_staff_context()') is not null
     or to_regprocedure('public.phase2_admin_order_list(text,integer,integer)') is not null
     or to_regprocedure('public.phase2_admin_order_get(integer)') is not null
     or to_regprocedure('public.phase2_admin_order_update_status(integer,text,text,uuid)') is not null
     or to_regprocedure('dpg_app.phase2_guard_order_status_update()') is not null
     or exists (
       select 1 from pg_trigger t
       join pg_class c on c.oid = t.tgrelid
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'dpg_app' and c.relname = 'orders'
         and t.tgname = 'phase2_order_status_guard' and not t.tgisinternal
     ) then
    raise exception 'DPG_PHASE2_ADMIN_MIGRATION_ALREADY_PRESENT';
  end if;
end
$target_preflight$;

set role dpg_migration;
set search_path = pg_catalog, dpg_app, public, auth;

create table dpg_app.phase2_admin_order_status_idempotency (
  auth_user_id uuid not null,
  key_hash char(64) not null,
  request_hash char(64) not null,
  safe_response jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (auth_user_id, key_hash)
);

alter table dpg_app.phase2_admin_order_status_idempotency owner to dpg_migration;
alter table dpg_app.phase2_admin_order_status_idempotency enable row level security;
alter table dpg_app.phase2_admin_order_status_idempotency force row level security;
revoke all on table dpg_app.phase2_admin_order_status_idempotency
  from public, anon, authenticated, service_role;
create policy phase2_admin_order_status_idempotency_all
  on dpg_app.phase2_admin_order_status_idempotency
  for all to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

revoke update on table dpg_app.orders from authenticated;
revoke update (status, updated_at, payment_status, assigned_to, internal_note) on table dpg_app.orders from authenticated;
grant update (status, updated_at, payment_status, assigned_to, internal_note) on table dpg_app.orders to authenticated;
grant select, insert, update, delete
  on table dpg_app.phase2_admin_order_status_idempotency to authenticated;

create function dpg_app.phase2_guard_order_status_update()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, dpg_app, auth
as $$
declare
  v_actor record;
  v_request_id text := nullif(current_setting('dpg.phase2.order_status_request_id', true), '');
  v_key_hash text := nullif(current_setting('dpg.phase2.order_status_key_hash', true), '');
begin
  -- Preserve the existing LEO-542 lifecycle for legacy orders. Phase 2 rules
  -- apply only once the order is explicitly tagged as a public guest request.
  if old.order_origin is distinct from 'public_web' and new.order_origin is distinct from 'public_web' then
    return new;
  end if;
  if old.order_origin is distinct from 'public_web' or new.order_origin is distinct from 'public_web' then
    raise exception 'INVALID_ORDER_ORIGIN_TRANSITION';
  end if;
  if new.payment_status is distinct from old.payment_status then
    raise exception 'PHASE2_PAYMENT_CONFIRMATION_OUT_OF_SCOPE';
  end if;
  if new.status is not distinct from old.status then return new; end if;
  if not (
    (old.status = 'pending' and new.status in ('received', 'cancelled'))
    or (old.status = 'received' and new.status = 'cancelled')
  ) then
    raise exception 'INVALID_ORDER_TRANSITION';
  end if;
  if v_request_id is null
     or v_request_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or v_key_hash is null
     or v_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'PHASE2_STATUS_RPC_REQUIRED';
  end if;

  select * into v_actor from dpg_app.leo542_actor_context();
  if v_actor.actor_kind <> 'admin' or not dpg_app.leo542_admin_can('orders:update_status') then
    raise exception 'FORBIDDEN';
  end if;

  insert into dpg_app.audit_logs (
    user_id, action, entity_type, entity_id, auth_user_id, auth_session_id,
    request_id, idempotency_key_hash, changed_fields
  ) values (
    v_actor.admin_id, 'phase2.order.status.updated', 'order', new.id,
    auth.uid(), v_actor.auth_session_id, v_request_id::uuid, v_key_hash, array['status']
  );
  return new;
end
$$;

alter function dpg_app.phase2_guard_order_status_update() owner to dpg_migration;
revoke all on function dpg_app.phase2_guard_order_status_update()
  from public, anon, authenticated, service_role;
create trigger phase2_order_status_guard
before update of status, payment_status on dpg_app.orders
for each row execute function dpg_app.phase2_guard_order_status_update();

reset role;
grant create on schema public to dpg_migration;
set role dpg_migration;
set search_path = pg_catalog, dpg_app, public, auth;

create function public.phase2_admin_staff_context()
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, dpg_app, auth
as $$
declare
  v_actor record;
  v_staff record;
  v_capabilities text[];
begin
  select * into v_actor from dpg_app.leo542_actor_context();
  if v_actor.actor_kind <> 'admin' then raise exception 'FORBIDDEN'; end if;

  select a.email, a.name, a.role
    into v_staff
  from dpg_app.admin_users a
  where a.id = v_actor.admin_id
    and a.supabase_auth_user_id = v_actor.auth_user_id
    and a.is_active;
  if not found then raise exception 'FORBIDDEN'; end if;

  select array_agg(capability order by capability)
    into v_capabilities
  from unnest(array[
    'orders:read', 'orders:read_assigned', 'orders:update_status',
    'orders:assign', 'orders:cancel', 'orders:edit_note',
    'quotes:read', 'quotes:read_assigned', 'quotes:create', 'quotes:update',
    'customers:read', 'customers:write', 'products:read', 'products:write',
    'products:publish', 'categories:read', 'categories:write',
    'brands:read', 'brands:write', 'taxonomy:read', 'taxonomy:write',
    'product_types:read', 'product_types:write', 'specifications:read',
    'specifications:write', 'documents:read', 'documents:write',
    'commerce:write', 'visibility:write', 'seo:write', 'blog:read',
    'blog:write', 'blog:publish', 'media:reference', 'users:read',
    'dashboard:read', 'dashboard:read_own', 'reports:read', 'audit:read'
  ]) as capability
  where dpg_app.leo542_admin_can(capability);

  return jsonb_build_object(
    'auth_user_id', v_actor.auth_user_id,
    'email', v_staff.email,
    'display_name', v_staff.name,
    'status', 'active',
    'roles', jsonb_build_array(v_staff.role),
    'capabilities', to_jsonb(coalesce(v_capabilities, array[]::text[]))
  );
end
$$;

create function public.phase2_admin_order_list(
  p_status text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, dpg_app
as $$
declare
  v_actor record;
begin
  select * into v_actor from dpg_app.leo542_actor_context();
  if v_actor.actor_kind <> 'admin'
     or not (dpg_app.leo542_admin_can('orders:read') or dpg_app.leo542_admin_can('orders:read_assigned')) then
    raise exception 'FORBIDDEN';
  end if;
  if p_status is not null and p_status not in ('pending', 'received', 'confirmed', 'inventory_check', 'completed', 'cancelled') then
    raise exception 'INVALID_ORDER_STATUS';
  end if;
  if p_limit is null or p_offset is null or p_limit < 1 or p_limit > 50 or p_offset < 0 or p_offset > 10000 then
    raise exception 'INVALID_PAGINATION';
  end if;

  return jsonb_build_object(
    'orders', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc, x.id desc)
      from (
        select o.id, o.order_number, o.customer_name, o.customer_phone,
          o.status, o.payment_status, o.total, o.shipping_fee_status, o.assigned_to, o.created_at
        from dpg_app.orders o
        where o.order_origin = 'public_web'
          and (p_status is null or o.status = p_status)
        order by o.created_at desc, o.id desc
        limit p_limit offset p_offset
      ) x
    ), '[]'::jsonb),
    'total', (
      select count(*)
      from dpg_app.orders o
      where o.order_origin = 'public_web'
        and (p_status is null or o.status = p_status)
    )
  );
end
$$;

create function public.phase2_admin_order_get(p_order_id integer)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, dpg_app
as $$
declare
  v_order jsonb;
  v_items jsonb;
begin
  select to_jsonb(x) into v_order
  from (
    select o.id, o.order_number, o.customer_name, o.customer_phone,
      o.customer_email, o.customer_address, o.note, o.status,
      o.payment_status, o.subtotal, o.discount, o.shipping_fee, o.shipping_fee_status, o.total,
      o.assigned_to, o.internal_note, o.created_at, o.updated_at
    from dpg_app.orders o
    where o.id = p_order_id and o.order_origin = 'public_web'
  ) x;
  if v_order is null then return null; end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.id), '[]'::jsonb)
    into v_items
  from (
    select i.id, i.product_id, i.product_name, i.product_sku,
      i.quantity, i.unit_price, i.total_price, i.commercial_snapshot
    from dpg_app.order_items i
    where i.order_id = p_order_id
  ) x;

  return jsonb_build_object('order', v_order, 'items', v_items);
end
$$;

create function public.phase2_admin_order_update_status(
  p_order_id integer,
  p_status text,
  p_idempotency_key text,
  p_request_id uuid
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, dpg_app, auth
as $$
declare
  v_actor record;
  v_key_hash char(64);
  v_request_hash char(64);
  v_existing dpg_app.phase2_admin_order_status_idempotency%rowtype;
  v_order dpg_app.orders%rowtype;
  v_response jsonb;
begin
  if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
  if p_order_id is null or p_order_id < 1
     or p_request_id is null
     or length(btrim(coalesce(p_idempotency_key, ''))) not between 8 and 200 then
    raise exception 'INVALID_INPUT';
  end if;
  if p_status is null or p_status not in ('received', 'cancelled') then raise exception 'INVALID_ORDER_STATUS'; end if;

  select * into v_actor from dpg_app.leo542_actor_context();
  if v_actor.actor_kind <> 'admin' or not dpg_app.leo542_admin_can('orders:update_status') then
    raise exception 'FORBIDDEN';
  end if;

  v_key_hash := dpg_app.runtime_key_hash(btrim(p_idempotency_key));
  v_request_hash := dpg_app.runtime_hash(jsonb_build_object(
    'order_id', p_order_id, 'status', p_status
  ));
  perform pg_advisory_xact_lock(hashtextextended('phase2:admin-order-status:' || auth.uid()::text || ':' || v_key_hash, 0));

  with expired_keys as (
    select auth_user_id, key_hash
    from dpg_app.phase2_admin_order_status_idempotency
    where expires_at <= now()
    order by expires_at
    limit 100
    for update skip locked
  )
  delete from dpg_app.phase2_admin_order_status_idempotency r
  using expired_keys e
  where r.auth_user_id = e.auth_user_id and r.key_hash = e.key_hash;

  select * into v_existing
  from dpg_app.phase2_admin_order_status_idempotency
  where auth_user_id = auth.uid() and key_hash = v_key_hash
  for update;
  if found then
    if v_existing.request_hash <> v_request_hash then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
    return v_existing.safe_response;
  end if;

  select * into v_order
  from dpg_app.orders
  where id = p_order_id and order_origin = 'public_web'
  for update;
  if not found then raise exception 'RESOURCE_NOT_FOUND'; end if;
  if not (
    (v_order.status = 'pending' and p_status in ('received', 'cancelled'))
    or (v_order.status = 'received' and p_status = 'cancelled')
  ) then raise exception 'INVALID_ORDER_TRANSITION'; end if;

  perform set_config('dpg.phase2.order_status_request_id', p_request_id::text, true);
  perform set_config('dpg.phase2.order_status_key_hash', v_key_hash, true);
  update dpg_app.orders
  set status = p_status, updated_at = now()
  where id = p_order_id
  returning * into v_order;

  v_response := jsonb_build_object(
    'id', v_order.id, 'order_number', v_order.order_number,
    'status', v_order.status, 'payment_status', v_order.payment_status,
    'updated_at', v_order.updated_at
  );
  insert into dpg_app.phase2_admin_order_status_idempotency (
    auth_user_id, key_hash, request_hash, safe_response, expires_at
  ) values (
    auth.uid(), v_key_hash, v_request_hash, v_response, now() + interval '24 hours'
  );
  return v_response;
end
$$;

reset role;
revoke create on schema public from dpg_migration;

alter function public.phase2_admin_order_update_status(integer,text,text,uuid) owner to dpg_migration;
comment on function public.phase2_admin_order_update_status(integer,text,text,uuid) is
  'Staff-only SECURITY INVOKER transition RPC: capability checks, forced RLS, restricted order columns, idempotency, and audit trigger are applied atomically.';
revoke all on function public.phase2_admin_staff_context(),
  public.phase2_admin_order_list(text,integer,integer),
  public.phase2_admin_order_get(integer),
  public.phase2_admin_order_update_status(integer,text,text,uuid)
  from public, anon, service_role;
grant execute on function public.phase2_admin_staff_context(),
  public.phase2_admin_order_list(text,integer,integer),
  public.phase2_admin_order_get(integer),
  public.phase2_admin_order_update_status(integer,text,text,uuid)
  to authenticated;

-- dpg_app is intentionally absent from PostgREST exposed schemas. The public
-- RPC runs as the authenticated caller and receives only the columns and
-- owner-bound idempotency rows required for this transition.

do $postflight$
begin
  if not exists (
       select 1 from pg_proc p
       where p.oid = 'public.phase2_admin_order_update_status(integer,text,text,uuid)'::regprocedure
         and not p.prosecdef and pg_get_userbyid(p.proowner) = 'dpg_migration'
     )
     or has_schema_privilege('dpg_migration', 'public', 'CREATE')
     or has_table_privilege('authenticated', 'dpg_app.orders', 'UPDATE')
     or not has_column_privilege('authenticated', 'dpg_app.orders', 'status', 'UPDATE')
     or not has_column_privilege('authenticated', 'dpg_app.orders', 'updated_at', 'UPDATE')
     or not has_column_privilege('authenticated', 'dpg_app.orders', 'payment_status', 'UPDATE')
     or not has_column_privilege('authenticated', 'dpg_app.orders', 'assigned_to', 'UPDATE')
     or not has_column_privilege('authenticated', 'dpg_app.orders', 'internal_note', 'UPDATE')
     or exists (
       select 1 from information_schema.column_privileges
       where grantee = 'authenticated'
         and table_schema = 'dpg_app'
         and table_name = 'orders'
         and privilege_type = 'UPDATE'
         and column_name not in ('status', 'updated_at', 'payment_status', 'assigned_to', 'internal_note')
     )
     or has_table_privilege('anon', 'dpg_app.phase2_admin_order_status_idempotency', 'SELECT')
     or has_table_privilege('anon', 'dpg_app.phase2_admin_order_status_idempotency', 'INSERT')
     or has_table_privilege('anon', 'dpg_app.phase2_admin_order_status_idempotency', 'UPDATE')
     or has_table_privilege('anon', 'dpg_app.phase2_admin_order_status_idempotency', 'DELETE')
     or not has_table_privilege('authenticated', 'dpg_app.phase2_admin_order_status_idempotency', 'SELECT')
     or not has_table_privilege('authenticated', 'dpg_app.phase2_admin_order_status_idempotency', 'INSERT')
     or not has_table_privilege('authenticated', 'dpg_app.phase2_admin_order_status_idempotency', 'UPDATE')
     or not has_table_privilege('authenticated', 'dpg_app.phase2_admin_order_status_idempotency', 'DELETE')
     or not exists (
       select 1 from pg_trigger t
       join pg_class c on c.oid = t.tgrelid
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'dpg_app'
         and c.relname = 'orders'
         and t.tgname = 'phase2_order_status_guard'
         and not t.tgisinternal
         and t.tgenabled = 'O'
     )
     or not exists (
       select 1 from pg_proc p
       where p.oid = 'dpg_app.phase2_guard_order_status_update()'::regprocedure
         and not p.prosecdef and pg_get_userbyid(p.proowner) = 'dpg_migration'
     )
     or has_function_privilege('anon', 'dpg_app.phase2_guard_order_status_update()', 'EXECUTE')
     or has_function_privilege('authenticated', 'dpg_app.phase2_guard_order_status_update()', 'EXECUTE')
     or (
       select count(*) from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'dpg_app'
         and c.relname in ('orders', 'audit_logs')
         and c.relrowsecurity and c.relforcerowsecurity
     ) <> 2
     or not has_function_privilege('authenticated', 'public.phase2_admin_order_update_status(integer,text,text,uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.phase2_admin_order_update_status(integer,text,text,uuid)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.phase2_admin_order_update_status(integer,text,text,uuid)', 'EXECUTE') then
    raise exception 'DPG_PHASE2_ADMIN_POSTFLIGHT_FAILED';
  end if;
end
$postflight$;
