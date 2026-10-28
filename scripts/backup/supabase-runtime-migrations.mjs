import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import pg from 'pg'

import { parseSupabaseRuntimeTarget } from './supabase-runtime-target.mjs'
import { supabaseRuntimeTlsOptions } from './supabase-runtime-tls.mjs'

const { Client } = pg
const DATABASE_SIZE_HARD_CEILING_BYTES = 367001600n

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
  '20260828183200_leo540_backup_coverage_prerequisite.sql',
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

export function validateDatabaseSize(currentSizeBytes, hardCeilingBytes) {
  if (currentSizeBytes === null || currentSizeBytes === undefined
    || hardCeilingBytes === null || hardCeilingBytes === undefined) {
    fail('database_size_unavailable')
  }
  if (!/^(0|[1-9]\d*)$/.test(String(currentSizeBytes))
    || !/^(0|[1-9]\d*)$/.test(String(hardCeilingBytes))) {
    fail('database_size_unavailable')
  }

  let currentSize
  let hardCeiling
  try {
    currentSize = BigInt(currentSizeBytes)
    hardCeiling = BigInt(hardCeilingBytes)
  } catch {
    fail('database_size_unavailable')
  }

  if (currentSize < 0n) fail('database_size_unavailable')
  if (hardCeiling !== DATABASE_SIZE_HARD_CEILING_BYTES) {
    fail('database_size_contract_mismatch')
  }
  if (currentSize >= hardCeiling) fail('database_size_hard_limit_reached')
  return currentSize
}

export async function assertDatabaseSizeWithinContract(client) {
  const result = await client.query(`
    select
      pg_database_size(current_database())::text as current_size_bytes,
      (select hard_database_ceiling_bytes::text
       from dpg_control.target_contract
       where singleton) as hard_ceiling_bytes
  `)
  const row = result.rows[0]
  if (!row) fail('database_size_unavailable')
  return validateDatabaseSize(row.current_size_bytes, row.hard_ceiling_bytes)
}

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

export function stripOuterTransaction(sql) {
  const lines = sql.split(/\r?\n/)
  const controls = lines
    .map((line, index) => ({ index, value: line.trim().toLowerCase() }))
    .filter(({ value }) => ['begin;', 'commit;', 'rollback;', 'start transaction;'].includes(value))

  if (controls.length === 0) {
    if (hasEmbeddedTransactionControl(sql)) fail('migration_transaction_contract_changed')
    return sql
  }
  if (controls.length !== 2
    || controls[0].value !== 'begin;'
    || controls[1].value !== 'commit;'
    || controls[0].index >= controls[1].index) {
    fail('migration_transaction_contract_changed')
  }
  lines[controls[0].index] = ''
  lines[controls[1].index] = ''
  const normalized = lines.join('\n')
  if (hasEmbeddedTransactionControl(normalized)) fail('migration_transaction_contract_changed')
  return normalized
}

