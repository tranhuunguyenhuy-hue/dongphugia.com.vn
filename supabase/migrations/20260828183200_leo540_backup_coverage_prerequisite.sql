-- LEO-540: restore the exact read-only backup capability required by the
-- later Preview RLS hardening migration. No application roles gain access.

begin;
set local search_path = pg_catalog, public;

do $preflight$
declare
  target_table_name text;
  target_tables constant text[] := array[
    'admin_sessions',
    'crawl_import_decisions',
    'crawl_product_snapshots',
    'crawl_runs',
    'product_families',
    'product_family_catalogue_gaps',
    'product_family_configuration_groups',
    'product_family_memberships',
    'publishing_credentials'
  ];
  readonly_tables constant text[] := array[
    'product_families',
    'product_family_catalogue_gaps',
    'product_family_configuration_groups',
    'product_family_memberships'
  ];
begin
  if not exists (
    select 1
    from dpg_control.target_contract
    where singleton
      and project_name = 'dongphugia-runtime'
      and region = 'ap-southeast-1'
      and environment = 'preview'
      and data_class = 'production-derived-reduced-runtime'
      and production_data_allowed
      and not production_credentials_allowed
      and not production_writes_allowed
      and hard_database_ceiling_bytes = 367001600
  ) then
    raise exception 'LEO540_BACKUP_TARGET_CONTRACT_FAILED';
  end if;

  if not exists (
    select 1 from pg_roles
    where rolname = 'dpg_backup'
      and not rolinherit
      and not rolcanlogin
      and not rolsuper
      and not rolcreatedb
      and not rolcreaterole
      and not rolreplication
      and not rolbypassrls
  ) or exists (
    select 1 from pg_auth_members
    where roleid = (select oid from pg_roles where rolname = 'dpg_backup')
       or member = (select oid from pg_roles where rolname = 'dpg_backup')
  ) then
    raise exception 'LEO540_BACKUP_ROLE_CONTRACT_FAILED';
  end if;

  foreach target_table_name in array target_tables
  loop
    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_roles owner_role on owner_role.oid = c.relowner
      where n.nspname = 'dpg_app'
        and c.relname = target_table_name
        and c.relkind in ('r', 'p')
        and owner_role.rolname = 'dpg_migration'
        and not c.relrowsecurity
        and not c.relforcerowsecurity
    ) or exists (
      select 1
      from pg_policy p
      join pg_class c on c.oid = p.polrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'dpg_app' and c.relname = target_table_name
    ) or exists (
      select 1
      from information_schema.table_privileges
      where table_schema = 'dpg_app'
        and information_schema.table_privileges.table_name = target_table_name
        and grantee = 'dpg_backup'
    ) or (
      target_table_name = any (readonly_tables)
      and exists (
        select 1
        from information_schema.table_privileges
        where table_schema = 'dpg_app'
          and information_schema.table_privileges.table_name = target_table_name
          and grantee = 'dpg_readonly'
      )
    ) then
      raise exception 'LEO540_TABLE_PRECONDITION_FAILED:%', target_table_name;
    end if;
  end loop;
end
$preflight$;

set local role dpg_migration;
grant usage on schema dpg_app to dpg_backup;
grant select on table dpg_app.product_families,
  dpg_app.product_family_catalogue_gaps,
  dpg_app.product_family_configuration_groups,
  dpg_app.product_family_memberships
  to dpg_readonly;

do $apply$
declare
  target_table_name text;
  target_tables constant text[] := array[
    'admin_sessions',
    'crawl_import_decisions',
    'crawl_product_snapshots',
    'crawl_runs',
    'product_families',
    'product_family_catalogue_gaps',
    'product_family_configuration_groups',
    'product_family_memberships',
    'publishing_credentials'
  ];
