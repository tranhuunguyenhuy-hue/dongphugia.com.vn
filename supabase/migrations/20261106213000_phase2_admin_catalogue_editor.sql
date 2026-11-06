-- Phase 2 Admin: capability-checked Product editor and verified option edits.
-- Source only. Do not apply to hosted databases without the exact Owner gate.

do $preflight$
begin
  if to_regclass('dpg_app.products') is null
     or to_regclass('dpg_app.product_variant_groups') is null
     or to_regclass('dpg_app.runtime_idempotency_records') is null
     or to_regclass('dpg_app.audit_logs') is null
     or to_regprocedure('dpg_app.leo542_actor_context()') is null
     or to_regprocedure('dpg_app.leo542_admin_can(text)') is null
     or has_schema_privilege('dpg_migration', 'public', 'CREATE')
     or not has_schema_privilege('dpg_migration', 'public', 'USAGE')
     or not has_schema_privilege('dpg_migration', 'dpg_app', 'USAGE')
     or not has_schema_privilege(current_user, 'public', 'CREATE')
     or to_regprocedure('public.phase2_admin_product_catalogue(integer,text,text,integer,integer)') is not null
     or to_regprocedure('public.phase2_admin_product_update(integer,integer,jsonb,text,uuid)') is not null then
    raise exception 'DPG_PHASE2_ADMIN_CATALOGUE_PREFLIGHT_FAILED';
  end if;
end
$preflight$;

grant create on schema public to dpg_migration;
set role dpg_migration;
set search_path = pg_catalog, dpg_app, public;

create function public.phase2_admin_product_catalogue(
  p_product_id integer default null,
  p_search text default null,
  p_publication_status text default null,
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
  v_search text := lower(btrim(coalesce(p_search, '')));
begin
  select * into v_actor from dpg_app.leo542_actor_context();
  if v_actor.actor_kind <> 'admin' or not dpg_app.leo542_admin_can('products:read') then
    raise exception 'FORBIDDEN';
  end if;
  if p_product_id is not null and p_product_id < 1 then raise exception 'INVALID_PRODUCT_ID'; end if;
  if length(v_search) > 100 then raise exception 'INVALID_SEARCH'; end if;
  if p_publication_status is not null and length(p_publication_status) > 30 then raise exception 'INVALID_PRODUCT_STATUS'; end if;
  if p_limit is null or p_offset is null or p_limit < 1 or p_limit > 50 or p_offset < 0 or p_offset > 10000 then
    raise exception 'INVALID_PAGINATION';
  end if;

  return jsonb_build_object(
    'products', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.updated_at desc, x.id desc)
      from (
        select p.id, p.sku, p.name, p.display_name, p.slug, p.description, p.price, p.original_price,
          p.list_price, p.sale_price, p.online_discount_amount, p.price_state, p.price_confidence,
          p.publication_status, p.is_active, p.pdp_visibility, p.listing_visibility,
          p.search_visibility, p.seo_indexing, p.sitemap_include, p.image_main_url,
          p.variant_group, p.variant_group_id, p.variant_type, p.variant_label, p.variant_options,
          case when jsonb_typeof(vg.axes) = 'array' then vg.axes else '[]'::jsonb end as variant_axes,
          coalesce(vg.confidence = 'high' and vg.source like 'hita-normalized-%'
            and vg.variant_type in ('size', 'seat_type')
            and jsonb_typeof(vg.axes) = 'array'
            and (case when jsonb_typeof(vg.axes) = 'array' then jsonb_array_length(vg.axes) else -1 end = 0
              or (case when jsonb_typeof(vg.axes) = 'array' then jsonb_array_length(vg.axes) else -1 end = 1
                and vg.axes->0->>'key' = vg.variant_type))
            and (select count(*) from dpg_app.products member
              where member.variant_group_id = vg.id and member.variant_group = vg.group_key) between 2 and 8
            and (select count(distinct lower(coalesce(member.variant_options->0->>'value', member.variant_label)))
              from dpg_app.products member where member.variant_group_id = vg.id and member.variant_group = vg.group_key)
              = (select count(*) from dpg_app.products member where member.variant_group_id = vg.id and member.variant_group = vg.group_key)
            and not exists (select 1 from dpg_app.products member
              where member.variant_group_id = vg.id and member.variant_group = vg.group_key
                and (member.variant_type <> vg.variant_type or member.variant_label is null
                  or jsonb_typeof(member.variant_options) is distinct from 'array'
                  or (case when jsonb_typeof(member.variant_options) = 'array' then jsonb_array_length(member.variant_options) else -1 end) > 1
                  or (case when jsonb_typeof(member.variant_options) = 'array' then jsonb_array_length(member.variant_options) else -1 end = 1
                    and (member.variant_options->0->>'axis' <> vg.variant_type
                      or member.variant_options->0->>'label' <> member.variant_label)))), false) as variant_options_editable,
          p.version, p.updated_at
        from dpg_app.products p
        left join dpg_app.product_variant_groups vg on vg.id = p.variant_group_id
          and vg.group_key = p.variant_group
        where (p_product_id is null or p.id = p_product_id)
          and (p_publication_status is null or p.publication_status = p_publication_status)
          and (v_search = '' or strpos(lower(coalesce(p.sku, '')), v_search) > 0
            or strpos(lower(coalesce(p.name, '')), v_search) > 0
            or strpos(lower(coalesce(p.slug, '')), v_search) > 0)
        order by p.updated_at desc, p.id desc
        limit p_limit offset p_offset
      ) x
    ), '[]'::jsonb),
    'total', (
      select count(*)
      from dpg_app.products p
      where (p_product_id is null or p.id = p_product_id)
        and (p_publication_status is null or p.publication_status = p_publication_status)
        and (v_search = '' or strpos(lower(coalesce(p.sku, '')), v_search) > 0
          or strpos(lower(coalesce(p.name, '')), v_search) > 0
          or strpos(lower(coalesce(p.slug, '')), v_search) > 0)
    )
  );
