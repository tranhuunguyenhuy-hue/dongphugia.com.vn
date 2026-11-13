import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import pg from 'pg'

import { parseSupabaseRuntimeTarget } from './supabase-runtime-target.mjs'

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
  '20261113111053_dpg_admin_runtime_login_least_privilege.sql',
]

export const BACKUP_BOOTSTRAP_MIGRATIONS = [
  '20260828183000_leo542_backup_role_prerequisite.sql',
  '20260828183200_leo540_backup_coverage_prerequisite.sql',
]

export const BACKUP_BOOTSTRAP_PREFIX_LENGTH =
  ADOPTED_CHECKPOINT_MIGRATIONS.length + BACKUP_BOOTSTRAP_MIGRATIONS.length

export function backupBootstrapMigrationsAppliedCount(expectedPrefix) {
  const validPrefixes = [
    'absent',
    ...Array.from(
      { length: BACKUP_BOOTSTRAP_MIGRATIONS.length + 1 },
      (_, index) => String(ADOPTED_CHECKPOINT_MIGRATIONS.length + index),
    ),
  ]
  if (!validPrefixes.includes(expectedPrefix)) fail('backup_bootstrap_prefix_invalid')
  const startingPrefixLength = expectedPrefix === 'absent'
    ? ADOPTED_CHECKPOINT_MIGRATIONS.length
    : Number(expectedPrefix)
  return BACKUP_BOOTSTRAP_PREFIX_LENGTH - startingPrefixLength
}

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

