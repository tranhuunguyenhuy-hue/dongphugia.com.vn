import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import pg from 'pg'

import { parseSupabaseRuntimeTarget } from './supabase-runtime-target.mjs'

const { Client } = pg

export const ADOPTED_CHECKPOINT_MIGRATIONS = [
  '20260827204635_leo539_security_boundary.sql',
  '20260827204730_leo539_control_rls_hardening.sql',
  '20260827210019_leo539_login_and_fail_closed_writes.sql',
  '20260828110000_leo538_runtime_schema.sql',
  '20260828120000_leo538_runtime_data_boundary.sql',
  '20260828130000_leo538_reconciliation_manifest_authority.sql',
  '20260828163113_leo541_runtime_api.sql',
]

export const EXPECTED_RUNTIME_MIGRATIONS = [
  ...ADOPTED_CHECKPOINT_MIGRATIONS,
  '20260828183000_leo542_backup_role_prerequisite.sql',
  '20260828183714_leo542_backup_coverage_prerequisite.sql',
  '20260828184629_leo542_backup_sequence_coverage_prerequisite.sql',
  '20260828185021_leo542_admin_publishing_runtime.sql',
  '20260828192202_leo542_actor_context_claim_bridge_fix.sql',
  '20260828192707_leo542_actor_context_return_fix.sql',
  '20260828192911_leo542_authorization_read_guards.sql',
  '20260828193028_leo542_acceptance_rollback_probe_fix.sql',
  '20260828200632_leo542_remove_acceptance_rollback_helper.sql',
  '20260830004338_leo561_canonical_v1_schema.sql',
  '20260831173342_leo564_v1_auth_rls_services.sql',
  '20260901150000_leo564_guest_input_null_guard.sql',
  '20260901170000_leo565_media_foundation.sql',
  '20260903165000_owner_v1_pricing_contract.sql',
  '20261016090000_leo560_preview_rls_hardening.sql',
]

const migrationsDirectory = path.resolve('supabase/migrations')

function fail(reason) {
  throw new Error(reason)
}

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

export function stripOuterTransaction(sql) {
  const lines = sql.split(/\r?\n/)
  const controls = lines
    .map((line, index) => ({ index, value: line.trim().toLowerCase() }))
    .filter(({ value }) => ['begin;', 'commit;', 'rollback;', 'start transaction;'].includes(value))

  if (controls.length === 0) return sql
  if (controls.length !== 2
    || controls[0].value !== 'begin;'
    || controls[1].value !== 'commit;'
    || controls[0].index >= controls[1].index) {
    fail('migration_transaction_contract_changed')
  }
  lines[controls[0].index] = ''
  lines[controls[1].index] = ''
  return lines.join('\n')
}

async function loadMigrations() {
  const actual = (await readdir(migrationsDirectory))
    .filter((name) => name.endsWith('.sql'))
    .sort()
  if (JSON.stringify(actual) !== JSON.stringify(EXPECTED_RUNTIME_MIGRATIONS)) {
    fail('migration_set_changed')
  }

  return Promise.all(EXPECTED_RUNTIME_MIGRATIONS.map(async (filename) => {
    const bytes = await readFile(path.join(migrationsDirectory, filename))
    return { filename, sha256: digest(bytes), sql: bytes.toString('utf8') }
  }))
}

async function configure(client) {
  await client.query("set statement_timeout = '60s'")
  await client.query("set lock_timeout = '5s'")
  await client.query("set idle_in_transaction_session_timeout = '90s'")
  await client.query("set application_name = 'dongphugia-supabase-runtime-rehome'")
}

async function attestTargetAndCheckpoint(client) {
  const result = await client.query(`
    select
      current_setting('server_version_num')::integer between 170000 and 179999 as postgres_17,
      exists (
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
      ) as target_exact,
      to_regclass('dpg_app.products') is not null as runtime_schema,
      to_regclass('dpg_control.leo538_restore_manifest') is not null as restore_manifest,
      to_regclass('dpg_app.runtime_idempotency_records') is not null as runtime_idempotency,
      to_regclass('dpg_app.runtime_audit_events') is not null as runtime_audit,
      to_regprocedure('public.runtime_order_list(integer,integer)') is not null as runtime_api,
      not exists (select 1 from pg_roles where rolname = 'dpg_backup') as backup_role_absent,
      to_regnamespace('dpg_v1') is null as v1_absent,
      not exists (select 1 from auth.users) as auth_empty,
      not exists (select 1 from storage.objects) as storage_empty
  `)
  const row = result.rows[0]
  if (!row || Object.values(row).some((value) => value !== true)) {
    fail('adoption_checkpoint_mismatch')
  }
}

async function ledgerExists(client) {
  const result = await client.query("select to_regclass('dpg_control.runtime_migration_ledger') is not null as present")
  return result.rows[0]?.present === true
}