function hasEmbeddedTransactionControl(sql) {
  const executable = []
  let index = 0

  const mask = (start, end) => executable.push(sql.slice(start, end).replace(/[^\r\n]/g, ' '))
  const previousCodePoint = (end) => {
    if (end <= 0) return ''
    let start = end - 1
    const lastCodeUnit = sql.charCodeAt(start)
    if (lastCodeUnit >= 0xdc00 && lastCodeUnit <= 0xdfff && start > 0) {
      const previousCodeUnit = sql.charCodeAt(start - 1)
      if (previousCodeUnit >= 0xd800 && previousCodeUnit <= 0xdbff) start -= 1
    }
    return sql.slice(start, end)
  }

  while (index < sql.length) {
    if (sql.startsWith('--', index)) {
      let end = index + 2
      while (end < sql.length && sql[end] !== '\n' && sql[end] !== '\r') end += 1
      mask(index, end)
      index = end
      continue
    }

    if (sql.startsWith('/*', index)) {
      let end = index + 2
      let depth = 1
      while (end < sql.length && depth > 0) {
        if (sql.startsWith('/*', end)) {
          depth += 1
          end += 2
        } else if (sql.startsWith('*/', end)) {
          depth -= 1
          end += 2
        } else {
          end += 1
        }
      }
      if (depth !== 0) return true
      mask(index, end)
      index = end
      continue
    }

    const previousCharacter = previousCodePoint(index)
    const dollarTag = sql[index] === '$'
      && !/[_$\p{ID_Continue}]/u.test(previousCharacter)
      ? /^\$(?:[_\p{ID_Start}][\p{ID_Continue}]*)?\$/u.exec(sql.slice(index))?.[0]
      : undefined
    if (dollarTag) {
      const closing = sql.indexOf(dollarTag, index + dollarTag.length)
      if (closing === -1) return true
      const end = closing + dollarTag.length
      mask(index, end)
      index = end
      continue
    }

    if (sql[index] === "'" || sql[index] === '"') {
      const quote = sql[index]
      const prefixIndex = index - previousCharacter.length
      const beforePrefix = previousCodePoint(prefixIndex)
      const escapeString = quote === "'"
        && /^[eE]$/.test(previousCharacter)
        && !/[_$\p{ID_Continue}]/u.test(beforePrefix)
      let end = index + 1
      let closed = false
      while (end < sql.length) {
        if (quote === "'" && escapeString && sql[end] === '\\') {
          end += 2
        } else if (sql[end] === quote && sql[end + 1] === quote) {
          end += 2
        } else if (sql[end] === quote) {
          end += 1
          closed = true
          break
        } else {
          end += 1
        }
      }
      if (!closed) return true
      mask(index, end)
      index = end
      continue
    }

    executable.push(sql[index])
    index += 1
  }

  return /\b(?:begin\b|start\s+transaction\b|commit\b|rollback\b|abort\b|savepoint\b|release\b|prepare\s+transaction\b|set\s+transaction\b)|(?:^|;)\s*end\b/i
    .test(executable.join(''))
}

