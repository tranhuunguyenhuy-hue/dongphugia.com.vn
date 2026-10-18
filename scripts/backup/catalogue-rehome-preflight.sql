-- Read-only target gate for Issue #158. This query returns no database rows.

do $catalogue_rehome_preflight$
declare
  table_name text;
  has_rows boolean;
begin
  if current_setting('server_version_num')::integer < 170000
     or current_setting('server_version_num')::integer >= 180000 then
    raise exception 'CATALOGUE_REHOME_POSTGRES_VERSION_FAILED';
  end if;

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
    raise exception 'CATALOGUE_REHOME_TARGET_CONTRACT_FAILED';
  end if;

  if to_regclass('dpg_v1.products') is null
     or to_regclass('dpg_app.products') is null
     or to_regclass('dpg_control.leo538_restore_manifest') is null
     or to_regclass('dpg_control.runtime_migration_ledger') is null
     or to_regprocedure('dpg_v1_api.public_product_get(uuid)') is null
     or to_regprocedure('dpg_v1_api.catalogue_media_register(jsonb,text)') is null
     or to_regprocedure('dpg_v1_api.order_intake_create(jsonb,text)') is null then
    raise exception 'CATALOGUE_REHOME_SCHEMA_INCOMPLETE';
  end if;

  if (select count(*) from dpg_control.runtime_migration_ledger) <> 22 then
    raise exception 'CATALOGUE_REHOME_MIGRATION_LEDGER_INCOMPLETE';
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('dpg_app', 'dpg_control', 'dpg_v1')
      and c.relkind in ('r', 'p')
      and (not c.relrowsecurity or not c.relforcerowsecurity)
  ) then
    raise exception 'CATALOGUE_REHOME_RLS_INCOMPLETE';
  end if;

  if exists (
    select 1
    from pg_roles
    where rolname in ('dpg_migration', 'dpg_runtime', 'dpg_readonly', 'dpg_backup')
      and (rolsuper or rolcreatedb or rolcreaterole or rolcanlogin or rolinherit
           or rolreplication or rolbypassrls)
  ) or (
    select count(*)
    from pg_roles
    where rolname in ('dpg_migration', 'dpg_runtime', 'dpg_readonly', 'dpg_backup')
  ) <> 4 then
    raise exception 'CATALOGUE_REHOME_ROLE_CONTRACT_FAILED';
  end if;

  if exists (
    select 1
    from pg_auth_members memberships
    join pg_roles granted_role on granted_role.oid = memberships.roleid
    join pg_roles member_role on member_role.oid = memberships.member
    where granted_role.rolname = 'dpg_backup' or member_role.rolname = 'dpg_backup'
  ) then
    raise exception 'CATALOGUE_REHOME_BACKUP_ROLE_MEMBERSHIP_FAILED';
  end if;

  if exists (select 1 from auth.users limit 1) then
    raise exception 'CATALOGUE_REHOME_AUTH_NOT_EMPTY';
  end if;
  if exists (select 1 from storage.objects limit 1) then
    raise exception 'CATALOGUE_REHOME_STORAGE_NOT_EMPTY';
  end if;
  for table_name in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'dpg_v1'
      and c.relkind in ('r', 'p')
      and c.relname not in ('categories', 'role_capabilities')
    order by c.relname
  loop
    execute format('select exists(select 1 from dpg_v1.%I limit 1)', table_name)
      into has_rows;
    if has_rows then
      raise exception 'CATALOGUE_REHOME_V1_DATA_NOT_EMPTY table=%', table_name;
    end if;
  end loop;

  if (select count(*) from dpg_v1.categories) <> 4
     or exists (select 1 from dpg_v1.categories where parent_id is not null)
     or exists (
       (select id, sector, slug, sort_order from dpg_v1.categories)
       except values
         ('10000000-0000-4000-8000-000000000001'::uuid, 'sanitary', 'sanitary', 0),
         ('10000000-0000-4000-8000-000000000002'::uuid, 'tile', 'tile', 1),
         ('10000000-0000-4000-8000-000000000003'::uuid, 'water', 'water', 2),
         ('10000000-0000-4000-8000-000000000004'::uuid, 'kitchen', 'kitchen', 3)
     )
     or (select count(*) from dpg_v1.role_capabilities) <> 62 then
    raise exception 'CATALOGUE_REHOME_V1_SEED_DRIFT';
  end if;

  for table_name in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'dpg_app' and c.relkind in ('r', 'p')
    order by c.relname
  loop
    execute format('select exists(select 1 from dpg_app.%I limit 1)', table_name)
      into has_rows;
    if has_rows then
      raise exception 'CATALOGUE_REHOME_TARGET_NOT_EMPTY table=%', table_name;
    end if;
  end loop;

  if exists (select 1 from dpg_control.leo538_restore_manifest limit 1) then
    raise exception 'CATALOGUE_REHOME_MANIFEST_NOT_EMPTY';
  end if;
end
$catalogue_rehome_preflight$;

select dpg_control.assert_free_tier_headroom(114691219);
