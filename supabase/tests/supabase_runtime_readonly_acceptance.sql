\set ON_ERROR_STOP on
begin transaction isolation level repeatable read read only;
set local statement_timeout = '15s';
set local search_path = pg_catalog, public;

do $runtime_readonly_acceptance$
declare
  table_name text;
  api_principal text;
  api_relation_drift boolean;
  api_schema_grant_drift boolean;
  api_relation_grant_drift boolean;
  api_product_policy_drift boolean;
  api_function_inventory_drift boolean;
  api_function_grant_drift boolean;
  api_function_effective_drift boolean;
begin
  if to_regprocedure('dpg_v1_api.public_product_get(uuid)') is null
     or to_regprocedure('dpg_v1_api.catalogue_media_register(jsonb,text)') is null
     or to_regprocedure('dpg_v1_api.order_intake_create(jsonb,text)') is null
     or to_regprocedure('dpg_v1_api.quote_request_intake_create(jsonb,text)') is null then
    raise exception 'SUPABASE_RUNTIME_READONLY_API_INCOMPLETE';
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('dpg_app', 'dpg_control', 'dpg_v1')
      and c.relkind in ('r', 'p')
      and (not c.relrowsecurity or not c.relforcerowsecurity)
  ) then
    raise exception 'SUPABASE_RUNTIME_READONLY_RLS_INCOMPLETE';
  end if;

  with expected(relation_name) as (values
    ('public_products'),
    ('public_content'),
    ('public_collections'),
    ('staff_products')
  ), actual as (
    select c.relname::text as relation_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'dpg_v1_api'
  )
  select exists (
    (select * from expected except select * from actual)
    union all
    (select * from actual except select * from expected)
  ) into api_relation_drift;
  if api_relation_drift or exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'dpg_v1_api'
      and (c.relkind <> 'v' or not coalesce(c.reloptions, '{}'::text[]) @> array['security_invoker=true'])
  ) then
    raise exception 'SUPABASE_RUNTIME_READONLY_API_RELATION_SET_FAILED';
  end if;

  if exists (
    select 1 from pg_namespace n
    where n.nspname = 'dpg_v1_api' and pg_get_userbyid(n.nspowner) <> 'postgres'
  ) or exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'dpg_v1_api' and pg_get_userbyid(c.relowner) <> 'postgres'
  ) or exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'dpg_v1_api' and pg_get_userbyid(p.proowner) <> 'postgres'
  ) then
    raise exception 'SUPABASE_RUNTIME_READONLY_API_OWNER_FAILED';
  end if;

  with expected(principal, privilege_type, is_grantable) as (values
    ('anon', 'USAGE', false),
    ('authenticated', 'USAGE', false)
  ), actual as (
    select case
             when acl.grantee = 0::oid then 'PUBLIC'
             else coalesce(grantee.rolname, format('OID:%s', acl.grantee))
           end as principal,
           acl.privilege_type,
           acl.is_grantable
    from pg_namespace n
    cross join lateral aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) acl
    left join pg_roles grantee on grantee.oid = acl.grantee
    where n.nspname = 'dpg_v1_api'
      and acl.grantee <> n.nspowner
  )
  select exists (
    (select * from expected except select * from actual)
    union all
    (select * from actual except select * from expected)
  ) into api_schema_grant_drift;
  if api_schema_grant_drift then
    raise exception 'SUPABASE_RUNTIME_READONLY_API_SCHEMA_GRANT_SET_FAILED';
  end if;

  with expected(relation_name, principal, privilege_type, is_grantable) as (values
    ('public_products', 'anon', 'SELECT', false),
    ('public_products', 'authenticated', 'SELECT', false),
    ('public_content', 'anon', 'SELECT', false),
    ('public_content', 'authenticated', 'SELECT', false),
    ('public_collections', 'anon', 'SELECT', false),
    ('public_collections', 'authenticated', 'SELECT', false),
    ('staff_products', 'authenticated', 'SELECT', false)
  ), actual as (
    select c.relname::text as relation_name,
           case
             when acl.grantee = 0::oid then 'PUBLIC'
             else coalesce(grantee.rolname, format('OID:%s', acl.grantee))
           end as principal,
           acl.privilege_type,
           acl.is_grantable
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) acl
    left join pg_roles grantee on grantee.oid = acl.grantee
    where n.nspname = 'dpg_v1_api'
      and acl.grantee <> c.relowner
    union all
    select c.relname::text as relation_name,
           case
             when acl.grantee = 0::oid then 'PUBLIC'
             else coalesce(grantee.rolname, format('OID:%s', acl.grantee))
           end as principal,
           acl.privilege_type,
           acl.is_grantable
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    cross join lateral aclexplode(a.attacl) acl
    left join pg_roles grantee on grantee.oid = acl.grantee
    where n.nspname = 'dpg_v1_api'
      and a.attnum > 0
      and not a.attisdropped
      and a.attacl is not null
      and acl.grantee <> c.relowner
  )
  select exists (
    (select * from expected except select * from actual)
    union all
    (select * from actual except select * from expected)
  ) into api_relation_grant_drift;
  if api_relation_grant_drift then
    raise exception 'SUPABASE_RUNTIME_READONLY_API_GRANT_SET_FAILED';
  end if;

  with expected_raw(policy_name, policy_command, policy_permissive, policy_roles, policy_qual, policy_check) as (values
    ('v1_products_public_select', 'r', true, array['anon']::text[], 'status = ''PUBLISHED''::dpg_v1.record_status', ''),
    ('v1_products_staff_select', 'r', true, array['authenticated']::text[], 'status = ''PUBLISHED''::dpg_v1.record_status or dpg_v1.staff_has_capability(''catalogue.read''::dpg_v1.staff_capability)', ''),
    ('v1_products_create', 'a', true, array['authenticated']::text[], '', 'dpg_v1.staff_has_capability(''catalogue.create''::dpg_v1.staff_capability) and status = ''DRAFT''::dpg_v1.record_status'),
    ('v1_products_update', 'w', true, array['authenticated']::text[], 'dpg_v1.staff_has_capability(''catalogue.update''::dpg_v1.staff_capability) or dpg_v1.staff_has_capability(''catalogue.publish''::dpg_v1.staff_capability) or dpg_v1.staff_has_capability(''catalogue.archive''::dpg_v1.staff_capability)', 'dpg_v1.staff_has_capability(''catalogue.update''::dpg_v1.staff_capability) or dpg_v1.staff_has_capability(''catalogue.publish''::dpg_v1.staff_capability) or dpg_v1.staff_has_capability(''catalogue.archive''::dpg_v1.staff_capability)'),
    ('leo565_backup_products_select', 'r', true, array['dpg_backup']::text[], 'true', '')
  ), expected as (
    select policy_name,
           policy_command,
           policy_permissive,
           policy_roles,
           regexp_replace(coalesce(policy_qual, ''), '[[:space:]()]', '', 'g') as policy_qual,
           regexp_replace(coalesce(policy_check, ''), '[[:space:]()]', '', 'g') as policy_check
    from expected_raw
  ), actual as (
    select p.polname::text as policy_name,
           p.polcmd::text as policy_command,
           p.polpermissive as policy_permissive,
           array(
             select case
                      when policy_role.role_oid = 0::oid then 'PUBLIC'
                      else coalesce(role_name.rolname, format('OID:%s', policy_role.role_oid))
                    end
             from unnest(p.polroles) as policy_role(role_oid)
             left join pg_roles role_name on role_name.oid = policy_role.role_oid
             order by 1
           ) as policy_roles,
           regexp_replace(coalesce(pg_get_expr(p.polqual, 'dpg_v1.products'::regclass), ''), '[[:space:]()]', '', 'g') as policy_qual,
           regexp_replace(coalesce(pg_get_expr(p.polwithcheck, 'dpg_v1.products'::regclass), ''), '[[:space:]()]', '', 'g') as policy_check
    from pg_policy p
    where p.polrelid = 'dpg_v1.products'::regclass
  )
  select exists (
    (select * from expected except select * from actual)
    union all
    (select * from actual except select * from expected)
  ) into api_product_policy_drift;
  if api_product_policy_drift then
    raise exception 'SUPABASE_RUNTIME_READONLY_RLS_POLICY_SET_FAILED';
  end if;

  with expected(function_signature, anon_execute, authenticated_execute) as (values
    ('dpg_v1_api.public_product_list(integer,integer)', true, true),
    ('dpg_v1_api.public_product_get(uuid)', true, true),
    ('dpg_v1_api.public_content_list(integer,integer)', true, true),
    ('dpg_v1_api.public_content_get(uuid)', true, true),
    ('dpg_v1_api.public_collection_list(integer,integer)', true, true),
    ('dpg_v1_api.order_intake_create(jsonb,text)', true, true),
    ('dpg_v1_api.quote_request_intake_create(jsonb,text)', true, true),
    ('dpg_v1_api.shareable_quote_read(text)', true, true),
    ('dpg_v1_api.staff_context()', false, true),
    ('dpg_v1_api.staff_can(text)', false, true),
    ('dpg_v1_api.catalogue_product_create(jsonb,text)', false, true),
    ('dpg_v1_api.catalogue_product_update(uuid,integer,jsonb,text)', false, true),
    ('dpg_v1_api.catalogue_product_publish(uuid,integer,text)', false, true),
    ('dpg_v1_api.catalogue_product_archive(uuid,integer,text)', false, true),
    ('dpg_v1_api.marketing_content_create(jsonb,text)', false, true),
    ('dpg_v1_api.marketing_content_update(uuid,integer,jsonb,text)', false, true),
    ('dpg_v1_api.marketing_content_publish(uuid,integer,text)', false, true),
    ('dpg_v1_api.marketing_content_archive(uuid,integer,text)', false, true),
    ('dpg_v1_api.marketing_collection_create(jsonb,text)', false, true),
    ('dpg_v1_api.marketing_collection_update(uuid,integer,jsonb,text)', false, true),
    ('dpg_v1_api.marketing_collection_publish(uuid,integer,text)', false, true),
    ('dpg_v1_api.marketing_collection_archive(uuid,integer,text)', false, true),
    ('dpg_v1_api.sales_order_list(integer,integer)', false, true),
    ('dpg_v1_api.sales_order_get(uuid)', false, true),
    ('dpg_v1_api.sales_quote_request_list(integer,integer)', false, true),
    ('dpg_v1_api.sales_quote_request_get(uuid)', false, true),
    ('dpg_v1_api.sales_order_lifecycle_update(uuid,text,timestamptz,text)', false, true),
    ('dpg_v1_api.sales_order_payment_update(uuid,text,numeric,text,timestamptz,text)', false, true),
    ('dpg_v1_api.sales_order_archive(uuid,timestamptz,text)', false, true),
    ('dpg_v1_api.sales_quote_create(jsonb,text)', false, true),
    ('dpg_v1_api.sales_quote_update(uuid,integer,jsonb,text)', false, true),
    ('dpg_v1_api.sales_quote_publish(uuid,integer,text)', false, true),
    ('dpg_v1_api.sales_quote_archive(uuid,integer,text)', false, true),
    ('dpg_v1_api.sales_quote_revoke_share(uuid,text)', false, true),
    ('dpg_v1_api.sales_quote_convert(uuid,integer,text)', false, true),
    ('dpg_v1_api.staff_user_list()', false, true),
    ('dpg_v1_api.staff_user_provision(uuid,text,text,dpg_v1.staff_role[],text)', false, true),
    ('dpg_v1_api.staff_user_assign_roles(uuid,dpg_v1.staff_role[],text)', false, true),
    ('dpg_v1_api.staff_user_disable(uuid,text)', false, true),
    ('dpg_v1_api.catalogue_media_register(jsonb,text)', false, true),
    ('dpg_v1_api.catalogue_media_mark_ready(uuid,jsonb,text)', false, true),
    ('dpg_v1_api.catalogue_product_media_attach(uuid,uuid,dpg_v1.product_media_role,integer,text,text)', false, true),
    ('dpg_v1_api.catalogue_product_document_attach(uuid,uuid,text,text,integer,boolean,text)', false, true),
    ('dpg_v1_api.catalogue_media_tombstone(uuid,text)', false, true)
  ), expected_functions as (
    select to_regprocedure(function_signature) as function_oid,
           anon_execute,
           authenticated_execute
    from expected
  ), actual_functions as (
    select p.oid as function_oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'dpg_v1_api'
  ), expected_grants as (
    select function_oid, principal, 'EXECUTE'::text as privilege_type, false as is_grantable
    from expected_functions
    cross join lateral (values
      ('anon'::text, anon_execute),
      ('authenticated'::text, authenticated_execute)
    ) as expected_principal(principal, allowed)
    where allowed
  ), actual_grants as (
    select p.oid as function_oid,
           case
             when acl.grantee = 0::oid then 'PUBLIC'
             else coalesce(grantee.rolname, format('OID:%s', acl.grantee))
           end as principal,
           acl.privilege_type,
           acl.is_grantable
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    left join pg_roles grantee on grantee.oid = acl.grantee
    where n.nspname = 'dpg_v1_api' and acl.grantee <> p.proowner
  )
  select exists (
           (select function_oid from expected_functions except select function_oid from actual_functions)
           union all
           (select function_oid from actual_functions except select function_oid from expected_functions)
         ),
         exists (
           (select * from expected_grants except select * from actual_grants)
           union all
           (select * from actual_grants except select * from expected_grants)
         ),
         exists (
           select 1 from expected_functions f
           where (f.anon_execute and not has_function_privilege('anon', f.function_oid, 'EXECUTE'))
              or (not f.anon_execute and has_function_privilege('anon', f.function_oid, 'EXECUTE'))
              or not has_function_privilege('authenticated', f.function_oid, 'EXECUTE')
              or has_function_privilege('service_role', f.function_oid, 'EXECUTE')
              or has_function_privilege('dpg_runtime', f.function_oid, 'EXECUTE')
              or has_function_privilege('dpg_readonly', f.function_oid, 'EXECUTE')
              or has_function_privilege('dpg_backup', f.function_oid, 'EXECUTE')
         )
  into api_function_inventory_drift, api_function_grant_drift, api_function_effective_drift;
  if api_function_inventory_drift then
    raise exception 'SUPABASE_RUNTIME_READONLY_API_FUNCTION_SET_FAILED';
  end if;
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'dpg_v1_api' and p.prosecdef
  ) then
    raise exception 'SUPABASE_RUNTIME_READONLY_API_FUNCTION_SECURITY_MODE_FAILED';
  end if;
  if api_function_grant_drift then
    raise exception 'SUPABASE_RUNTIME_READONLY_API_FUNCTION_GRANT_SET_FAILED';
  end if;
  if api_function_effective_drift then
    raise exception 'SUPABASE_RUNTIME_READONLY_API_FUNCTION_EFFECTIVE_GRANTS_FAILED';
  end if;

  if not has_table_privilege('anon', 'dpg_v1_api.public_products', 'SELECT')
     or not has_table_privilege('anon', 'dpg_v1_api.public_content', 'SELECT')
     or not has_table_privilege('anon', 'dpg_v1_api.public_collections', 'SELECT')
     or not has_table_privilege('authenticated', 'dpg_v1_api.public_products', 'SELECT')
     or not has_table_privilege('authenticated', 'dpg_v1_api.public_content', 'SELECT')
     or not has_table_privilege('authenticated', 'dpg_v1_api.public_collections', 'SELECT')
     or not has_table_privilege('authenticated', 'dpg_v1_api.staff_products', 'SELECT')
     or has_table_privilege('anon', 'dpg_v1_api.staff_products', 'SELECT')
     or has_table_privilege('service_role', 'dpg_v1_api.public_products', 'SELECT')
     or has_table_privilege('service_role', 'dpg_v1_api.public_content', 'SELECT')
     or has_table_privilege('service_role', 'dpg_v1_api.public_collections', 'SELECT')
     or has_table_privilege('service_role', 'dpg_v1_api.staff_products', 'SELECT') then
    raise exception 'SUPABASE_RUNTIME_READONLY_API_GRANT_INCOMPLETE';
  end if;

  for table_name in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'dpg_v1_api' and c.relkind = 'v'
  loop
    foreach api_principal in array array['anon', 'authenticated', 'service_role'] loop
      if has_table_privilege(api_principal, format('dpg_v1_api.%I', table_name), 'INSERT')
         or has_table_privilege(api_principal, format('dpg_v1_api.%I', table_name), 'UPDATE')
         or has_table_privilege(api_principal, format('dpg_v1_api.%I', table_name), 'DELETE')
         or has_table_privilege(api_principal, format('dpg_v1_api.%I', table_name), 'TRUNCATE')
         or has_any_column_privilege(api_principal, format('dpg_v1_api.%I', table_name), 'INSERT')
         or has_any_column_privilege(api_principal, format('dpg_v1_api.%I', table_name), 'UPDATE')
         or has_any_column_privilege(api_principal, format('dpg_v1_api.%I', table_name), 'REFERENCES') then
        raise exception 'SUPABASE_RUNTIME_READONLY_API_WRITE_PRIVILEGE role=% view=%', api_principal, table_name;
      end if;
    end loop;
  end loop;

  for table_name in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'dpg_v1' and c.relkind in ('r', 'p')
  loop
    if has_table_privilege('dpg_backup', format('dpg_v1.%I', table_name), 'INSERT')
       or has_table_privilege('dpg_backup', format('dpg_v1.%I', table_name), 'UPDATE')
       or has_table_privilege('dpg_backup', format('dpg_v1.%I', table_name), 'DELETE')
       or has_table_privilege('dpg_backup', format('dpg_v1.%I', table_name), 'TRUNCATE')
       or has_any_column_privilege('dpg_backup', format('dpg_v1.%I', table_name), 'INSERT')
       or has_any_column_privilege('dpg_backup', format('dpg_v1.%I', table_name), 'UPDATE')
       or has_any_column_privilege('dpg_backup', format('dpg_v1.%I', table_name), 'REFERENCES') then
      raise exception 'SUPABASE_RUNTIME_READONLY_BACKUP_WRITE_PRIVILEGE table=%', table_name;
    end if;
  end loop;

  if exists (select 1 from auth.users) or exists (select 1 from storage.objects) then
    raise exception 'SUPABASE_RUNTIME_READONLY_PROVIDER_DATA_NOT_EMPTY';
  end if;
end
$runtime_readonly_acceptance$;

rollback;