async function createLedgerAndAdoptCheckpoint(client, migrations) {
  await attestTargetAndCheckpoint(client)
  await client.query('begin isolation level serializable')
  try {
    await client.query(`
      create table dpg_control.runtime_migration_ledger (
        version text primary key,
        filename text not null unique,
        sha256 char(64) not null,
        application_source text not null check (application_source in ('checkpoint-adopted', 'runner-applied')),
        applied_at timestamptz not null default clock_timestamp()
      );
      alter table dpg_control.runtime_migration_ledger owner to dpg_migration;
      alter table dpg_control.runtime_migration_ledger enable row level security;
      alter table dpg_control.runtime_migration_ledger force row level security;
      revoke all on table dpg_control.runtime_migration_ledger
        from public, anon, authenticated, service_role, dpg_runtime, dpg_readonly;
    `)
    for (const migration of migrations.slice(0, ADOPTED_CHECKPOINT_MIGRATIONS.length)) {
      await client.query(
        `insert into dpg_control.runtime_migration_ledger
          (version, filename, sha256, application_source)
         values ($1, $2, $3, 'checkpoint-adopted')`,
        [migration.filename.slice(0, 14), migration.filename, migration.sha256],
      )
    }
    await client.query('commit')
  } catch (error) {
    await client.query('rollback').catch(() => undefined)
    throw error
  }
}

async function readLedger(client) {
  const result = await client.query(`
    select version, filename, sha256, application_source
    from dpg_control.runtime_migration_ledger
    order by version
  `)
  return result.rows
}

function validateLedger(rows, migrations, requireComplete) {
  const expectedByName = new Map(migrations.map((migration) => [migration.filename, migration]))
  if (rows.some((row) => !expectedByName.has(row.filename)
    || expectedByName.get(row.filename).sha256 !== row.sha256.trim()
    || row.version !== row.filename.slice(0, 14))) {
    fail('migration_ledger_drift')
  }
  if (requireComplete && rows.length !== migrations.length) fail('migration_state_incomplete')
}

async function applyPendingMigrations(client, migrations) {
  const applied = new Set((await readLedger(client)).map((row) => row.filename))
  for (const migration of migrations) {
    if (applied.has(migration.filename)) continue
    await client.query('begin isolation level serializable')
    try {
      await client.query(stripOuterTransaction(migration.sql))
      await client.query(
        `insert into dpg_control.runtime_migration_ledger
          (version, filename, sha256, application_source)
         values ($1, $2, $3, 'runner-applied')`,
        [migration.filename.slice(0, 14), migration.filename, migration.sha256],
      )
      await client.query('commit')
    } catch (error) {
      await client.query('rollback').catch(() => undefined)
      process.stderr.write(`SUPABASE_RUNTIME_MIGRATIONS status=FAIL stage=apply migration=${migration.filename}\n`)
      throw error
    }
  }
}

async function validateFinalSchema(client) {
  const result = await client.query(`
    select
      to_regclass('dpg_v1.products') is not null as v1_products,
      to_regclass('dpg_v1.media_variants') is not null as v1_media_variants,
      to_regprocedure('dpg_v1_api.public_product_get(uuid)') is not null as public_product_api,
      to_regprocedure('dpg_v1_api.catalogue_media_register(jsonb,text)') is not null as media_register_api,
      to_regprocedure('dpg_v1_api.order_intake_create(jsonb,text)') is not null as order_intake_api,
      not exists (
        select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname in ('dpg_app', 'dpg_control', 'dpg_v1')
          and c.relkind in ('r', 'p')
          and (not c.relrowsecurity or not c.relforcerowsecurity)
      ) as all_runtime_tables_forced_rls,
      not exists (
        select 1 from pg_roles
        where rolname in ('dpg_migration', 'dpg_runtime', 'dpg_readonly', 'dpg_backup')
          and (rolsuper or rolcreatedb or rolcreaterole or rolcanlogin or rolinherit
               or rolreplication or rolbypassrls)
      ) as roles_restricted,
      (select count(*) from pg_roles
       where rolname in ('dpg_migration', 'dpg_runtime', 'dpg_readonly', 'dpg_backup')) = 4
        as roles_complete,
      not exists (select 1 from auth.users) as auth_empty,
      not exists (select 1 from storage.objects) as storage_empty
  `)
  const row = result.rows[0]
  if (!row || Object.values(row).some((value) => value !== true)) fail('final_schema_rls_api_validation_failed')
}

async function run() {
  const mode = process.argv[2]
  if (!['status', 'apply'].includes(mode)) fail('mode_invalid')
  const migrations = await loadMigrations()
  const client = new Client(parseSupabaseRuntimeTarget(process.env.SUPABASE_REHOME_DATABASE_URL))

  try {
    await client.connect()
    await configure(client)
    await client.query("select pg_advisory_lock(hashtext('dongphugia:supabase-runtime-migrations:v1'))")

    if (!(await ledgerExists(client))) {
      if (mode !== 'apply') fail('migration_state_incomplete')
      await createLedgerAndAdoptCheckpoint(client, migrations)
    }

    validateLedger(await readLedger(client), migrations, false)
    if (mode === 'apply') await applyPendingMigrations(client, migrations)
    validateLedger(await readLedger(client), migrations, true)
    await validateFinalSchema(client)
    process.stdout.write(`SUPABASE_RUNTIME_MIGRATIONS status=PASS mode=${mode} count=${migrations.length}\n`)
  } catch (error) {
    if (!String(error?.message ?? '').startsWith('migration_')) {
      process.stderr.write('SUPABASE_RUNTIME_MIGRATIONS status=FAIL reason=database_operation_failed\n')
    } else {
      process.stderr.write(`SUPABASE_RUNTIME_MIGRATIONS status=FAIL reason=${error.message}\n`)
    }
    process.exitCode = 1
  } finally {
    await client.query("select pg_advisory_unlock(hashtext('dongphugia:supabase-runtime-migrations:v1'))").catch(() => undefined)
    await client.end().catch(() => undefined)
  }
}

if (process.argv[1]?.endsWith('/supabase-runtime-migrations.mjs')) void run()
