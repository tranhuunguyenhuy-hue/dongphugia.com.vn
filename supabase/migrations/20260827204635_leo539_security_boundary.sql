-- LEO-539: empty Supabase runtime target security boundary.
--
-- This migration deliberately creates no LOGIN role and contains no secret.
-- Secret-bearing identities must be created later through an approved,
-- target-local secret-delivery path and may only inherit one capability role.

create role dpg_migration
  nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls
  connection limit 2;

create role dpg_runtime
  nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls
  connection limit 10;

create role dpg_readonly
  nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls
  connection limit 5;

-- The Supabase-managed postgres administrator may provision objects as these
-- capability roles. NOINHERIT keeps the capabilities explicit via SET ROLE.
grant dpg_migration, dpg_runtime, dpg_readonly to postgres;

alter role dpg_migration set application_name = 'dpg-migration';
alter role dpg_migration set statement_timeout = '5min';
alter role dpg_migration set lock_timeout = '5s';
alter role dpg_migration set idle_in_transaction_session_timeout = '30s';

alter role dpg_runtime set application_name = 'dpg-runtime';
alter role dpg_runtime set statement_timeout = '15s';
alter role dpg_runtime set lock_timeout = '3s';
alter role dpg_runtime set idle_in_transaction_session_timeout = '15s';

alter role dpg_readonly set application_name = 'dpg-readonly';
alter role dpg_readonly set default_transaction_read_only = 'on';
alter role dpg_readonly set statement_timeout = '30s';
alter role dpg_readonly set lock_timeout = '3s';
alter role dpg_readonly set idle_in_transaction_session_timeout = '15s';

create schema dpg_app authorization dpg_migration;
create schema dpg_control authorization dpg_migration;

revoke all on schema dpg_app from public, anon, authenticated, service_role;
revoke all on schema dpg_control from public, anon, authenticated, service_role;
grant usage on schema dpg_app to dpg_runtime, dpg_readonly;
grant usage on schema dpg_app to authenticated;
grant usage on schema dpg_control to dpg_migration, dpg_readonly;

alter default privileges for role dpg_migration in schema dpg_app
  revoke all on tables from public, anon, authenticated, service_role;
alter default privileges for role dpg_migration in schema dpg_app
  revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges for role dpg_migration in schema dpg_app
  revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role dpg_migration in schema dpg_app
  grant select, insert, update, delete on tables to dpg_runtime;
alter default privileges for role dpg_migration in schema dpg_app
  grant select on tables to dpg_readonly;
alter default privileges for role dpg_migration in schema dpg_app
  grant usage, select on sequences to dpg_runtime;

create table dpg_control.target_contract (
  singleton boolean primary key default true check (singleton),
  project_name text not null check (project_name = 'dongphugia-runtime'),
  region text not null check (region = 'ap-southeast-1'),
  environment text not null check (environment = 'preview'),
  data_class text not null check (data_class = 'synthetic-only'),
  production_data_allowed boolean not null check (not production_data_allowed),
  production_credentials_allowed boolean not null check (not production_credentials_allowed),
  production_writes_allowed boolean not null check (not production_writes_allowed),
  hard_database_ceiling_bytes bigint not null
    check (hard_database_ceiling_bytes = 367001600)
);

alter table dpg_control.target_contract owner to dpg_migration;
revoke all on table dpg_control.target_contract
  from public, anon, authenticated, service_role, dpg_runtime;
grant select on table dpg_control.target_contract to dpg_readonly;

insert into dpg_control.target_contract (
  project_name,
  region,
  environment,
  data_class,
  production_data_allowed,
  production_credentials_allowed,
  production_writes_allowed,
  hard_database_ceiling_bytes
) values (
  'dongphugia-runtime',
  'ap-southeast-1',
  'preview',
  'synthetic-only',
  false,
  false,
  false,
  367001600
);

