-- Allow only the exact synthetic #290 SKU/price fixtures through existing
-- publication and order-intake guards. This file belongs only to the custom
-- synthetic Preview ledger and must never enter supabase/migrations.

do $preview_guard_preflight$
begin
  if not exists (
    select 1 from dpg_control.target_contract
    where singleton
      and project_name = 'dongphugia-phase2-preview-290'
      and environment = 'preview_synthetic'
      and region = 'ap-southeast-1'
      and data_class = 'synthetic-with-approved-public-fixtures'
      and not production_data_allowed
      and not production_credentials_allowed
      and not production_writes_allowed
      and hard_database_ceiling_bytes = 367001600
  ) or has_schema_privilege('dpg_migration', 'public', 'CREATE')
     or has_schema_privilege('dpg_order_intake_function_owner', 'public', 'CREATE')
     or exists (
       select 1 from pg_auth_members membership
       where membership.roleid = (select oid from pg_roles where rolname = 'dpg_order_intake_function_owner')
         and membership.member = (select oid from pg_roles where rolname = 'dpg_migration')
     )
     or not exists (
       select 1 from pg_proc p
       where p.oid = 'public.guest_order_request_create(jsonb,text,uuid)'::regprocedure
         and pg_get_userbyid(p.proowner) = 'dpg_order_intake_function_owner'
         and p.prosecdef
         and p.proconfig @> array['search_path=pg_catalog, dpg_app', 'row_security=on']
     )
     or not exists (
       select 1 from pg_proc p
       where p.oid = 'public.phase2_admin_product_update(integer,integer,jsonb,text,uuid)'::regprocedure
         and pg_get_userbyid(p.proowner) = 'dpg_migration'
         and not p.prosecdef
     ) then
    raise exception 'DPG_PREVIEW_290_SYNTHETIC_GUARD_PRECONDITION_FAILED';
  end if;
end
$preview_guard_preflight$;

-- dpg_migration is forced through RLS on its owned tables. This policy lets
-- the SECURITY DEFINER check see only the exact two synthetic SKU rows.
drop policy if exists phase2_preview_synthetic_product_guard_select on dpg_app.products;
create policy phase2_preview_synthetic_product_guard_select on dpg_app.products
  for select to dpg_migration
  using (
    sku = 'DPG-290-SYN-A'
      and name = 'PREVIEW ONLY — Synthetic option A'
      and slug = 'preview-option-a'
      and price = 100000
      and price_source = 'synthetic-preview'
      and source_system = 'synthetic-preview'
    or sku = 'DPG-290-SYN-B'
      and name = 'PREVIEW ONLY — Synthetic option B'
      and slug = 'preview-option-b'
      and price = 120000
      and price_source = 'synthetic-preview'
      and source_system = 'synthetic-preview'
  );

create or replace function dpg_control.phase2_preview_synthetic_product_eligible(p_product_id integer)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, dpg_app, dpg_control
as $preview_synthetic_eligibility$
  select exists (
    select 1
    from dpg_control.target_contract target
    join dpg_app.products product on product.id = p_product_id
    where target.singleton
      and target.project_name = 'dongphugia-phase2-preview-290'
      and target.environment = 'preview_synthetic'
      and target.region = 'ap-southeast-1'
      and target.data_class = 'synthetic-with-approved-public-fixtures'
      and not target.production_data_allowed
      and not target.production_credentials_allowed
      and not target.production_writes_allowed
      and target.hard_database_ceiling_bytes = 367001600
      and product.is_active
      and product.sellable_status = 'sellable'
      and product.stock_status in ('in_stock', 'pre_order', 'preorder', 'contact')
      and product.price_state = 'priced'
      and product.price_confidence = 'low'
      and product.price_source = 'synthetic-preview'
      and product.source_system = 'synthetic-preview'
      and product.source_confidence = 'low'
      and product.price_updated_at is null
      and product.price > 0
      and product.price = trunc(product.price)
      and product.list_price is null
      and product.original_price is null
      and product.sale_price is null
      and product.online_discount_amount is null
      and product.variant_group = 'public-290'
      and product.variant_type = 'seat_type'
      and (
        (product.sku = 'DPG-290-SYN-A'
          and product.name = 'PREVIEW ONLY — Synthetic option A'
          and product.slug = 'preview-option-a'
          and product.price = 100000
          and product.variant_label = 'Option A'
          and product.variant_options = '[{"axis":"seat_type","label":"Option A","value":"a"}]'::jsonb)
        or
        (product.sku = 'DPG-290-SYN-B'
          and product.name = 'PREVIEW ONLY — Synthetic option B'
          and product.slug = 'preview-option-b'
          and product.price = 120000
          and product.variant_label = 'Option B'
          and product.variant_options = '[{"axis":"seat_type","label":"Option B","value":"b"}]'::jsonb)
      )
  );
