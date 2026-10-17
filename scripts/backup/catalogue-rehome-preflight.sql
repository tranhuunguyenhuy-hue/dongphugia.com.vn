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
     or to_regclass('dpg_control.leo538_restore_manifest') is null then
    raise exception 'CATALOGUE_REHOME_SCHEMA_INCOMPLETE';
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
