-- LEO-539: target-local login identities and fail-closed write controls.
--
-- Passwords are generated inside Postgres and are never returned by this
-- migration. No application, CI, or operator may retrieve or record them as
-- evidence. A later approved consumer must reset its target-local credential
-- through a secret-delivery path before first use.

do $migration$
declare
  migration_secret text := gen_random_uuid()::text || gen_random_uuid()::text;
  runtime_secret text := gen_random_uuid()::text || gen_random_uuid()::text;
  readonly_secret text := gen_random_uuid()::text || gen_random_uuid()::text;
begin
  execute format(
    'create role dpg_migration_login login password %L nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls connection limit 2',
    migration_secret
  );
  execute format(
    'create role dpg_runtime_login login password %L nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls connection limit 10',
    runtime_secret
  );
  execute format(
    'create role dpg_readonly_login login password %L nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls connection limit 5',
    readonly_secret
  );
end
$migration$;

grant dpg_migration to dpg_migration_login;
grant dpg_runtime to dpg_runtime_login;
grant dpg_readonly to dpg_readonly_login;

-- Session defaults belong to the LOGIN identities. Capability-role settings
-- are reset because PostgreSQL does not re-apply them during SET ROLE.
alter role dpg_migration reset application_name;
alter role dpg_migration reset statement_timeout;
alter role dpg_migration reset lock_timeout;
alter role dpg_migration reset idle_in_transaction_session_timeout;
alter role dpg_runtime reset application_name;
alter role dpg_runtime reset statement_timeout;
alter role dpg_runtime reset lock_timeout;
alter role dpg_runtime reset idle_in_transaction_session_timeout;
alter role dpg_readonly reset application_name;
alter role dpg_readonly reset default_transaction_read_only;
alter role dpg_readonly reset statement_timeout;
alter role dpg_readonly reset lock_timeout;
alter role dpg_readonly reset idle_in_transaction_session_timeout;

alter role dpg_migration_login set application_name = 'dpg-migration';
alter role dpg_migration_login set statement_timeout = '5min';
alter role dpg_migration_login set lock_timeout = '5s';
alter role dpg_migration_login set idle_in_transaction_session_timeout = '30s';

alter role dpg_runtime_login set application_name = 'dpg-runtime';
alter role dpg_runtime_login set statement_timeout = '15s';
alter role dpg_runtime_login set lock_timeout = '3s';
alter role dpg_runtime_login set idle_in_transaction_session_timeout = '15s';

alter role dpg_readonly_login set application_name = 'dpg-readonly';
alter role dpg_readonly_login set default_transaction_read_only = 'on';
alter role dpg_readonly_login set statement_timeout = '30s';
alter role dpg_readonly_login set lock_timeout = '3s';
alter role dpg_readonly_login set idle_in_transaction_session_timeout = '15s';

-- Future tables are deny-by-default. Each table must receive explicit grants,
-- forced RLS, policies, and a size-guard trigger in its reviewed migration.
alter default privileges for role dpg_migration in schema dpg_app
  revoke select, insert, update, delete on tables from dpg_runtime;
alter default privileges for role dpg_migration in schema dpg_app
  revoke select on tables from dpg_readonly;
alter default privileges for role dpg_migration in schema dpg_app
  revoke usage, select on sequences from dpg_runtime;

create function dpg_control.enforce_free_tier_headroom()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if pg_database_size(current_database()) + pg_column_size(new)::bigint > 367001600 then
    raise exception 'LEO-539 free-tier hard stop: projected database size exceeds 350 MiB';
  end if;
  return new;
end;
$$;

alter function dpg_control.enforce_free_tier_headroom() owner to dpg_migration;
revoke execute on function dpg_control.enforce_free_tier_headroom()
  from public, anon, authenticated, service_role, dpg_runtime, dpg_readonly;

create trigger leo539_free_tier_headroom
before insert or update on dpg_app.leo539_rls_probe
for each row execute function dpg_control.enforce_free_tier_headroom();
