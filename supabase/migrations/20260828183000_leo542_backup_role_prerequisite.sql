-- LEO-542: reproducible passwordless capability required by later backup grants.
-- This migration changes no schema data, privileges, credentials, or consumers.

do $backup_role_prerequisite$
declare
  backup_role_oid oid;
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

  select oid into strict backup_role_oid
  from pg_roles
  where rolname = 'dpg_backup';

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

  if exists (
    select 1 from pg_auth_members
    where roleid = backup_role_oid or member = backup_role_oid
  ) or exists (
    select 1 from pg_class where relowner = backup_role_oid
  ) or exists (
    select 1 from pg_namespace where nspowner = backup_role_oid
  ) or exists (
    select 1 from pg_proc where proowner = backup_role_oid
  ) or exists (
    select 1 from pg_type where typowner = backup_role_oid
  ) or exists (
    select 1 from pg_database where datdba = backup_role_oid
  ) or exists (
    select 1 from pg_tablespace where spcowner = backup_role_oid
  ) or exists (
    select 1 from pg_extension where extowner = backup_role_oid
  ) or exists (
    select 1 from pg_default_acl defaults
    where defaults.defaclrole = backup_role_oid
       or exists (
         select 1 from aclexplode(defaults.defaclacl) acl
         where acl.grantee = backup_role_oid
       )
  ) or exists (
    select 1 from pg_class objects
    cross join lateral aclexplode(objects.relacl) acl
    where acl.grantee = backup_role_oid
  ) or exists (
    select 1 from pg_namespace schemas
    cross join lateral aclexplode(schemas.nspacl) acl
    where acl.grantee = backup_role_oid
  ) or exists (
    select 1 from pg_proc functions
    cross join lateral aclexplode(functions.proacl) acl
    where acl.grantee = backup_role_oid
  ) or exists (
    select 1 from pg_database databases
    cross join lateral aclexplode(databases.datacl) acl
    where acl.grantee = backup_role_oid
  ) or exists (
    select 1 from pg_policy policies
    where backup_role_oid = any (policies.polroles)
  ) or exists (
    select 1 from pg_db_role_setting settings
    where settings.setrole = backup_role_oid
  ) then
    raise exception 'LEO542_BACKUP_ROLE_AUTHORITY_DRIFT_FAILED';
  end if;
end
$backup_role_prerequisite$;