end
$$;

create function public.phase2_admin_product_update(
  p_product_id integer,
  p_expected_version integer,
  p_input jsonb,
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
  v_old dpg_app.products%rowtype;
  v_product dpg_app.products%rowtype;
  v_existing dpg_app.runtime_idempotency_records%rowtype;
  v_group dpg_app.product_variant_groups%rowtype;
  v_key_hash char(64);
  v_request_hash char(64);
  v_price numeric;
  v_sale numeric;
  v_discount numeric;
  v_label text;
  v_option jsonb;
  v_options jsonb;
  v_value text;
  v_fields text[];
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
  if p_product_id is null or p_product_id < 1 or p_expected_version is null or p_expected_version < 1
     or p_request_id is null or length(btrim(coalesce(p_idempotency_key, ''))) not between 8 and 200
     or p_input is null or jsonb_typeof(p_input) <> 'object' or p_input = '{}'::jsonb then
    raise exception 'INVALID_INPUT';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_input) as k(key)
    where key <> all(array[
      'display_name','description','price','sale_price','online_discount_amount','publication_status','is_active',
      'pdp_visibility','listing_visibility','search_visibility','seo_indexing','sitemap_include',
      'variant_label','variant_options'
    ])
  ) then raise exception 'INVALID_PRODUCT_FIELDS'; end if;

  select * into v_actor from dpg_app.leo542_actor_context();
  if v_actor.actor_kind <> 'admin' or not dpg_app.leo542_admin_can('products:write') then raise exception 'FORBIDDEN'; end if;

  if p_input ?| array['price','sale_price','online_discount_amount']
     and not dpg_app.leo542_admin_can('commerce:write') then raise exception 'FORBIDDEN'; end if;
  if p_input ?| array['pdp_visibility','listing_visibility','search_visibility']
     and not dpg_app.leo542_admin_can('visibility:write') then raise exception 'FORBIDDEN'; end if;
  if p_input ?| array['seo_indexing','sitemap_include']
     and not dpg_app.leo542_admin_can('seo:write') then raise exception 'FORBIDDEN'; end if;
  if p_input->>'publication_status' = 'public'
     and not dpg_app.leo542_admin_can('products:publish') then raise exception 'FORBIDDEN'; end if;

  v_key_hash := dpg_app.runtime_key_hash(btrim(p_idempotency_key));
  v_request_hash := dpg_app.runtime_hash(jsonb_build_object(
    'product_id', p_product_id, 'expected_version', p_expected_version, 'input', p_input
  ));
  perform pg_advisory_xact_lock(hashtextextended('phase2:admin-product:' || auth.uid()::text || ':' || v_key_hash, 0));
  insert into dpg_app.runtime_idempotency_records(
    owner_id, operation, key_hash, request_hash, safe_response, resource_type, resource_id, expires_at
  ) values (
    auth.uid(), 'phase2.admin.product.update', v_key_hash, v_request_hash, '{}'::jsonb,
    'product', p_product_id::text, now() + interval '24 hours'
  ) on conflict do nothing;
  if not found then
    select * into v_existing from dpg_app.runtime_idempotency_records
    where owner_id = auth.uid() and operation = 'phase2.admin.product.update' and key_hash = v_key_hash for update;
    if v_existing.request_hash <> v_request_hash then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
    if v_existing.safe_response = '{}'::jsonb then raise exception 'IDEMPOTENCY_IN_PROGRESS'; end if;
    return v_existing.safe_response;
  end if;

  if p_input ? 'publication_status' and (jsonb_typeof(p_input->'publication_status') is distinct from 'string'
     or p_input->>'publication_status' not in ('draft','public')) then raise exception 'INVALID_PRODUCT_STATUS'; end if;
  if p_input ? 'display_name' and (jsonb_typeof(p_input->'display_name') is distinct from 'string'
     or length(btrim(p_input->>'display_name')) not between 1 and 500
     or p_input->>'display_name' ~ '[[:cntrl:]]') then raise exception 'INVALID_PRODUCT_NAME'; end if;
  if p_input ? 'description' and (jsonb_typeof(p_input->'description') not in ('string','null')
     or length(coalesce(p_input->>'description','')) > 20000) then raise exception 'INVALID_PRODUCT_DESCRIPTION'; end if;
  if p_input ? 'is_active' and jsonb_typeof(p_input->'is_active') is distinct from 'boolean' then raise exception 'INVALID_PRODUCT_STATUS'; end if;
  if p_input ? 'sitemap_include' and jsonb_typeof(p_input->'sitemap_include') is distinct from 'boolean' then raise exception 'INVALID_PRODUCT_STATUS'; end if;
  if p_input ? 'pdp_visibility' and (jsonb_typeof(p_input->'pdp_visibility') is distinct from 'string'
     or p_input->>'pdp_visibility' not in ('public','hidden')) then raise exception 'INVALID_PRODUCT_VISIBILITY'; end if;
  if p_input ? 'listing_visibility' and (jsonb_typeof(p_input->'listing_visibility') is distinct from 'string'
     or p_input->>'listing_visibility' not in ('default','public','hidden')) then raise exception 'INVALID_PRODUCT_VISIBILITY'; end if;
  if p_input ? 'search_visibility' and (jsonb_typeof(p_input->'search_visibility') is distinct from 'string'
     or p_input->>'search_visibility' not in ('visible','hidden')) then raise exception 'INVALID_PRODUCT_VISIBILITY'; end if;
  if p_input ? 'seo_indexing' and (jsonb_typeof(p_input->'seo_indexing') is distinct from 'string'
     or p_input->>'seo_indexing' not in ('index','noindex')) then raise exception 'INVALID_SEO_STATE'; end if;

  v_price := null;
  v_sale := null;
  v_discount := null;
  select * into v_old from dpg_app.products where id = p_product_id for update;
  if not found then raise exception 'RESOURCE_NOT_FOUND'; end if;
  if v_old.version <> p_expected_version then raise exception 'STALE_VERSION'; end if;
  v_price := v_old.price;
  v_sale := v_old.sale_price;
  v_discount := v_old.online_discount_amount;
  if p_input ? 'price' then
    if jsonb_typeof(p_input->'price') not in ('number','null') then raise exception 'INVALID_PRICE'; end if;
    v_price := nullif(p_input->>'price','')::numeric;
  end if;
  if p_input ? 'sale_price' then
    if jsonb_typeof(p_input->'sale_price') not in ('number','null') then raise exception 'INVALID_PRICE'; end if;
    v_sale := nullif(p_input->>'sale_price','')::numeric;
  end if;
  if p_input ? 'online_discount_amount' then
    if jsonb_typeof(p_input->'online_discount_amount') not in ('number','null') then raise exception 'INVALID_PRICE'; end if;
    v_discount := nullif(p_input->>'online_discount_amount','')::numeric;
  end if;
  if (v_price is not null and (v_price < 0 or v_price > 1000000000 or v_price <> trunc(v_price)))
     or (v_sale is not null and (v_sale < 0 or v_sale > 1000000000 or v_sale <> trunc(v_sale)))
     or (v_discount is not null and (v_discount < 0 or v_discount > 1000000000 or v_discount <> trunc(v_discount)))
     or (v_sale is not null and v_price is not null and v_sale >= v_price)
     or (v_discount is not null and v_discount > coalesce(v_sale, v_price, 0)) then
    raise exception 'INVALID_PRICE';
  end if;

  if p_input ? 'variant_label' or p_input ? 'variant_options' then
    if v_old.variant_group_id is null or v_old.variant_group is null
       or v_old.variant_type not in ('size','seat_type') then raise exception 'VARIANT_GROUP_NOT_VERIFIED'; end if;
    perform pg_advisory_xact_lock(hashtextextended(
      'phase2:admin-product-variant-group:' || v_old.variant_group_id::text, 0
    ));
    select * into v_group from dpg_app.product_variant_groups vg
      where vg.id = v_old.variant_group_id and vg.group_key = v_old.variant_group;
    if not found or v_group.confidence <> 'high' or v_group.source not like 'hita-normalized-%'
       or v_group.variant_type <> v_old.variant_type
       or jsonb_typeof(v_group.axes) is distinct from 'array'
       or (case when jsonb_typeof(v_group.axes) = 'array' then jsonb_array_length(v_group.axes) else -1 end) > 1
       or (case when jsonb_typeof(v_group.axes) = 'array' then jsonb_array_length(v_group.axes) else -1 end = 1
         and v_group.axes->0->>'key' <> v_group.variant_type)
       or (select count(*) from dpg_app.products member where member.variant_group_id = v_group.id and member.variant_group = v_group.group_key) not between 2 and 8
       or (select count(distinct lower(coalesce(member.variant_options->0->>'value', member.variant_label)))
            from dpg_app.products member where member.variant_group_id = v_group.id and member.variant_group = v_group.group_key)
          <> (select count(*) from dpg_app.products member where member.variant_group_id = v_group.id and member.variant_group = v_group.group_key)
       then raise exception 'VARIANT_GROUP_NOT_VERIFIED'; end if;
    if exists (
      select 1 from dpg_app.products member
      where member.variant_group_id = v_group.id and member.variant_group = v_group.group_key
        and (member.variant_type <> v_group.variant_type or member.variant_label is null
          or jsonb_typeof(member.variant_options) is distinct from 'array'
          or (case when jsonb_typeof(member.variant_options) = 'array' then jsonb_array_length(member.variant_options) else -1 end) > 1
          or (case when jsonb_typeof(member.variant_options) = 'array' then jsonb_array_length(member.variant_options) else -1 end = 1
            and (member.variant_options->0->>'axis' <> v_group.variant_type
              or member.variant_options->0->>'label' <> member.variant_label)))
    ) then raise exception 'VARIANT_GROUP_NOT_VERIFIED'; end if;
    v_label := coalesce(p_input->>'variant_label', v_old.variant_label);
    v_options := case when p_input ? 'variant_options' then p_input->'variant_options' else v_old.variant_options end;
    if v_label is null or v_label <> btrim(v_label) or length(v_label) not between 1 and 100
       or v_label ~ '[[:cntrl:]<>]' or jsonb_typeof(v_options) is distinct from 'array'
       or (case when jsonb_typeof(v_options) = 'array' then jsonb_array_length(v_options) else -1 end) <> 1 then
      raise exception 'INVALID_VARIANT_OPTIONS';
    end if;
    v_option := v_options->0;
    v_value := v_option->>'value';
    if jsonb_typeof(v_option) is distinct from 'object' then raise exception 'INVALID_VARIANT_OPTIONS'; end if;
    if exists (
      select 1 from jsonb_object_keys(v_option) as option_field(key)
      where key not in ('axis','value','label')
    ) or v_option->>'axis' <> v_old.variant_type
       or v_value is null or v_value <> btrim(v_value) or length(v_value) not between 1 and 100
       or v_value ~ '[[:cntrl:]<>]' or v_option->>'label' <> v_label then raise exception 'INVALID_VARIANT_OPTIONS'; end if;
    if exists (
      select 1 from dpg_app.products other
      where other.variant_group_id = v_old.variant_group_id and other.id <> v_old.id
        and lower(coalesce(other.variant_options->0->>'value', other.variant_label)) = lower(v_value)
    ) then raise exception 'DUPLICATE_VARIANT_OPTION'; end if;
  end if;

  v_fields := array(select key from jsonb_object_keys(p_input) as fields(key) order by key);
  update dpg_app.products p set
    display_name = case when p_input ? 'display_name' then p_input->>'display_name' else p.display_name end,
    description = case when p_input ? 'description' then p_input->>'description' else p.description end,
    price = case when p_input ? 'price' then v_price else p.price end,
    sale_price = case when p_input ? 'sale_price' then v_sale else p.sale_price end,
    online_discount_amount = case when p_input ? 'online_discount_amount' then v_discount else p.online_discount_amount end,
    price_state = case when p_input ?| array['price','sale_price','online_discount_amount'] then 'unknown' else p.price_state end,
    price_confidence = case when p_input ?| array['price','sale_price','online_discount_amount'] then 'low' else p.price_confidence end,
    price_source = case when p_input ?| array['price','sale_price','online_discount_amount'] then 'admin-unverified' else p.price_source end,
    price_updated_at = case when p_input ?| array['price','sale_price','online_discount_amount'] then now() else p.price_updated_at end,
    publication_status = case when p_input ? 'publication_status' then p_input->>'publication_status' else p.publication_status end,
    is_active = case when p_input ? 'is_active' then (p_input->>'is_active')::boolean else p.is_active end,
    pdp_visibility = case when p_input ? 'pdp_visibility' then p_input->>'pdp_visibility' else p.pdp_visibility end,
    listing_visibility = case when p_input ? 'listing_visibility' then p_input->>'listing_visibility' else p.listing_visibility end,
    search_visibility = case when p_input ? 'search_visibility' then p_input->>'search_visibility' else p.search_visibility end,
    seo_indexing = case when p_input ? 'seo_indexing' then p_input->>'seo_indexing' else p.seo_indexing end,
    sitemap_include = case when p_input ? 'sitemap_include' then (p_input->>'sitemap_include')::boolean else p.sitemap_include end,
    variant_label = case when p_input ? 'variant_label' then v_label else p.variant_label end,
    variant_options = case when p_input ? 'variant_options' then v_options else p.variant_options end,
    version = p.version + 1,
    updated_at = now()
  where p.id = p_product_id returning * into v_product;

  insert into dpg_app.audit_logs(
    user_id, action, entity_type, entity_id, auth_user_id, auth_session_id,
    request_id, idempotency_key_hash, changed_fields
  ) values (
    v_actor.admin_id, 'phase2.product.updated', 'product', v_product.id::text,
    auth.uid(), v_actor.auth_session_id, p_request_id, v_key_hash, v_fields
  );
  v_result := jsonb_build_object(
    'id', v_product.id, 'sku', v_product.sku, 'version', v_product.version,
    'publication_status', v_product.publication_status, 'price_state', v_product.price_state,
    'updated_at', v_product.updated_at
  );
  update dpg_app.runtime_idempotency_records set safe_response = v_result
  where owner_id = auth.uid() and operation = 'phase2.admin.product.update' and key_hash = v_key_hash;
  return v_result;