$preview_synthetic_eligibility$;

alter function dpg_control.phase2_preview_synthetic_product_eligible(integer) owner to dpg_migration;
revoke all on function dpg_control.phase2_preview_synthetic_product_eligible(integer)
  from public, anon, authenticated, service_role, dpg_runtime, dpg_readonly,
    dpg_order_intake, dpg_order_intake_login, dpg_order_intake_function_owner;
grant usage on schema dpg_control to authenticated, dpg_order_intake_function_owner;
grant execute on function dpg_control.phase2_preview_synthetic_product_eligible(integer)
  to authenticated, dpg_order_intake_function_owner;

-- Replace the guest RPC as its existing no-login SECURITY DEFINER owner.
-- dpg_migration receives only temporary SET membership and schema CREATE;
-- both are removed before postflight and commit.
grant create on schema public to dpg_order_intake_function_owner;
grant dpg_order_intake_function_owner to dpg_migration
  with set true, inherit false, admin false;
set role dpg_migration;
set role dpg_order_intake_function_owner;

do $preview_guard_guest_patch$
declare
  guest_definition text;
  original text;
  replacement text;
  occurrences integer;
begin
  guest_definition := pg_get_functiondef('public.guest_order_request_create(jsonb,text,uuid)'::regprocedure);
  original := 'v_public_selling_price := case' || E'\n'
    || '        when v_product.price_source in (''hita'', ''manual'')';
  replacement := 'v_public_selling_price := case' || E'\n'
    || '        when dpg_control.phase2_preview_synthetic_product_eligible(v_product.id) then v_product.price' || E'\n'
    || '        when v_product.price_source in (''hita'', ''manual'')';
  occurrences := (length(guest_definition) - length(replace(guest_definition, original, ''))) / length(original);
  if occurrences <> 1 then raise exception 'DPG_PREVIEW_290_GUEST_PRICE_GUARD_DRIFT'; end if;
  execute replace(guest_definition, original, replacement);
end
$preview_guard_guest_patch$;

reset role;
revoke dpg_order_intake_function_owner from dpg_migration;

-- Replace the existing SECURITY INVOKER editor RPC as its dpg_migration owner.
grant create on schema public to dpg_migration;
set role dpg_migration;

do $preview_guard_admin_patch$
declare
  admin_definition text;
  original text;
  replacement text;
  occurrences integer;
begin

  admin_definition := pg_get_functiondef('public.phase2_admin_product_update(integer,integer,jsonb,text,uuid)'::regprocedure);
  original := 'v_price_verified := not (p_input ?| array[''price'',''sale_price'',''online_discount_amount''])' || E'\n'
    || '    and v_old.price_state = ''priced''';
  replacement := 'v_price_verified := not (p_input ?| array[''price'',''sale_price'',''online_discount_amount''])' || E'\n'
    || '    and (' || E'\n'
    || '      dpg_control.phase2_preview_synthetic_product_eligible(v_old.id)' || E'\n'
    || '      or (' || E'\n'
    || '        v_old.price_state = ''priced''';
  occurrences := (length(admin_definition) - length(replace(admin_definition, original, ''))) / length(original);
  if occurrences <> 1 then raise exception 'DPG_PREVIEW_290_ADMIN_PRICE_GUARD_DRIFT'; end if;
  admin_definition := replace(admin_definition, original, replacement);

  original := E'    );\n  if coalesce(p_input->>''publication_status'', v_old.publication_status) = ''public''';
  replacement := E'      )\n      )\n    );\n  if coalesce(p_input->>''publication_status'', v_old.publication_status) = ''public''';
  occurrences := (length(admin_definition) - length(replace(admin_definition, original, ''))) / length(original);
  if occurrences <> 1 then raise exception 'DPG_PREVIEW_290_ADMIN_PRICE_GUARD_CLOSE_DRIFT'; end if;
  execute replace(admin_definition, original, replacement);
