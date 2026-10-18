\set ON_ERROR_STOP on
begin transaction isolation level repeatable read read only;

do $checkpoint_catalogue$
declare
  role_drift boolean;
  membership_drift boolean;
  setting_drift boolean;
begin
  if current_setting('server_version_num')::integer not between 170000 and 179999 then
    raise exception 'SUPABASE_CHECKPOINT_POSTGRES_VERSION_FAILED';
  end if;

  if not exists (
    select 1 from dpg_control.target_contract
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
    raise exception 'SUPABASE_CHECKPOINT_TARGET_FAILED';
  end if;

  with expected(role_name, can_login) as (values
    ('dpg_migration', false), ('dpg_runtime', false), ('dpg_readonly', false),
    ('dpg_migration_login', true), ('dpg_runtime_login', true), ('dpg_readonly_login', true)
  ), actual as (
    select rolname as role_name, rolcanlogin as can_login
    from pg_roles
    where rolname like 'dpg\_%' escape '\'
  )
  select exists (
    (select * from expected except select * from actual)
    union all
    (select * from actual except select * from expected)
  ) into role_drift;
  if role_drift or exists (
    select 1 from pg_roles
    where rolname like 'dpg\_%' escape '\'
      and (rolsuper or rolcreatedb or rolcreaterole or rolinherit or rolreplication or rolbypassrls)
  ) then
    raise exception 'SUPABASE_CHECKPOINT_ROLE_FAILED';
  end if;

  with expected(granted_role, member_role) as (values
    ('dpg_migration', 'dpg_migration_login'), ('dpg_migration', 'postgres'),
    ('dpg_runtime', 'dpg_runtime_login'), ('dpg_runtime', 'postgres'),
    ('dpg_readonly', 'dpg_readonly_login'), ('dpg_readonly', 'postgres')
  ), actual as (
    select granted.rolname, member.rolname
    from pg_auth_members memberships
    join pg_roles granted on granted.oid = memberships.roleid
    join pg_roles member on member.oid = memberships.member
    where granted.rolname like 'dpg\_%' escape '\'
       or member.rolname like 'dpg\_%' escape '\'
  )
  select exists (
    (select * from expected except select * from actual)
    union all
    (select * from actual except select * from expected)
  ) into membership_drift;
  if membership_drift then
    raise exception 'SUPABASE_CHECKPOINT_MEMBERSHIP_FAILED';
  end if;

  with expected(role_name, setting) as (values
    ('dpg_migration_login', 'application_name=dpg-migration'),
    ('dpg_migration_login', 'idle_in_transaction_session_timeout=30s'),
    ('dpg_migration_login', 'lock_timeout=5s'),
    ('dpg_migration_login', 'statement_timeout=5min'),
    ('dpg_runtime_login', 'application_name=dpg-runtime'),
    ('dpg_runtime_login', 'idle_in_transaction_session_timeout=15s'),
    ('dpg_runtime_login', 'lock_timeout=3s'),
    ('dpg_runtime_login', 'statement_timeout=15s'),
    ('dpg_readonly_login', 'application_name=dpg-readonly'),
    ('dpg_readonly_login', 'default_transaction_read_only=on'),
    ('dpg_readonly_login', 'idle_in_transaction_session_timeout=15s'),
    ('dpg_readonly_login', 'lock_timeout=3s'),
    ('dpg_readonly_login', 'statement_timeout=30s')
  ), actual as (
    select roles.rolname, unnest(settings.setconfig)
    from pg_db_role_setting settings
    join pg_roles roles on roles.oid = settings.setrole
    where roles.rolname like 'dpg\_%' escape '\'
  )
  select exists (
    (select * from expected except select * from actual)
    union all
    (select * from actual except select * from expected)
  ) into setting_drift;
  if setting_drift then
    raise exception 'SUPABASE_CHECKPOINT_ROLE_SETTING_FAILED';
  end if;

  if to_regclass('dpg_app.leo539_rls_probe') is null
     or to_regclass('dpg_control.leo538_restore_manifest') is null
     or to_regclass('dpg_app.runtime_idempotency_records') is null
     or to_regclass('dpg_app.runtime_audit_events') is null
     or to_regprocedure('public.runtime_order_create(jsonb,text,uuid)') is null
     or to_regprocedure('public.runtime_order_get(integer)') is null
     or to_regprocedure('public.runtime_order_list(integer,integer)') is null
     or to_regprocedure('public.runtime_order_update(integer,jsonb,text,uuid)') is null
     or to_regprocedure('public.runtime_order_delete(integer,text,uuid)') is null
     or to_regprocedure('public.runtime_quote_create(jsonb,text,uuid)') is null
     or to_regprocedure('public.runtime_quote_get(integer)') is null
     or to_regprocedure('public.runtime_quote_list(integer,integer)') is null
     or to_regprocedure('public.runtime_quote_update(integer,jsonb,text,uuid)') is null
     or to_regprocedure('public.runtime_quote_delete(integer,text,uuid)') is null then
    raise exception 'SUPABASE_CHECKPOINT_SCHEMA_FAILED';
  end if;

  if exists (select 1 from auth.users)
     or exists (select 1 from storage.objects)
     or exists (select 1 from dpg_control.leo538_restore_manifest)
     or exists (select 1 from dpg_app.leo539_rls_probe) then
    raise exception 'SUPABASE_CHECKPOINT_EMPTY_TARGET_FAILED';
  end if;
end
$checkpoint_catalogue$;

rollback;
