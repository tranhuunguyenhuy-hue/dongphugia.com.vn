-- LEO-560 Preview-only RLS hardening for the nine legacy catalogue/control
-- tables reported by the Supabase advisor. This migration preserves the
-- already-approved backup and read-only grants; it creates no new grants.

begin;
set local search_path = pg_catalog, public;

do $preflight$
declare
  target_table_name text;
  boundary_role text;
  direct_privileges text[];
  expected_readonly_privileges text[];
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
    raise exception 'LEO560_RLS_TARGET_CONTRACT_FAILED';
  end if;

  if exists (
    select 1
    from pg_roles
    where rolname in ('dpg_migration', 'dpg_backup', 'dpg_readonly', 'dpg_runtime')
      and (
        rolcanlogin or rolsuper or rolcreatedb or rolcreaterole
        or rolinherit or rolreplication or rolbypassrls
      )
  ) or (
    select count(*)
    from pg_roles
    where rolname in (
      'dpg_migration', 'dpg_backup', 'dpg_readonly', 'dpg_runtime',
      'anon', 'authenticated', 'service_role'
    )
  ) <> 7 then
    raise exception 'LEO560_RLS_ROLE_CONTRACT_FAILED';
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
    ) then
      raise exception 'LEO560_RLS_TABLE_PRECONDITION_FAILED:%', target_table_name;
    end if;

    if (
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
    ) <> 1 or (
      select count(*)
      from pg_policy p
      join pg_class c on c.oid = p.polrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'dpg_app'
        and c.relname = target_table_name
    ) <> 1 then
      raise exception 'LEO560_RLS_BACKUP_POLICY_PRECONDITION_FAILED:%', target_table_name;
    end if;

    select coalesce(
      array_agg(privilege_type::text order by privilege_type::text),
      array[]::text[]
    )
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
       or has_table_privilege('dpg_backup', format('dpg_app.%I', target_table_name), 'TRIGGER') then
      raise exception 'LEO560_RLS_BACKUP_PRIVILEGE_PRECONDITION_FAILED:%', target_table_name;
    end if;

    expected_readonly_privileges := case
      when target_table_name = any (readonly_tables) then array['SELECT']::text[]
      else array[]::text[]
    end;

    select coalesce(
      array_agg(privilege_type::text order by privilege_type::text),
      array[]::text[]
    )
    into direct_privileges
    from information_schema.table_privileges
    where table_schema = 'dpg_app'
      and information_schema.table_privileges.table_name = target_table_name
      and grantee = 'dpg_readonly';

    if direct_privileges <> expected_readonly_privileges then
      raise exception 'LEO560_RLS_READONLY_PRIVILEGE_PRECONDITION_FAILED:%', target_table_name;
    end if;

    if has_table_privilege('dpg_readonly', format('dpg_app.%I', target_table_name), 'INSERT')
       or has_table_privilege('dpg_readonly', format('dpg_app.%I', target_table_name), 'UPDATE')
       or has_table_privilege('dpg_readonly', format('dpg_app.%I', target_table_name), 'DELETE')
       or has_table_privilege('dpg_readonly', format('dpg_app.%I', target_table_name), 'TRUNCATE')
       or has_table_privilege('dpg_readonly', format('dpg_app.%I', target_table_name), 'REFERENCES')
       or has_table_privilege('dpg_readonly', format('dpg_app.%I', target_table_name), 'TRIGGER') then
      raise exception 'LEO560_RLS_READONLY_WRITE_PRECONDITION_FAILED:%', target_table_name;
    end if;

    if exists (
      select 1
      from information_schema.table_privileges
      where table_schema = 'dpg_app'
        and information_schema.table_privileges.table_name = target_table_name
        and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role', 'dpg_runtime')
    ) then
      raise exception 'LEO560_RLS_BROAD_PRIVILEGE_PRECONDITION_FAILED:%', target_table_name;
    end if;

    foreach boundary_role in array array['anon', 'authenticated', 'service_role', 'dpg_runtime']::text[]
    loop
      if has_table_privilege(boundary_role, format('dpg_app.%I', target_table_name), 'SELECT')
         or has_table_privilege(boundary_role, format('dpg_app.%I', target_table_name), 'INSERT')
         or has_table_privilege(boundary_role, format('dpg_app.%I', target_table_name), 'UPDATE')
         or has_table_privilege(boundary_role, format('dpg_app.%I', target_table_name), 'DELETE')
         or has_table_privilege(boundary_role, format('dpg_app.%I', target_table_name), 'TRUNCATE')
         or has_table_privilege(boundary_role, format('dpg_app.%I', target_table_name), 'REFERENCES')
         or has_table_privilege(boundary_role, format('dpg_app.%I', target_table_name), 'TRIGGER') then
        raise exception 'LEO560_RLS_EFFECTIVE_BROAD_PRIVILEGE_PRECONDITION_FAILED:%:%', target_table_name, boundary_role;
      end if;
    end loop;
  end loop;