end
$preview_guard_admin_patch$;

reset role;
revoke create on schema public from dpg_migration, dpg_order_intake_function_owner;

do $preview_guard_postflight$
begin
  if not has_function_privilege('authenticated', 'dpg_control.phase2_preview_synthetic_product_eligible(integer)', 'EXECUTE')
     or not has_function_privilege('dpg_order_intake_function_owner', 'dpg_control.phase2_preview_synthetic_product_eligible(integer)', 'EXECUTE')
     or has_function_privilege('anon', 'dpg_control.phase2_preview_synthetic_product_eligible(integer)', 'EXECUTE')
     or has_function_privilege('service_role', 'dpg_control.phase2_preview_synthetic_product_eligible(integer)', 'EXECUTE')
     or not exists (
       select 1 from pg_proc p
       where p.oid = 'public.guest_order_request_create(jsonb,text,uuid)'::regprocedure
         and p.prosrc like '%phase2_preview_synthetic_product_eligible(v_product.id)%'
         and p.prosecdef
         and p.proconfig @> array['search_path=pg_catalog, dpg_app', 'row_security=on']
         and pg_get_userbyid(p.proowner) = 'dpg_order_intake_function_owner'
     )
     or has_function_privilege('anon', 'public.guest_order_request_create(jsonb,text,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.guest_order_request_create(jsonb,text,uuid)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.guest_order_request_create(jsonb,text,uuid)', 'EXECUTE')
     or has_function_privilege('dpg_order_intake_login', 'public.guest_order_request_create(jsonb,text,uuid)', 'EXECUTE')
     or not has_function_privilege('dpg_order_intake', 'public.guest_order_request_create(jsonb,text,uuid)', 'EXECUTE')
     or not has_function_privilege('dpg_order_intake_function_owner', 'public.guest_order_request_create(jsonb,text,uuid)', 'EXECUTE')
     or not exists (
       select 1 from pg_proc p
       where p.oid = 'public.phase2_admin_product_update(integer,integer,jsonb,text,uuid)'::regprocedure
         and p.prosrc like '%phase2_preview_synthetic_product_eligible(v_old.id)%'
         and pg_get_userbyid(p.proowner) = 'dpg_migration'
         and not p.prosecdef
     )
     or has_function_privilege('anon', 'public.phase2_admin_product_update(integer,integer,jsonb,text,uuid)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.phase2_admin_product_update(integer,integer,jsonb,text,uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.phase2_admin_product_update(integer,integer,jsonb,text,uuid)', 'EXECUTE')
     or has_schema_privilege('dpg_migration', 'public', 'CREATE')
     or has_schema_privilege('dpg_order_intake_function_owner', 'public', 'CREATE')
     or exists (
       select 1 from pg_auth_members membership
       where membership.roleid = (select oid from pg_roles where rolname = 'dpg_order_intake_function_owner')
         and membership.member = (select oid from pg_roles where rolname = 'dpg_migration')
     )
     or not exists (
       select 1 from pg_policy p
       where p.polrelid = 'dpg_app.products'::regclass
         and p.polname = 'phase2_preview_synthetic_product_guard_select'
         and p.polroles = array[(select oid from pg_roles where rolname = 'dpg_migration')]
     ) then
    raise exception 'DPG_PREVIEW_290_SYNTHETIC_GUARD_POSTFLIGHT_FAILED';
  end if;
end
$preview_guard_postflight$;