async function applyPendingMigrations(client, migrations) {
  const applied = new Set((await readLedger(client)).map((row) => row.filename))
  for (const migration of migrations) {
    if (applied.has(migration.filename)) continue
    await assertDatabaseSizeWithinContract(client)
    await client.query('begin isolation level serializable')
    try {
      await client.query(stripOuterTransaction(migration.sql))
      await client.query(
        `insert into dpg_control.runtime_migration_ledger
          (version, filename, sha256, application_source)
         values ($1, $2, $3, 'runner-applied')`,
        [migration.filename.slice(0, 14), migration.filename, migration.sha256],
      )
      await assertDatabaseSizeWithinContract(client)
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

async function validateBackupBootstrap(client) {
  const result = await client.query(`
    with backup_tables(table_name) as (
      values
        ('admin_sessions'),
        ('crawl_import_decisions'),
        ('crawl_product_snapshots'),
        ('crawl_runs'),
        ('product_families'),
        ('product_family_catalogue_gaps'),
        ('product_family_configuration_groups'),
        ('product_family_memberships'),
        ('publishing_credentials')
    ),
    readonly_tables(table_name) as (
      values
        ('product_families'),
        ('product_family_catalogue_gaps'),
        ('product_family_configuration_groups'),
        ('product_family_memberships')
    ),
    backup_role as (
      select oid from pg_roles where rolname = 'dpg_backup'
    ),
    backup_acl_items(object_kind, schema_name, object_name, privilege_type, is_grantable) as (
      select 'relation', n.nspname::text, c.relname::text,
        acl.privilege_type, acl.is_grantable
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      cross join lateral aclexplode(c.relacl) acl
      where acl.grantee = (select oid from backup_role)
      union all
      select 'column', n.nspname::text, c.relname || '.' || a.attname,
        acl.privilege_type, acl.is_grantable
      from pg_attribute a
      join pg_class c on c.oid = a.attrelid
      join pg_namespace n on n.oid = c.relnamespace
      cross join lateral aclexplode(a.attacl) acl
      where acl.grantee = (select oid from backup_role)
      union all
      select 'type', n.nspname::text, t.typname::text,
        acl.privilege_type, acl.is_grantable
      from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
      cross join lateral aclexplode(t.typacl) acl
      where acl.grantee = (select oid from backup_role)
      union all
      select 'schema', n.nspname::text, n.nspname::text,
        acl.privilege_type, acl.is_grantable
      from pg_namespace n
      cross join lateral aclexplode(n.nspacl) acl
      where acl.grantee = (select oid from backup_role)
      union all
      select 'routine', n.nspname::text, p.proname::text,
        acl.privilege_type, acl.is_grantable
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      cross join lateral aclexplode(p.proacl) acl
      where acl.grantee = (select oid from backup_role)
      union all
      select 'database', '', d.datname::text,
        acl.privilege_type, acl.is_grantable
      from pg_database d
      cross join lateral aclexplode(d.datacl) acl
      where acl.grantee = (select oid from backup_role)
      union all
      select 'tablespace', '', t.spcname::text,
        acl.privilege_type, acl.is_grantable
      from pg_tablespace t
      cross join lateral aclexplode(t.spcacl) acl
      where acl.grantee = (select oid from backup_role)
      union all
      select 'language', '', l.lanname::text,
        acl.privilege_type, acl.is_grantable
      from pg_language l
      cross join lateral aclexplode(l.lanacl) acl
      where acl.grantee = (select oid from backup_role)
      union all
      select 'foreign-data-wrapper', '', f.fdwname::text,
        acl.privilege_type, acl.is_grantable
      from pg_foreign_data_wrapper f
      cross join lateral aclexplode(f.fdwacl) acl
      where acl.grantee = (select oid from backup_role)
      union all
      select 'foreign-server', '', s.srvname::text,
        acl.privilege_type, acl.is_grantable
      from pg_foreign_server s
      cross join lateral aclexplode(s.srvacl) acl
      where acl.grantee = (select oid from backup_role)
      union all
      select 'large-object', '', l.oid::text,
        acl.privilege_type, acl.is_grantable
      from pg_largeobject_metadata l
      cross join lateral aclexplode(l.lomacl) acl
      where acl.grantee = (select oid from backup_role)
      union all
      select 'parameter', '', p.parname::text,
        acl.privilege_type, acl.is_grantable
      from pg_parameter_acl p
      cross join lateral aclexplode(p.paracl) acl
      where acl.grantee = (select oid from backup_role)
    )
    select
      current_setting('server_version_num')::integer between 170000 and 179999
        as postgres_17,
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
      ) as target_contract_exact,
      exists (
        select 1 from pg_roles
        where rolname = 'dpg_backup' and not rolinherit and not rolcanlogin
          and not rolsuper and not rolcreatedb and not rolcreaterole
          and not rolreplication and not rolbypassrls
      ) as backup_role_restricted,
      to_regrole('dpg_backup_login') is null as backup_login_absent,
      not exists (
        select 1 from pg_auth_members
        where roleid = (select oid from pg_roles where rolname = 'dpg_backup')
           or member = (select oid from pg_roles where rolname = 'dpg_backup')
      ) as backup_role_has_no_memberships,
      has_schema_privilege('dpg_backup', 'dpg_app', 'USAGE')
        and not has_schema_privilege('dpg_backup', 'dpg_app', 'CREATE')
        and not exists (
          select 1
          from pg_namespace n
          where n.nspname not in ('pg_catalog', 'information_schema', 'pg_toast')
            and n.nspname !~ '^pg_(temp|toast_temp)_[0-9]+$'
            and has_schema_privilege('dpg_backup', n.oid, 'CREATE')
        )
        as backup_schema_effective_privileges_exact,
      (select count(*) = 10 from backup_acl_items) as backup_acl_scope_exact_count,
      (select count(*) = 9 from backup_acl_items a
       join backup_tables t on t.table_name = a.object_name
       where a.object_kind = 'relation' and a.schema_name = 'dpg_app'
         and a.privilege_type = 'SELECT' and not a.is_grantable)
        as backup_table_select_grants_complete,
      (select count(*) = 1 from backup_acl_items
       where object_kind = 'schema' and schema_name = 'dpg_app'
         and object_name = 'dpg_app' and privilege_type = 'USAGE'
         and not is_grantable) as backup_schema_usage_exact,
      not exists (
        select 1 from backup_acl_items a
        where not (
          (a.object_kind = 'relation' and a.schema_name = 'dpg_app'
            and exists (select 1 from backup_tables t where t.table_name = a.object_name)
            and a.privilege_type = 'SELECT' and not a.is_grantable)
          or (a.object_kind = 'schema' and a.schema_name = 'dpg_app'
            and a.object_name = 'dpg_app' and a.privilege_type = 'USAGE'
            and not a.is_grantable)
        )
      ) as no_other_backup_acl_grants,
      not exists (
        select 1 from backup_tables t
        where has_table_privilege('dpg_backup', format('dpg_app.%I', t.table_name), 'INSERT')
           or has_any_column_privilege('dpg_backup', format('dpg_app.%I', t.table_name), 'INSERT')
           or has_table_privilege('dpg_backup', format('dpg_app.%I', t.table_name), 'UPDATE')
           or has_any_column_privilege('dpg_backup', format('dpg_app.%I', t.table_name), 'UPDATE')
           or has_table_privilege('dpg_backup', format('dpg_app.%I', t.table_name), 'DELETE')
           or has_table_privilege('dpg_backup', format('dpg_app.%I', t.table_name), 'TRUNCATE')
           or has_table_privilege('dpg_backup', format('dpg_app.%I', t.table_name), 'REFERENCES')
           or has_any_column_privilege('dpg_backup', format('dpg_app.%I', t.table_name), 'REFERENCES')
           or has_table_privilege('dpg_backup', format('dpg_app.%I', t.table_name), 'TRIGGER')
      ) as backup_effective_table_privileges_read_only,
      not exists (
        select 1
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where c.relkind in ('r', 'p', 'v', 'm', 'f')
          and n.nspname not in ('pg_catalog', 'information_schema', 'pg_toast')
          and n.nspname !~ '^pg_(temp|toast_temp)_[0-9]+$'
          and not (
            n.nspname = 'dpg_app'
            and exists (select 1 from backup_tables t where t.table_name = c.relname)
          )
          and (
            has_table_privilege('dpg_backup', c.oid, 'SELECT')
            or has_any_column_privilege('dpg_backup', c.oid, 'SELECT')
            or has_table_privilege('dpg_backup', c.oid, 'INSERT')
            or has_any_column_privilege('dpg_backup', c.oid, 'INSERT')
            or has_table_privilege('dpg_backup', c.oid, 'UPDATE')
            or has_any_column_privilege('dpg_backup', c.oid, 'UPDATE')
            or has_table_privilege('dpg_backup', c.oid, 'DELETE')
            or has_table_privilege('dpg_backup', c.oid, 'TRUNCATE')
            or has_table_privilege('dpg_backup', c.oid, 'REFERENCES')
            or has_any_column_privilege('dpg_backup', c.oid, 'REFERENCES')
            or has_table_privilege('dpg_backup', c.oid, 'TRIGGER')
          )
      ) as backup_has_no_effective_privileges_outside_allowlist,
      not exists (
        select 1
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where c.relkind = 'S'
          and n.nspname not in ('pg_catalog', 'information_schema', 'pg_toast')
          and n.nspname !~ '^pg_(temp|toast_temp)_[0-9]+$'
          and (
            has_sequence_privilege('dpg_backup', c.oid, 'SELECT')
            or has_sequence_privilege('dpg_backup', c.oid, 'USAGE')
            or has_sequence_privilege('dpg_backup', c.oid, 'UPDATE')
          )
      ) as backup_has_no_effective_sequence_privileges,
      not exists (
        select 1 from pg_shdepend
        where refclassid = 'pg_authid'::regclass
          and refobjid = (select oid from backup_role)
          and deptype = 'o'
      ) as backup_role_owns_no_objects,
      not exists (
        select 1 from pg_default_acl d
        left join lateral aclexplode(d.defaclacl) acl on true
        where d.defaclrole = (select oid from backup_role)
           or acl.grantee = (select oid from backup_role)
      ) as backup_role_has_no_default_acl,
      not exists (
        select 1 from pg_user_mapping
        where umuser = (select oid from backup_role)
      ) as backup_role_has_no_user_mappings,
      not exists (
        select 1 from pg_db_role_setting
        where setrole = (select oid from backup_role)
      ) as backup_role_has_no_settings,
      (select count(*) = 9
       from pg_policy p
       join pg_class c on c.oid = p.polrelid
       join pg_namespace n on n.oid = c.relnamespace
       join backup_tables t on t.table_name = c.relname
       where n.nspname = 'dpg_app' and p.polname = 'leo540_backup_select'
         and p.polpermissive and p.polcmd = 'r'
         and p.polroles = array[(select oid from pg_roles where rolname = 'dpg_backup')]::oid[]
         and pg_get_expr(p.polqual, p.polrelid) = 'true'
         and p.polwithcheck is null) as backup_policies_complete,
      not exists (
        select 1 from pg_policy p
        where (select oid from backup_role) = any(p.polroles)
          and not exists (
            select 1 from pg_class c
            join pg_namespace n on n.oid = c.relnamespace
            where c.oid = p.polrelid and n.nspname = 'dpg_app'
              and c.relname in (
                'admin_sessions', 'crawl_import_decisions', 'crawl_product_snapshots',
                'crawl_runs', 'product_families', 'product_family_catalogue_gaps',
                'product_family_configuration_groups', 'product_family_memberships',
                'publishing_credentials'
              )
              and p.polname = 'leo540_backup_select' and p.polpermissive
              and p.polcmd = 'r'
              and p.polroles = array[(select oid from backup_role)]::oid[]
              and pg_get_expr(p.polqual, p.polrelid) = 'true'
              and p.polwithcheck is null
          )
      ) as no_other_backup_policies,
      (select count(*) = 9
       from pg_policy p
       join pg_class c on c.oid = p.polrelid
       join pg_namespace n on n.oid = c.relnamespace
       join backup_tables t on t.table_name = c.relname
       where n.nspname = 'dpg_app') as backup_target_policy_count_exact,
      not exists (
        select 1 from pg_policy p
        join pg_class c on c.oid = p.polrelid
        join pg_namespace n on n.oid = c.relnamespace
        join backup_tables t on t.table_name = c.relname
        where n.nspname = 'dpg_app'
          and not (
            p.polname = 'leo540_backup_select' and p.polpermissive
            and p.polcmd = 'r'
            and p.polroles = array[(select oid from backup_role)]::oid[]
            and pg_get_expr(p.polqual, p.polrelid) = 'true'
            and p.polwithcheck is null
          )
      ) as no_other_backup_target_policies,
      (select count(*) = 4
       from information_schema.table_privileges p
       join readonly_tables t on t.table_name = p.table_name
       where p.table_schema = 'dpg_app' and p.grantee = 'dpg_readonly'
         and p.privilege_type = 'SELECT') as readonly_select_grants_complete,
      not exists (
        select 1 from information_schema.table_privileges p
        join readonly_tables t on t.table_name = p.table_name
        where p.table_schema = 'dpg_app' and p.grantee = 'dpg_readonly'
          and p.privilege_type <> 'SELECT'
      ) as readonly_grants_read_only
  `)
  const row = result.rows[0]
  if (!row || Object.values(row).some((value) => value !== true)) {
    fail('backup_bootstrap_acceptance_failed')
  }
}

async function assertBackupBootstrapLoginRoleAbsent(client) {
  const result = await client.query(
    "select to_regrole('dpg_backup_login') is null as absent",
  )
  if (result.rows[0]?.absent !== true) fail('backup_bootstrap_login_role_exists')
}

export async function executeRuntimeMigrations(
  client,
  mode,
  checkpointAttestor,
  expectedBootstrapPrefix,
) {
  if (!['status', 'apply', 'bootstrap-backup'].includes(mode)) fail('mode_invalid')
  const validBootstrapPrefixes = [
    'absent',
    ...Array.from(
      { length: BACKUP_BOOTSTRAP_MIGRATIONS.length + 1 },
      (_, index) => String(ADOPTED_CHECKPOINT_MIGRATIONS.length + index),
    ),
  ]
  if (mode === 'bootstrap-backup'
    && !validBootstrapPrefixes.includes(expectedBootstrapPrefix)) {
    fail('backup_bootstrap_prefix_invalid')
  }
  const migrations = await loadMigrations()
  await configure(client)
  await client.query("select pg_advisory_lock(hashtext('dongphugia:supabase-runtime-migrations:v1'))")

  try {
    if (mode === 'apply' || mode === 'bootstrap-backup') {
      await assertDatabaseSizeWithinContract(client)
    }
    const hasLedger = await ledgerExists(client)
    if (mode === 'bootstrap-backup') {
      const observedPrefix = hasLedger ? String((await readLedger(client)).length) : 'absent'
      if (observedPrefix !== expectedBootstrapPrefix) fail('backup_bootstrap_prefix_mismatch')
      await assertBackupBootstrapLoginRoleAbsent(client)
    }
    if (!hasLedger) {
      if (mode !== 'apply' && mode !== 'bootstrap-backup') fail('migration_state_incomplete')
      if (!checkpointAttestor) fail('checkpoint_attestation_required')
      await checkpointAttestor()
      await createLedgerAndAdoptCheckpoint(client, migrations)
    }

    const initialLedger = await readLedger(client)
    validateLedger(initialLedger, migrations, false)
    if (mode === 'bootstrap-backup'
      && initialLedger.length > BACKUP_BOOTSTRAP_PREFIX_LENGTH) {
      fail('backup_bootstrap_boundary_exceeded')
    }
    if (mode === 'apply') await applyPendingMigrations(client, migrations)
    if (mode === 'bootstrap-backup') {
      await applyPendingMigrations(
        client,
        migrations.slice(0, BACKUP_BOOTSTRAP_PREFIX_LENGTH),
      )
      const finalLedger = await readLedger(client)
      validateLedger(finalLedger, migrations, false)
      if (finalLedger.length !== BACKUP_BOOTSTRAP_PREFIX_LENGTH) {
        fail('backup_bootstrap_incomplete')
      }
      await validateBackupBootstrap(client)
      await assertDatabaseSizeWithinContract(client)
      return BACKUP_BOOTSTRAP_PREFIX_LENGTH
    }
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
  const client = new Client(parseSupabaseRuntimeTarget(process.env.SUPABASE_REHOME_DATABASE_URL))
  try {
    await client.connect()
    const count = await executeRuntimeMigrations(
      client,
      mode,
      async () => {
        execFileSync('bash', ['scripts/backup/attest-supabase-runtime-checkpoint.sh'], {
          cwd: process.cwd(),
          env: { ...process.env, CHECKPOINT_ATTESTATION_MODE: 'behavioral' },
          stdio: 'inherit',
        })
      },
      process.env.EXPECTED_BACKUP_BOOTSTRAP_PREFIX,
    )
    if (mode === 'bootstrap-backup') {
      const migrationsApplied = backupBootstrapMigrationsAppliedCount(
        process.env.EXPECTED_BACKUP_BOOTSTRAP_PREFIX,
      )
      process.stdout.write(
        `SUPABASE_RUNTIME_MIGRATIONS status=PASS mode=${mode} prefix=${count} migrations_applied=${migrationsApplied}\n`,
      )
    } else {
      process.stdout.write(`SUPABASE_RUNTIME_MIGRATIONS status=PASS mode=${mode} count=${count}\n`)
    }
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