end
$preflight$;

set local role dpg_migration;

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
  readonly_tables constant text[] := array[
    'product_families',
    'product_family_catalogue_gaps',
    'product_family_configuration_groups',
    'product_family_memberships'
  ];
begin
  foreach target_table_name in array target_tables
  loop
    execute format(
      'revoke all on table dpg_app.%I from public, anon, authenticated, service_role, dpg_runtime',
      target_table_name
    );
    execute format('alter table dpg_app.%I enable row level security', target_table_name);
    execute format('alter table dpg_app.%I force row level security', target_table_name);
  end loop;

  foreach target_table_name in array readonly_tables
  loop
    execute format(
      'create policy leo560_readonly_select on dpg_app.%I for select to dpg_readonly using (true)',
      target_table_name
    );
  end loop;
end
$apply$;

reset role;

do $postflight$
declare
  target_table_name text;
  boundary_role text;
  privilege_name text;
  privilege_expected boolean;
  expected_policy_count integer;
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
  foreach target_table_name in array target_tables
  loop
    expected_policy_count := case when target_table_name = any (readonly_tables) then 2 else 1 end;

    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'dpg_app'
        and c.relname = target_table_name
        and c.relrowsecurity
        and c.relforcerowsecurity
    ) or (
      select count(*)
      from pg_policy p
      join pg_class c on c.oid = p.polrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'dpg_app'
        and c.relname = target_table_name
        and p.polcmd = 'r'
        and p.polpermissive
        and pg_get_expr(p.polqual, p.polrelid) = 'true'
        and p.polwithcheck is null
        and (
          (p.polname = 'leo540_backup_select'
            and p.polroles = array[(select oid from pg_roles where rolname = 'dpg_backup')]::oid[])
          or (p.polname = 'leo560_readonly_select'
            and target_table_name = any (readonly_tables)
            and p.polroles = array[(select oid from pg_roles where rolname = 'dpg_readonly')]::oid[])
        )
    ) <> expected_policy_count or (
      select count(*)
      from pg_policy p
      join pg_class c on c.oid = p.polrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'dpg_app' and c.relname = target_table_name
    ) <> expected_policy_count then
      raise exception 'LEO560_RLS_POSTCONDITION_FAILED:%', target_table_name;
    end if;

    foreach privilege_name in array array[
      'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
    ]::text[]
    loop
      privilege_expected := privilege_name = 'SELECT';
      if has_table_privilege('dpg_backup', format('dpg_app.%I', target_table_name), privilege_name)
         <> privilege_expected then
        raise exception 'LEO560_RLS_BACKUP_PRIVILEGE_POSTCONDITION_FAILED:%:%', target_table_name, privilege_name;
      end if;

      privilege_expected := privilege_name = 'SELECT' and target_table_name = any (readonly_tables);
      if has_table_privilege('dpg_readonly', format('dpg_app.%I', target_table_name), privilege_name)
         <> privilege_expected then
        raise exception 'LEO560_RLS_READONLY_PRIVILEGE_POSTCONDITION_FAILED:%:%', target_table_name, privilege_name;
      end if;

      foreach boundary_role in array array['anon', 'authenticated', 'service_role', 'dpg_runtime']::text[]
      loop
        if has_table_privilege(boundary_role, format('dpg_app.%I', target_table_name), privilege_name) then
          raise exception 'LEO560_RLS_BROAD_PRIVILEGE_POSTCONDITION_FAILED:%:%:%',
            target_table_name, boundary_role, privilege_name;
        end if;
      end loop;
    end loop;

    if exists (
      select 1
      from information_schema.table_privileges
      where table_schema = 'dpg_app'
        and information_schema.table_privileges.table_name = target_table_name
        and grantee = 'PUBLIC'
    ) then
      raise exception 'LEO560_RLS_PUBLIC_PRIVILEGE_POSTCONDITION_FAILED:%', target_table_name;
    end if;
  end loop;
end
$postflight$;

commit;