export function stripReadOnlyOuterTransaction(sql) {
  const lines = sql.split(/\r?\n/)
  const controls = lines
    .map((line, index) => ({ index, value: line.trim().toLowerCase() }))
    .filter(({ value }) => [
      'begin transaction isolation level repeatable read read only;',
      'commit;',
      'rollback;',
      'start transaction;',
    ].includes(value))

  if (controls.length !== 2
    || controls[0].value !== 'begin transaction isolation level repeatable read read only;'
    || controls[1].value !== 'rollback;'
    || lines.slice(0, controls[0].index).some((line) => line.trim() !== '')
    || lines.slice(controls[1].index + 1).some((line) => line.trim() !== '')) {
    fail('readonly_acceptance_transaction_contract_changed')
  }

  lines[controls[0].index] = ''
  lines[controls[1].index] = ''

  if (hasEmbeddedTransactionControl(lines.join('\n'))) {
    fail('readonly_acceptance_transaction_contract_changed')
  }

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
  await assertDatabaseSizeWithinContract(client)
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
      grant select, insert on table dpg_control.runtime_migration_ledger to postgres;
      create policy runtime_migration_admin on dpg_control.runtime_migration_ledger
        for all to postgres using (true) with check (true);
    `)
    for (const migration of migrations.slice(0, ADOPTED_CHECKPOINT_MIGRATIONS.length)) {
      await client.query(
        `insert into dpg_control.runtime_migration_ledger
          (version, filename, sha256, application_source)
         values ($1, $2, $3, 'checkpoint-adopted')`,
        [migration.filename.slice(0, 14), migration.filename, migration.sha256],
      )
    }
    await assertDatabaseSizeWithinContract(client)
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
  if (rows.some((row, index) => row.filename !== migrations[index]?.filename)) {
    fail('migration_ledger_non_prefix')
  }
  if (rows.length < ADOPTED_CHECKPOINT_MIGRATIONS.length) {
    fail('migration_checkpoint_incomplete')
  }
  if (rows.some((row, index) => row.application_source !== (
    index < ADOPTED_CHECKPOINT_MIGRATIONS.length ? 'checkpoint-adopted' : 'runner-applied'
  ))) {
    fail('migration_ledger_source_drift')
  }
  if (requireComplete && rows.length !== migrations.length) fail('migration_state_incomplete')
}

export async function assertMigrationIdentity(client) {
  const result = await client.query(`
    select
      session_user::text as session_user,
      current_user::text as current_user,
      pg_has_role(session_user, 'dpg_migration'::name, 'SET') as can_set_migration_role,
      exists (
        select 1 from pg_roles
        where rolname = 'dpg_migration_login'
          and rolcanlogin and not rolsuper and not rolcreatedb and not rolcreaterole
          and not rolinherit and not rolreplication and not rolbypassrls
      ) as login_role_minimal,
      exists (
        select 1 from pg_roles
        where rolname = 'dpg_migration'
          and not rolcanlogin and not rolsuper and not rolcreatedb and not rolcreaterole
          and not rolinherit and not rolreplication and not rolbypassrls
      ) as capability_role_minimal
  `)
  const row = result.rows[0]
  if (!row || row.session_user !== 'dpg_migration_login'
    || row.current_user !== 'dpg_migration'
    || row.can_set_migration_role !== true
    || row.login_role_minimal !== true
    || row.capability_role_minimal !== true) {
    fail('migration_identity_contract_failed')
  }
}

async function applyPendingMigrations(client, migrations) {
  const applied = new Set((await readLedger(client)).map((row) => row.filename))
  const pending = migrations.filter((migration) => !applied.has(migration.filename))
  if (pending.length === 0) return

  await assertDatabaseSizeWithinContract(client)
  let activeMigration = pending[0].filename
  await client.query('begin isolation level serializable')
  try {
    for (const migration of pending) {
      activeMigration = migration.filename
      await client.query(stripOuterTransaction(migration.sql))
      await client.query(
        `insert into dpg_control.runtime_migration_ledger
          (version, filename, sha256, application_source)
         values ($1, $2, $3, 'runner-applied')`,
        [migration.filename.slice(0, 14), migration.filename, migration.sha256],
      )
      await assertDatabaseSizeWithinContract(client)
    }
    await client.query('commit')
  } catch (error) {
    await client.query('rollback').catch(() => undefined)
    process.stderr.write(`SUPABASE_RUNTIME_MIGRATIONS status=FAIL stage=apply migration=${activeMigration}\n`)
    throw error
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

export async function executeRuntimeMigrations(client, mode, checkpointAttestor) {
  if (!['status', 'apply'].includes(mode)) fail('mode_invalid')
  const migrations = await loadMigrations()
  await configure(client)
  await client.query("select pg_advisory_lock(hashtext('dongphugia:supabase-runtime-migrations:v1'))")

  try {
    if (mode === 'apply') await assertDatabaseSizeWithinContract(client)
    if (!(await ledgerExists(client))) {
      if (mode !== 'apply') fail('migration_state_incomplete')
      if (!checkpointAttestor) fail('checkpoint_attestation_required')
      await checkpointAttestor()
      await createLedgerAndAdoptCheckpoint(client, migrations)
    }

    validateLedger(await readLedger(client), migrations, false)
    if (mode === 'apply') await applyPendingMigrations(client, migrations)
    await assertDatabaseSizeWithinContract(client)
    validateLedger(await readLedger(client), migrations, true)
    await validateFinalSchema(client)
    return migrations.length
  } finally {
    await client.query("select pg_advisory_unlock(hashtext('dongphugia:supabase-runtime-migrations:v1'))").catch(() => undefined)
  }
}

async function run() {
  const mode = process.argv[2]
  const target = parseSupabaseRuntimeTarget(process.env.SUPABASE_REHOME_MIGRATION_DATABASE_URL, 'migration')
  const client = new Client({ ...target, ssl: supabaseRuntimeTlsOptions(target.host) })
  try {
    await client.connect()
    await assertMigrationIdentity(client)
    const count = await executeRuntimeMigrations(client, mode, async () => {
      execFileSync('bash', ['scripts/backup/attest-supabase-runtime-checkpoint.sh'], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          SUPABASE_RUNTIME_TARGET_PURPOSE: 'snapshot',
          CHECKPOINT_ATTESTATION_MODE: 'behavioral',
        },
        stdio: 'inherit',
      })
    })
    process.stdout.write(`SUPABASE_RUNTIME_MIGRATIONS status=PASS mode=${mode} count=${count}\n`)
  } catch (error) {
    if (!String(error?.message ?? '').startsWith('migration_')) {
      process.stderr.write('SUPABASE_RUNTIME_MIGRATIONS status=FAIL reason=database_operation_failed\n')
    } else {
      process.stderr.write(`SUPABASE_RUNTIME_MIGRATIONS status=FAIL reason=${error.message}\n`)
    }
    process.exitCode = 1
  } finally {
    await client.end().catch(() => undefined)
  }
}

if (process.argv[1]?.endsWith('/supabase-runtime-migrations.mjs')) void run()
