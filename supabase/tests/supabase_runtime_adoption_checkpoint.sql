\set ON_ERROR_STOP on
begin transaction isolation level repeatable read read only;

do $checkpoint_catalogue$
declare
  role_drift boolean;
  membership_drift boolean;
  setting_drift boolean;
  table_name text;
  has_rows boolean;
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

  with expected(role_name, can_login, connection_limit) as (values
    ('dpg_migration', false, 2),
    ('dpg_runtime', false, 10),
    ('dpg_readonly', false, 5),
    ('dpg_migration_login', true, 2),
    ('dpg_runtime_login', true, 10),
    ('dpg_readonly_login', true, 5)
  ), actual as (
    select rolname as role_name, rolcanlogin as can_login,
           rolconnlimit as connection_limit
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

  if exists (
    (select family_key, label, source, confidence
     from dpg_app.product_families
     except values ('toto:ms885', 'TOTO MS885', 'toto-catalogue', 'high'))
    union all
    (values ('toto:ms885', 'TOTO MS885', 'toto-catalogue', 'high')
     except select family_key, label, source, confidence
            from dpg_app.product_families)
  ) or exists (
    (select family.family_key, configuration.group_key, configuration.label,
            configuration.sort_order, configuration.source, configuration.confidence
     from dpg_app.product_family_configuration_groups configuration
     join dpg_app.product_families family on family.id = configuration.family_id
     except values
       ('toto:ms885', 'ecowasher', 'nắp rửa cơ', 0, 'toto-catalogue', 'high'),
       ('toto:ms885', 'electronic-washlet', 'nắp điện tử', 1, 'toto-catalogue', 'high'),
       ('toto:ms885', 'soft-close', 'nắp đóng êm', 2, 'toto-catalogue', 'high'))
    union all
    (values
       ('toto:ms885', 'ecowasher', 'nắp rửa cơ', 0, 'toto-catalogue', 'high'),
       ('toto:ms885', 'electronic-washlet', 'nắp điện tử', 1, 'toto-catalogue', 'high'),
       ('toto:ms885', 'soft-close', 'nắp đóng êm', 2, 'toto-catalogue', 'high')
     except select family.family_key, configuration.group_key, configuration.label,
                   configuration.sort_order, configuration.source, configuration.confidence
            from dpg_app.product_family_configuration_groups configuration
            join dpg_app.product_families family on family.id = configuration.family_id)
  ) or exists (
    (select family.family_key, gap.member_key, gap.gap_type, gap.status,
            gap.source, gap.confidence, gap.note
     from dpg_app.product_family_catalogue_gaps gap
     join dpg_app.product_families family on family.id = gap.family_id
     except values
       ('toto:ms885', 'MS885DW4#XW', 'missing_product', 'open', 'toto-catalogue', 'high',
        'Approved canonical member; Product row is not fabricated by M2.3.'),
       ('toto:ms885', 'MS885DW18#XW', 'missing_product', 'open', 'toto-catalogue', 'high',
        'Approved canonical member; Product row is not fabricated by M2.3.'))
    union all
    (values
       ('toto:ms885', 'MS885DW4#XW', 'missing_product', 'open', 'toto-catalogue', 'high',
        'Approved canonical member; Product row is not fabricated by M2.3.'),
       ('toto:ms885', 'MS885DW18#XW', 'missing_product', 'open', 'toto-catalogue', 'high',
        'Approved canonical member; Product row is not fabricated by M2.3.')
     except select family.family_key, gap.member_key, gap.gap_type, gap.status,
                   gap.source, gap.confidence, gap.note
            from dpg_app.product_family_catalogue_gaps gap
            join dpg_app.product_families family on family.id = gap.family_id)
  ) or exists (select 1 from dpg_app.product_family_memberships) then
    raise exception 'SUPABASE_CHECKPOINT_SEED_DRIFT_FAILED';
  end if;

  for table_name in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'dpg_app'
      and c.relkind in ('r', 'p')
      and c.relname not in (
        'product_families', 'product_family_configuration_groups',
        'product_family_catalogue_gaps', 'product_family_memberships'
      )
    order by c.relname
  loop
    execute format('select exists(select 1 from dpg_app.%I limit 1)', table_name)
      into has_rows;
    if has_rows then
      raise exception 'SUPABASE_CHECKPOINT_UNEXPECTED_ROWS table=%', table_name;
    end if;
  end loop;
end
$checkpoint_catalogue$;

rollback;
