#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
database_url="${DATABASE_URL:?DATABASE_URL must point to the ephemeral PostgreSQL database}"

psql_args=(--dbname "$database_url" --no-psqlrc --set ON_ERROR_STOP=1)

psql "${psql_args[@]}" <<'SQL'
do $fixture$
declare
  role_name text;
begin
  foreach role_name in array array[
    'dpg_migration', 'dpg_readonly', 'dpg_runtime',
    'anon', 'authenticated', 'service_role'
  ] loop
    if not exists (select 1 from pg_roles where rolname = role_name) then
      execute format(
        'create role %I nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls',
        role_name
      );
    end if;
  end loop;
end
$fixture$;

grant dpg_migration, dpg_readonly to postgres;

create schema dpg_control authorization dpg_migration;
create schema extensions authorization dpg_migration;
revoke all on schema dpg_control, extensions from public, anon, authenticated, service_role;
grant usage on schema dpg_control to dpg_migration, dpg_readonly;

create table dpg_control.target_contract (
  singleton boolean primary key default true check (singleton),
  project_name text not null,
  region text not null,
  environment text not null,
  data_class text not null,
  production_data_allowed boolean not null,
  production_credentials_allowed boolean not null,
  production_writes_allowed boolean not null,
  hard_database_ceiling_bytes bigint not null
);
alter table dpg_control.target_contract owner to dpg_migration;
alter table dpg_control.target_contract enable row level security;
alter table dpg_control.target_contract force row level security;
create policy target_contract_migration on dpg_control.target_contract
  for all to dpg_migration using (true) with check (true);
insert into dpg_control.target_contract (
  project_name, region, environment, data_class,
  production_data_allowed, production_credentials_allowed,
  production_writes_allowed, hard_database_ceiling_bytes
) values (
  'dongphugia-runtime', 'ap-southeast-1', 'preview', 'synthetic-only',
  false, false, false, 367001600
);

create function dpg_control.assert_free_tier_headroom(requested_bytes bigint default 0)
returns void
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
begin
  if requested_bytes < 0 then
    raise exception 'requested_bytes must be non-negative';
  end if;
  if pg_database_size(current_database()) + requested_bytes > 367001600 then
    raise exception 'ephemeral free-tier fixture budget exceeded';
  end if;
end
$function$;
alter function dpg_control.assert_free_tier_headroom(bigint) owner to dpg_migration;
revoke all on function dpg_control.assert_free_tier_headroom(bigint)
  from public, anon, authenticated, service_role, dpg_runtime, dpg_readonly;
grant execute on function dpg_control.assert_free_tier_headroom(bigint) to dpg_migration;
SQL

psql "${psql_args[@]}" --file "$root_dir/supabase/migrations/20260829100000_leo543_scheduler.sql"
psql "${psql_args[@]}" --file "$root_dir/supabase/tests/leo543_scheduler.sql"

echo 'LEO-543 PostgreSQL 17 acceptance PASS; the job-scoped service is torn down by GitHub Actions.'