create view dpg_control.free_tier_database_guard
with (security_invoker = true)
as
select
  pg_database_size(current_database()) as database_bytes,
  262144000::bigint as alert_250_mib_bytes,
  314572800::bigint as alert_300_mib_bytes,
  367001600::bigint as hard_stop_350_mib_bytes,
  case
    when pg_database_size(current_database()) >= 367001600 then 'HARD_STOP'
    when pg_database_size(current_database()) >= 314572800 then 'ALERT_300_MIB'
    when pg_database_size(current_database()) >= 262144000 then 'ALERT_250_MIB'
    else 'WITHIN_BUDGET'
  end as status;

alter view dpg_control.free_tier_database_guard owner to dpg_migration;
revoke all on dpg_control.free_tier_database_guard
  from public, anon, authenticated, service_role, dpg_runtime;
grant select on dpg_control.free_tier_database_guard to dpg_readonly;

create function dpg_control.assert_free_tier_headroom(requested_bytes bigint default 0)
returns void
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  projected_bytes bigint;
begin
  if requested_bytes < 0 then
    raise exception 'requested_bytes must be non-negative';
  end if;

  projected_bytes := pg_database_size(current_database()) + requested_bytes;

  if projected_bytes > 367001600 then
    raise exception 'LEO-539 free-tier hard stop: projected database size exceeds 350 MiB';
  end if;
end;
$$;

alter function dpg_control.assert_free_tier_headroom(bigint) owner to dpg_migration;
revoke execute on function dpg_control.assert_free_tier_headroom(bigint)
  from public, anon, authenticated, service_role, dpg_runtime, dpg_readonly;
grant execute on function dpg_control.assert_free_tier_headroom(bigint)
  to dpg_migration;

create table dpg_app.leo539_rls_probe (
  id uuid primary key,
  owner_id uuid not null,
  environment text not null default 'preview' check (environment = 'preview'),
  data_class text not null default 'synthetic' check (data_class = 'synthetic'),
  payload text not null check (payload like 'SYNTHETIC-%'),
  created_at timestamptz not null default now()
);

alter table dpg_app.leo539_rls_probe owner to dpg_migration;
alter table dpg_app.leo539_rls_probe enable row level security;
alter table dpg_app.leo539_rls_probe force row level security;

revoke all on table dpg_app.leo539_rls_probe
  from public, anon, authenticated, service_role, dpg_runtime, dpg_readonly;
grant select, insert, update, delete on table dpg_app.leo539_rls_probe
  to authenticated, dpg_runtime;
grant select on table dpg_app.leo539_rls_probe to dpg_readonly;

create policy leo539_authenticated_select_own
on dpg_app.leo539_rls_probe
for select
to authenticated, dpg_runtime
using (
  (select auth.uid()) = owner_id
  and environment = 'preview'
  and data_class = 'synthetic'
);

create policy leo539_authenticated_insert_own
on dpg_app.leo539_rls_probe
for insert
to authenticated, dpg_runtime
with check (
  (select auth.uid()) = owner_id
  and environment = 'preview'
  and data_class = 'synthetic'
);

create policy leo539_authenticated_update_own
on dpg_app.leo539_rls_probe
for update
to authenticated, dpg_runtime
using (
  (select auth.uid()) = owner_id
  and environment = 'preview'
  and data_class = 'synthetic'
)
with check (
  (select auth.uid()) = owner_id
  and environment = 'preview'
  and data_class = 'synthetic'
);

create policy leo539_authenticated_delete_own
on dpg_app.leo539_rls_probe
for delete
to authenticated, dpg_runtime
using (
  (select auth.uid()) = owner_id
  and environment = 'preview'
  and data_class = 'synthetic'
);

create policy leo539_readonly_select_synthetic
on dpg_app.leo539_rls_probe
for select
to dpg_readonly
using (
  environment = 'preview'
  and data_class = 'synthetic'
);

-- Harden the exposed schema only after the migration-owned probe exists.
revoke create on schema public from public, anon, authenticated;
