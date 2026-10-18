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
    -- pg_shdepend is PostgreSQL's exhaustive cross-catalog authority index for
    -- role ownership, ACL grants, and policy dependencies in this database.
    select 1
    from pg_shdepend
    where refclassid = 'pg_authid'::regclass
      and refobjid = backup_role_oid
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
    select 1 from pg_conversion where conowner = backup_role_oid
  ) or exists (
    select 1 from pg_operator where oprowner = backup_role_oid
  ) or exists (
    select 1 from pg_opclass where opcowner = backup_role_oid
  ) or exists (
    select 1 from pg_opfamily where opfowner = backup_role_oid
  ) or exists (
    select 1 from pg_collation where collowner = backup_role_oid
  ) or exists (
    select 1 from pg_language where lanowner = backup_role_oid
  ) or exists (
    select 1 from pg_foreign_data_wrapper where fdwowner = backup_role_oid
  ) or exists (
    select 1 from pg_foreign_server where srvowner = backup_role_oid
  ) or exists (
    select 1 from pg_event_trigger where evtowner = backup_role_oid
  ) or exists (
    select 1 from pg_publication where pubowner = backup_role_oid
  ) or exists (
    select 1 from pg_subscription where subowner = backup_role_oid
  ) or exists (
    select 1 from pg_largeobject_metadata where lomowner = backup_role_oid
  ) or exists (
    select 1 from pg_statistic_ext where stxowner = backup_role_oid
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
    select 1 from pg_attribute columns
    cross join lateral aclexplode(columns.attacl) acl
    where acl.grantee = backup_role_oid
  ) or exists (
    select 1 from pg_type types
    cross join lateral aclexplode(types.typacl) acl
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
    select 1 from pg_tablespace tablespaces
    cross join lateral aclexplode(tablespaces.spcacl) acl
    where acl.grantee = backup_role_oid
  ) or exists (
    select 1 from pg_language languages
    cross join lateral aclexplode(languages.lanacl) acl
    where acl.grantee = backup_role_oid
  ) or exists (
    select 1 from pg_foreign_data_wrapper wrappers
    cross join lateral aclexplode(wrappers.fdwacl) acl
    where acl.grantee = backup_role_oid
  ) or exists (
    select 1 from pg_foreign_server servers
    cross join lateral aclexplode(servers.srvacl) acl
    where acl.grantee = backup_role_oid
  ) or exists (
    select 1 from pg_largeobject_metadata large_objects
    cross join lateral aclexplode(large_objects.lomacl) acl
    where acl.grantee = backup_role_oid
  ) or exists (
    select 1 from pg_parameter_acl parameters
    cross join lateral aclexplode(parameters.paracl) acl
    where acl.grantee = backup_role_oid
  ) or exists (
    select 1 from pg_policy policies
    where backup_role_oid = any (policies.polroles)
  ) or exists (
    select 1 from pg_user_mapping mappings
    where mappings.umuser = backup_role_oid
  ) or exists (
    select 1 from pg_db_role_setting settings
    where settings.setrole = backup_role_oid
  ) then
    raise exception 'LEO542_BACKUP_ROLE_AUTHORITY_DRIFT_FAILED';
  end if;
end
$backup_role_prerequisite$;