end
$$;

reset role;
revoke create on schema public from dpg_migration;
revoke all on function public.phase2_admin_product_catalogue(integer,text,text,integer,integer),
  public.phase2_admin_product_update(integer,integer,jsonb,text,uuid)
  from public, anon, service_role;
grant execute on function public.phase2_admin_product_catalogue(integer,text,text,integer,integer),
  public.phase2_admin_product_update(integer,integer,jsonb,text,uuid)
  to authenticated;

do $postflight$
begin
  if not exists (
    select 1 from pg_proc p
    where p.oid = 'public.phase2_admin_product_catalogue(integer,text,text,integer,integer)'::regprocedure
      and not p.prosecdef and pg_get_userbyid(p.proowner) = 'dpg_migration'
  ) or not exists (
    select 1 from pg_proc p
    where p.oid = 'public.phase2_admin_product_update(integer,integer,jsonb,text,uuid)'::regprocedure
      and not p.prosecdef and pg_get_userbyid(p.proowner) = 'dpg_migration'
  ) or has_schema_privilege('dpg_migration', 'public', 'CREATE')
    or has_function_privilege('anon', 'public.phase2_admin_product_update(integer,integer,jsonb,text,uuid)', 'EXECUTE')
    or has_function_privilege('service_role', 'public.phase2_admin_product_update(integer,integer,jsonb,text,uuid)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.phase2_admin_product_update(integer,integer,jsonb,text,uuid)', 'EXECUTE') then
    raise exception 'DPG_PHASE2_ADMIN_CATALOGUE_POSTFLIGHT_FAILED';
  end if;
end
$postflight$;
