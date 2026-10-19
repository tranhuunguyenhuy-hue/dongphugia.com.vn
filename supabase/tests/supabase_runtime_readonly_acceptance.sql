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
  api_product_policy_drift_details text[];
  api_capability_function_drift boolean;
  api_staff_context_function_drift boolean;
  api_staff_helper_grant_drift boolean;
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
    ('v1_products_staff_select', 'r', true, array['authenticated']::text[], 'status = ''PUBLISHED''::dpg_v1.record_status OR dpg_v1.staff_has_capability(''catalogue.read''::dpg_v1.staff_capability)', ''),
    ('v1_products_create', 'a', true, array['authenticated']::text[], '', 'dpg_v1.staff_has_capability(''catalogue.create''::dpg_v1.staff_capability) AND status = ''DRAFT''::dpg_v1.record_status'),
    ('v1_products_update', 'w', true, array['authenticated']::text[], 'dpg_v1.staff_has_capability(''catalogue.update''::dpg_v1.staff_capability) OR dpg_v1.staff_has_capability(''catalogue.publish''::dpg_v1.staff_capability) OR dpg_v1.staff_has_capability(''catalogue.archive''::dpg_v1.staff_capability)', 'dpg_v1.staff_has_capability(''catalogue.update''::dpg_v1.staff_capability) OR dpg_v1.staff_has_capability(''catalogue.publish''::dpg_v1.staff_capability) OR dpg_v1.staff_has_capability(''catalogue.archive''::dpg_v1.staff_capability)'),
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
    select p.policyname::text as policy_name,
           case p.cmd
             when 'SELECT' then 'r'
             when 'INSERT' then 'a'
             when 'UPDATE' then 'w'
             when 'DELETE' then 'd'
             when 'ALL' then '*'
             else p.cmd
           end as policy_command,
           p.permissive = 'PERMISSIVE' as policy_permissive,
           array(
             select role_name::text
             from unnest(p.roles) as policy_role(role_name)
             order by role_name::text
           ) as policy_roles,
           regexp_replace(coalesce(p.qual, ''), '[[:space:]()]', '', 'g') as policy_qual,
           regexp_replace(coalesce(p.with_check, ''), '[[:space:]()]', '', 'g') as policy_check
    from pg_policies p
    where p.schemaname = 'dpg_v1'
      and p.tablename = 'products'
  )
  select coalesce(array_agg(
    format('%s:%s', drift.policy_name, drift.field_name)
    order by drift.policy_name, drift.field_name
  ), array[]::text[])
  into api_product_policy_drift_details
  from (
    select coalesce(e.policy_name, a.policy_name) as policy_name,
           unnest(array_remove(array[
             case when e.policy_name is null or a.policy_name is null then 'presence'::text end,
             case when e.policy_command is distinct from a.policy_command then 'command'::text end,
             case when e.policy_permissive is distinct from a.policy_permissive then 'permissive'::text end,
             case when e.policy_roles is distinct from a.policy_roles then 'roles'::text end,
             case when e.policy_qual is distinct from a.policy_qual then 'qual'::text end,
             case when e.policy_check is distinct from a.policy_check then 'with_check'::text end
           ], null::text)) as field_name
    from expected e
    full join actual a using (policy_name)
  ) drift;
  api_product_policy_drift := cardinality(api_product_policy_drift_details) > 0;
  if api_product_policy_drift then
    raise exception 'SUPABASE_RUNTIME_READONLY_RLS_POLICY_SET_FAILED:%',
      array_to_string(api_product_policy_drift_details, ',');
  end if;

  select not exists (
    select 1
    from pg_proc p
    where p.oid = to_regprocedure('dpg_v1.staff_has_capability(dpg_v1.staff_capability)')
      and p.proowner = 'postgres'::regrole
      and p.prosecdef
      and p.provolatile = 's'
      and p.prorettype = 'boolean'::regtype
      and p.prolang = (select oid from pg_language where lanname = 'plpgsql')
      and not p.proleakproof
      and p.proconfig = array['search_path=pg_catalog, dpg_v1']::text[]
      and regexp_replace(p.prosrc, '[[:space:]]', '', 'g') = regexp_replace($expected_capability_body$
begin
  if auth.uid() is null or p_capability is null then
    return false;
  end if;

  return exists (
    select 1
    from dpg_v1.current_staff_context() context
    where p_capability = any(context.capabilities)
  );
end
$expected_capability_body$, '[[:space:]]', '', 'g')
  ) into api_capability_function_drift;
  if api_capability_function_drift then
    raise exception 'SUPABASE_RUNTIME_READONLY_CAPABILITY_HELPER_FAILED';
  end if;

  select not exists (
    select 1
    from pg_proc p
    where p.oid = to_regprocedure('dpg_v1.current_staff_context()')
      and p.proowner = 'postgres'::regrole
      and p.prosecdef
      and p.provolatile = 's'
      and p.prorettype = 'record'::regtype
      and p.prolang = (select oid from pg_language where lanname = 'sql')
      and not p.proleakproof
      and p.proconfig = array['search_path=pg_catalog, dpg_v1']::text[]
      and regexp_replace(pg_get_function_result(p.oid), '[[:space:]]', '', 'g') =
        'TABLE(auth_user_iduuid,emailtext,display_nametext,statusdpg_v1.staff_status,rolesdpg_v1.staff_role[],capabilitiesdpg_v1.staff_capability[])'
      and regexp_replace(p.prosrc, '[[:space:]]', '', 'g') = regexp_replace($expected_staff_context_body$
select
  su.auth_user_id,
  su.email,
  su.display_name,
  su.status,
  coalesce(
    (
      select array_agg(distinct sur.role order by sur.role)
      from dpg_v1.staff_user_roles sur
      where sur.auth_user_id = su.auth_user_id
    ),
    '{}'::dpg_v1.staff_role[]
  ),
  coalesce(
    (
      select array_agg(distinct rc.capability order by rc.capability)
      from dpg_v1.staff_user_roles sur
      join dpg_v1.role_capabilities rc on rc.role = sur.role
      where sur.auth_user_id = su.auth_user_id
    ),
    '{}'::dpg_v1.staff_capability[]
  )
from dpg_v1.staff_users su
where su.auth_user_id = auth.uid()
  and su.status = 'active'
$expected_staff_context_body$, '[[:space:]]', '', 'g')
  ) into api_staff_context_function_drift;
  if api_staff_context_function_drift then
    raise exception 'SUPABASE_RUNTIME_READONLY_STAFF_CONTEXT_HELPER_FAILED';
  end if;

  with expected(function_oid, principal, privilege_type, is_grantable) as (values
    (to_regprocedure('dpg_v1.current_staff_context()')::oid, 'authenticated', 'EXECUTE', false),
    (to_regprocedure('dpg_v1.staff_has_capability(dpg_v1.staff_capability)')::oid, 'authenticated', 'EXECUTE', false)
  ), actual as (
    select p.oid as function_oid,
           grantee.rolname::text as principal,
           acl.privilege_type,
           acl.is_grantable
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    left join pg_roles grantee on grantee.oid = acl.grantee
    where n.nspname = 'dpg_v1'
      and p.oid in (
        to_regprocedure('dpg_v1.current_staff_context()'),
        to_regprocedure('dpg_v1.staff_has_capability(dpg_v1.staff_capability)')
      )
      and acl.grantee <> p.proowner
  )
  select exists (
    (select * from expected except select * from actual)
    union all
    (select * from actual except select * from expected)
  ) into api_staff_helper_grant_drift;
  if api_staff_helper_grant_drift then
    raise exception 'SUPABASE_RUNTIME_READONLY_STAFF_HELPER_GRANT_SET_FAILED';
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
