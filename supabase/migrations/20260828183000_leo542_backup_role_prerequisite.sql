-- LEO-542: reproducible passwordless capability required by later backup grants.
-- This migration changes no schema data, privileges, credentials, or consumers.

do $backup_role_prerequisite$
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
      and pg_database_size(current_database()) <= hard_database_ceiling_bytes
  ) then
    raise exception 'LEO542_BACKUP_ROLE_TARGET_CONTRACT_FAILED';
  end if;

  if not exists (select 1 from pg_roles where rolname = 'dpg_backup') then
    create role dpg_backup
      noinherit nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;

  if exists (
    select 1
    from pg_roles
    where rolname = 'dpg_backup'
      and (
        rolinherit
        or rolcanlogin
        or rolsuper
        or rolcreatedb
        or rolcreaterole
        or rolreplication
        or rolbypassrls
      )
  ) then
    raise exception 'LEO542_BACKUP_ROLE_CONTRACT_FAILED';
  end if;
end
$backup_role_prerequisite$;
