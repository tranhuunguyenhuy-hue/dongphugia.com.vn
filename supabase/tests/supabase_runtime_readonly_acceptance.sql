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