begin
  foreach target_table_name in array target_tables
  loop
    execute format('grant select on table dpg_app.%I to dpg_backup', target_table_name);
    execute format(
      'create policy leo540_backup_select on dpg_app.%I for select to dpg_backup using (true)',
      target_table_name
    );
  end loop;
end
$apply$;

reset role;

do $postflight$
declare
  target_table_name text;
  direct_privileges text[];
  target_tables constant text[] := array[
    'admin_sessions',
    'crawl_import_decisions',
    'crawl_product_snapshots',
    'crawl_runs',
    'product_families',
    'product_family_catalogue_gaps',
    'product_family_configuration_groups',
    'product_family_memberships',
    'publishing_credentials'
  ];
  readonly_tables constant text[] := array[
    'product_families',
    'product_family_catalogue_gaps',
    'product_family_configuration_groups',
    'product_family_memberships'
  ];
begin
  if not has_schema_privilege('dpg_backup', 'dpg_app', 'USAGE') then
    raise exception 'LEO540_BACKUP_SCHEMA_POSTCONDITION_FAILED';
  end if;

  foreach target_table_name in array target_tables
  loop
    select coalesce(array_agg(privilege_type::text order by privilege_type::text), array[]::text[])
      into direct_privileges
    from information_schema.table_privileges
    where table_schema = 'dpg_app'
      and information_schema.table_privileges.table_name = target_table_name
      and grantee = 'dpg_backup';

    if direct_privileges <> array['SELECT']::text[]
       or has_table_privilege('dpg_backup', format('dpg_app.%I', target_table_name), 'INSERT')
       or has_table_privilege('dpg_backup', format('dpg_app.%I', target_table_name), 'UPDATE')
       or has_table_privilege('dpg_backup', format('dpg_app.%I', target_table_name), 'DELETE')
       or has_table_privilege('dpg_backup', format('dpg_app.%I', target_table_name), 'TRUNCATE')
       or has_table_privilege('dpg_backup', format('dpg_app.%I', target_table_name), 'REFERENCES')
       or has_table_privilege('dpg_backup', format('dpg_app.%I', target_table_name), 'TRIGGER')
       or (
         select count(*)
         from pg_policy p
         join pg_class c on c.oid = p.polrelid
         join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'dpg_app'
           and c.relname = target_table_name
           and p.polname = 'leo540_backup_select'
           and p.polpermissive
           and p.polcmd = 'r'
           and p.polroles = array[(select oid from pg_roles where rolname = 'dpg_backup')]::oid[]
           and pg_get_expr(p.polqual, p.polrelid) = 'true'
           and p.polwithcheck is null
       ) <> 1 then
      raise exception 'LEO540_BACKUP_POSTCONDITION_FAILED:%', target_table_name;
    end if;

    if target_table_name = any (readonly_tables) then
      select coalesce(array_agg(privilege_type::text order by privilege_type::text), array[]::text[])
        into direct_privileges
      from information_schema.table_privileges
      where table_schema = 'dpg_app'
        and information_schema.table_privileges.table_name = target_table_name
        and grantee = 'dpg_readonly';

      if direct_privileges <> array['SELECT']::text[]
         or has_table_privilege('dpg_readonly', format('dpg_app.%I', target_table_name), 'INSERT')
         or has_table_privilege('dpg_readonly', format('dpg_app.%I', target_table_name), 'UPDATE')
         or has_table_privilege('dpg_readonly', format('dpg_app.%I', target_table_name), 'DELETE')
         or has_table_privilege('dpg_readonly', format('dpg_app.%I', target_table_name), 'TRUNCATE')
         or has_table_privilege('dpg_readonly', format('dpg_app.%I', target_table_name), 'REFERENCES')
         or has_table_privilege('dpg_readonly', format('dpg_app.%I', target_table_name), 'TRIGGER') then
        raise exception 'LEO540_READONLY_POSTCONDITION_FAILED:%', target_table_name;
      end if;
    end if;
  end loop;
end
$postflight$;

commit;
