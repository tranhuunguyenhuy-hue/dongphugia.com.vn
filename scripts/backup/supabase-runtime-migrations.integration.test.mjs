import { execFileSync, spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import pg from 'pg'
import { describe, expect, it } from 'vitest'

import {
  ADOPTED_CHECKPOINT_MIGRATIONS,
  EXPECTED_RUNTIME_MIGRATIONS,
  assertDatabaseSizeWithinContract,
  executeRuntimeMigrations,
  stripReadOnlyOuterTransaction,
  stripOuterTransaction,
} from './supabase-runtime-migrations.mjs'

const { Client } = pg
const postgresImage = process.env.POSTGRES_SNAPSHOT_INTEGRATION_IMAGE
const dockerIntegration = Boolean(postgresImage)
const isDatabaseSizeGuardQuery = (sql) => typeof sql === 'string'
  && /^\s*select\s+pg_database_size\(current_database\(\)\)::text\s+as\s+current_size_bytes,/i.test(sql)
  && /\bas\s+hard_ceiling_bytes\b/i.test(sql)

function docker(...args) {
  return execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function postgresReadiness(container, host) {
  return spawnSync('docker', [
    'exec', container, 'pg_isready', '-q', '-t', '1', '-h', host, '-U', 'postgres',
  ], { encoding: 'utf8', stdio: ['ignore', 'ignore', 'ignore'], timeout: 1_500 })
}

async function waitForPostgresReadiness(container, host, deadline) {
  while (Date.now() < deadline) {
    if (postgresReadiness(container, host).status === 0) return true
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  return false
}

function postgresContainerState(container) {
  const result = spawnSync('docker', [
    'inspect', '--format', '{{.State.Status}}|{{.State.Running}}|{{.State.OOMKilled}}|{{.State.ExitCode}}', container,
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 1_500 })
  if (result.status !== 0) return 'unavailable'

  const [status, running, oomKilled, exitCode] = result.stdout.trim().split('|')
  if (!['created', 'running', 'restarting', 'paused', 'exited', 'dead'].includes(status)
    || !['true', 'false'].includes(running)
    || !['true', 'false'].includes(oomKilled)
    || !/^\d+$/.test(exitCode ?? '')) return 'unavailable'

  return `state=${status},alive=${running},oom=${oomKilled},exit=${exitCode}`
}

function postgresClientState(client) {
  if (!client) return 'not_created'
  return `connected=${Boolean(client._connected)},ending=${Boolean(client._ending)},ended=${Boolean(client._ended)},queryable=${Boolean(client._queryable)}`
}

function postgresFailureKind(error) {
  if (error?.message === 'Connection terminated unexpectedly') return 'connection_terminated_unexpectedly'
  if (error?.name === 'AssertionError') return 'assertion_failed'
  if (error?.code === 'ECONNREFUSED') return 'connection_refused'
  if (error?.code === 'ECONNRESET') return 'connection_reset'
  if (error?.code === 'ETIMEDOUT') return 'connection_timed_out'
  if (error?.code === '57P03') return 'server_startup_rejected'
  return 'other'
}

function sanitizedErrorCause(error) {
  const allowedNames = new Set(['AssertionError', 'Error', 'RangeError', 'TypeError'])
  const originalName = allowedNames.has(error?.name) ? error.name : 'Error'
  const originalCode = typeof error?.code === 'string' && /^[A-Z0-9]{4,12}$/.test(error.code)
    ? error.code
    : 'unavailable'
  const cause = new Error(`SANITIZED_CAUSE name=${originalName} code=${originalCode}`)
  cause.name = 'SanitizedIntegrationCause'
  if (typeof error?.stack === 'string') {
    const stackFrames = error.stack.split('\n').slice(1)
      .filter((line) => /^\s+at\s/.test(line))
    if (stackFrames.length > 0) {
      cause.stack = `${cause.name}: ${cause.message}\n${stackFrames.join('\n')}`
    }
  }
  return cause
}

function sanitizedIntegrationFailure(error, phase, failureKind) {
  const failure = new Error(
    `PG17_MIGRATION_INTEGRATION_FAILED phase=${phase} failure=${failureKind}`,
    { cause: sanitizedErrorCause(error) },
  )
  if (typeof error?.stack === 'string') {
    const stackFrames = error.stack.split('\n').slice(1)
      .filter((line) => /^\s+at\s/.test(line))
    if (stackFrames.length > 0) {
      failure.stack = `${failure.name}: ${failure.message}\n${stackFrames.join('\n')}`
    }
  }
  return failure
}

describe('Supabase runtime migration adoption integration', () => {
  it.runIf(dockerIntegration)(
    'attests the checkpoint, commits pending migrations separately, and revalidates status',
    async () => {
      const container = `dpg-runtime-migrations-${process.pid}-${Date.now()}`
      let client
      let phase = 'start_isolated_postgres'
      try {
        const startupDelayFixture = `${process.cwd()}/scripts/backup/fixtures/runtime-migration-startup-delay.sql`
        docker('run', '--detach', '--name', container, '--publish', '127.0.0.1::5432',
          '--mount', `type=bind,source=${startupDelayFixture},target=/docker-entrypoint-initdb.d/000-startup-delay.sql,readonly`,
          '--env', 'POSTGRES_HOST_AUTH_METHOD=trust', postgresImage)

        const readinessDeadline = Date.now() + 22_500
        phase = 'observe_socket_only_initialization_server'
        const socketReadyDuringInitialization = await waitForPostgresReadiness(
          container, '/var/run/postgresql', readinessDeadline,
        )
        expect(socketReadyDuringInitialization).toBe(true)

        phase = 'prove_initialization_server_is_not_tcp_ready'
        const tcpDuringInitialization = postgresReadiness(container, '127.0.0.1')
        expect(tcpDuringInitialization.error).toBeUndefined()
        expect(tcpDuringInitialization.status).toBe(2)
        process.stdout.write('PG17_MIGRATION_STARTUP_PROBE socket_init_ready=true tcp_init_ready=false\n')

        phase = 'wait_for_final_postgres_tcp_listener'
        const postgresTcpReady = await waitForPostgresReadiness(
          container, '127.0.0.1', readinessDeadline,
        )
        expect(postgresTcpReady).toBe(true)

        phase = 'resolve_published_port'
        const port = docker('port', container, '5432/tcp').split(':').at(-1)
        const connectionString = `postgresql://postgres@127.0.0.1:${port}/postgres`
        client = new Client({ connectionString })
        phase = 'connect_main_client'
        await client.connect()
        phase = 'bootstrap_synthetic_database'
        await client.query(`
          create role anon nologin;
          create role authenticated nologin;
          create role service_role nologin;
          create schema auth;
          create schema storage;
          create schema extensions;
          create extension pgcrypto with schema extensions;
          create function auth.uid() returns uuid language sql stable
            as $$ select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$;
          create table auth.users (id uuid primary key);
          create table storage.objects (id uuid primary key);
          set search_path to "$user", public, extensions;
        `)

        phase = 'replay_adopted_checkpoint_migrations'
        for (const [index, filename] of ADOPTED_CHECKPOINT_MIGRATIONS.entries()) {
          phase = `replay_checkpoint_migration_${index + 1}`
          await client.query(await readFile(`supabase/migrations/${filename}`, 'utf8'))
        }

        phase = 'load_synthetic_acceptance_contracts'
        const readonlyAcceptance = (await readFile(
          'supabase/tests/supabase_runtime_adoption_checkpoint.sql', 'utf8',
        )).replace(/^\\set[^\n]*\n/, '')
        const behavioralAcceptance = (await readFile(
          'supabase/tests/supabase_runtime_adoption_behavior.sql', 'utf8',
        )).replace(/^\\set[^\n]*\n/, '')
        const rlsAcceptance = (await readFile(
          'supabase/tests/leo560_preview_rls_hardening.sql', 'utf8',
        )).replace(/^\\set[^\n]*\n/, '')
        const runtimeReadonlyAcceptance = (await readFile(
          'supabase/tests/supabase_runtime_readonly_acceptance.sql', 'utf8',
        )).replace(/^\\set[^\n]*\n/, '')
        const runtimeReadonlyAcceptanceInTransaction = stripReadOnlyOuterTransaction(
          runtimeReadonlyAcceptance,
        )
        const cataloguePreflight = await readFile('scripts/backup/catalogue-rehome-preflight.sql', 'utf8')
        const hardeningMigration = stripOuterTransaction(await readFile(
          'supabase/migrations/20261016090000_leo560_preview_rls_hardening.sql', 'utf8',
        ))

        const attestCheckpoint = async () => {
          const attestor = new Client({ connectionString })
          try {
            await attestor.connect()
            await attestor.query(readonlyAcceptance)
            await attestor.query(behavioralAcceptance)
          } finally {
            await attestor.end().catch(() => undefined)
          }
        }

        phase = 'reject_unexpected_checkpoint_data'
        await client.query("insert into dpg_app.brands (name, slug) values ('Rejected', 'rejected')")
        await expect(executeRuntimeMigrations(client, 'apply', attestCheckpoint))
          .rejects.toThrow(/SUPABASE_CHECKPOINT_UNEXPECTED_ROWS/)
        expect((await client.query(
          "select to_regclass('dpg_control.runtime_migration_ledger') is null as absent",
        )).rows[0]?.absent).toBe(true)
        await client.query("delete from dpg_app.brands where slug = 'rejected'")

        phase = 'reject_checkpoint_role_drift'
        await client.query('alter role dpg_runtime_login connection limit 9')
        await expect(executeRuntimeMigrations(client, 'apply', attestCheckpoint))
          .rejects.toThrow(/SUPABASE_CHECKPOINT_ROLE_FAILED/)
        await client.query('alter role dpg_runtime_login connection limit 10')

        phase = 'reject_checkpoint_size_limit'
        let sizeGuardChecks = 0
        const sizeFailureClient = new Proxy(client, {
          get(target, property) {
            if (property === 'query') {
              return (sql, ...values) => {
                if (isDatabaseSizeGuardQuery(sql)) {
                  sizeGuardChecks += 1
                  if (sizeGuardChecks === 5) {
                    return Promise.resolve({
                      rows: [{ current_size_bytes: '367001600', hard_ceiling_bytes: '367001600' }],
                    })
                  }
                }
                return target.query(sql, ...values)
              }
            }
            return Reflect.get(target, property, target)
          },
        })
        await expect(executeRuntimeMigrations(sizeFailureClient, 'apply', attestCheckpoint))
          .rejects.toThrow('database_size_hard_limit_reached')
        expect(sizeGuardChecks).toBe(5)
        expect((await client.query(
          'select count(*)::integer as count from dpg_control.runtime_migration_ledger',
        )).rows[0]?.count).toBe(ADOPTED_CHECKPOINT_MIGRATIONS.length)
        expect((await client.query("select to_regrole('dpg_backup') is null as absent"))
          .rows[0]?.absent).toBe(true)

        phase = 'preserve_committed_prefix_after_injected_failure'
        const failedMigration = EXPECTED_RUNTIME_MIGRATIONS[ADOPTED_CHECKPOINT_MIGRATIONS.length + 1]
        let injectFailure = true
        const failingClient = new Proxy(client, {
          get(target, property) {
            if (property === 'query') {
              return (sql, ...values) => {
                const parameters = values[0]
                if (injectFailure
                  && typeof sql === 'string'
                  && sql.includes('insert into dpg_control.runtime_migration_ledger')
                  && Array.isArray(parameters)
                  && parameters[0] === failedMigration.slice(0, 14)) {
                  injectFailure = false
                  throw new Error('synthetic_mid_sequence_failure')
                }
                return target.query(sql, ...values)
              }
            }
            return Reflect.get(target, property, target)
          },
        })
        await expect(executeRuntimeMigrations(failingClient, 'apply', attestCheckpoint))
          .rejects.toThrow('synthetic_mid_sequence_failure')
        expect(injectFailure).toBe(false)
        const prefixLedger = await client.query(
          'select count(*)::integer as count from dpg_control.runtime_migration_ledger',
        )
        expect(prefixLedger.rows[0]?.count).toBe(ADOPTED_CHECKPOINT_MIGRATIONS.length + 1)
        expect((await client.query("select to_regrole('dpg_backup') is not null as present"))
          .rows[0]?.present).toBe(true)
        expect((await client.query(`
          select count(*)::integer as count
          from pg_policy p
          join pg_class c on c.oid = p.polrelid
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'dpg_app' and p.polname = 'leo540_backup_select'
        `)).rows[0]?.count).toBe(0)

        phase = 'reject_size_limit_inside_pending_migration_transaction'
        let migrationSizeChecks = 0
        const migrationSizeFailureClient = new Proxy(client, {
          get(target, property) {
            if (property === 'query') {
              return (sql, ...values) => {
                if (isDatabaseSizeGuardQuery(sql)) {
                  migrationSizeChecks += 1
                  if (migrationSizeChecks === 3) {
                    return Promise.resolve({
                      rows: [{ current_size_bytes: '367001600', hard_ceiling_bytes: '367001600' }],
                    })
                  }
                }
                return target.query(sql, ...values)
              }
            }
            return Reflect.get(target, property, target)
          },
        })
        await expect(executeRuntimeMigrations(migrationSizeFailureClient, 'apply', attestCheckpoint))
          .rejects.toThrow('database_size_hard_limit_reached')
        expect(migrationSizeChecks).toBe(3)
        expect((await client.query(
          'select count(*)::integer as count from dpg_control.runtime_migration_ledger',
        )).rows[0]?.count).toBe(ADOPTED_CHECKPOINT_MIGRATIONS.length + 1)
        expect((await client.query(`
          select count(*)::integer as count
          from pg_policy p
          join pg_class c on c.oid = p.polrelid
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'dpg_app' and p.polname = 'leo540_backup_select'
        `)).rows[0]?.count).toBe(0)

        phase = 'reject_checkpoint_ledger_gap_before_ddl'
        const missingCheckpointRow = (await client.query(`
          select version, filename, sha256, application_source
          from dpg_control.runtime_migration_ledger where filename = $1
        `, [EXPECTED_RUNTIME_MIGRATIONS[0]])).rows[0]
        await client.query(
          'delete from dpg_control.runtime_migration_ledger where filename = $1',
          [EXPECTED_RUNTIME_MIGRATIONS[0]],
        )
        const missingCheckpointSql = stripOuterTransaction(await readFile(
          `supabase/migrations/${EXPECTED_RUNTIME_MIGRATIONS[0]}`,
          'utf8',
        ))
        let missingMigrationStarted = false
        const gappedLedgerClient = new Proxy(client, {
          get(target, property) {
            if (property === 'query') {
              return (sql, ...values) => {
                if (typeof sql === 'string' && sql.trim() === missingCheckpointSql.trim()) {
                  missingMigrationStarted = true
                }
                return target.query(sql, ...values)
              }
            }
            return Reflect.get(target, property, target)
          },
        })
        await expect(executeRuntimeMigrations(gappedLedgerClient, 'apply', attestCheckpoint))
          .rejects.toThrow('migration_ledger_non_prefix')
        expect(missingMigrationStarted).toBe(false)
        await client.query(`
          insert into dpg_control.runtime_migration_ledger
            (version, filename, sha256, application_source)
          values ($1, $2, $3, $4)
        `, [missingCheckpointRow.version, missingCheckpointRow.filename,
          missingCheckpointRow.sha256, missingCheckpointRow.application_source])

        // Retry resumes from the committed ledger prefix; it does not reset or
        // roll back earlier migration transactions.

        phase = 'resume_ordered_pending_migrations'
        await executeRuntimeMigrations(client, 'apply', attestCheckpoint)

        const ledger = await client.query('select count(*)::integer as count from dpg_control.runtime_migration_ledger')
        expect(ledger.rows[0]?.count).toBe(23)

        phase = 'verify_database_size_guard'
        const databaseSizeBefore = await assertDatabaseSizeWithinContract(client)
        await client.query(`
          create table public.synthetic_migration_size_probe (payload bytea not null);
          insert into public.synthetic_migration_size_probe (payload)
          select extensions.gen_random_bytes(1024)
          from generate_series(1, 1024);
        `)
        const databaseSizeAfter = await assertDatabaseSizeWithinContract(client)
        expect(databaseSizeAfter).toBeGreaterThan(databaseSizeBefore)
        await client.query('drop table public.synthetic_migration_size_probe')

        phase = 'verify_readonly_rls_acceptance'
        await client.query(rlsAcceptance)
        await client.query(runtimeReadonlyAcceptance)
        await client.query(cataloguePreflight)

        await client.query(`alter type dpg_v1.record_status add value if not exists '(PUBLISHED)'`)
        phase = 'reject_policy_literal_token_drift'
        await client.query('begin')
        await client.query(`
          alter policy v1_products_public_select on dpg_v1.products
          using (status = '(PUBLISHED)'::dpg_v1.record_status)
        `)
        await expect(client.query(runtimeReadonlyAcceptanceInTransaction))
          .rejects.toThrow('SUPABASE_RUNTIME_READONLY_RLS_POLICY_SET_FAILED')
        await client.query('rollback')
        await client.query(runtimeReadonlyAcceptance)

        phase = 'reject_policy_mixed_boolean_operator_family'
        await client.query('begin')
        await client.query(`
          alter policy v1_products_staff_select on dpg_v1.products
          using (
            (status = 'PUBLISHED'::dpg_v1.record_status
              or dpg_v1.staff_has_capability('catalogue.read'::dpg_v1.staff_capability))
            and status = 'PUBLISHED'::dpg_v1.record_status
          )
        `)
        await expect(client.query(runtimeReadonlyAcceptanceInTransaction))
          .rejects.toThrow('SUPABASE_RUNTIME_READONLY_RLS_POLICY_MIXED_BOOLEAN_OPERATOR_FAMILY_FAILED')
        await client.query('rollback')
        await client.query(runtimeReadonlyAcceptance)

        phase = 'reject_unexpected_policy_set'
        await client.query('begin')
        await client.query(`
          create policy codex_unexpected_product_policy on dpg_v1.products
          for select to authenticated using (true)
        `)
        await expect(client.query(runtimeReadonlyAcceptanceInTransaction))
          .rejects.toThrow('SUPABASE_RUNTIME_READONLY_RLS_POLICY_SET_FAILED')
        await client.query('rollback')
        await client.query(runtimeReadonlyAcceptance)

        phase = 'reject_policy_predicate_drift'
        await client.query('begin')
        await client.query('drop policy v1_products_staff_select on dpg_v1.products')
        await client.query(`
          create policy v1_products_staff_select on dpg_v1.products
          for select to authenticated using (true)
        `)
        await expect(client.query(runtimeReadonlyAcceptanceInTransaction))
          .rejects.toThrow('SUPABASE_RUNTIME_READONLY_RLS_POLICY_SET_FAILED')
        await client.query('rollback')
        await client.query(runtimeReadonlyAcceptance)

        phase = 'reject_api_view_owner_drift'
        await client.query('begin')
        await client.query('grant create on schema dpg_v1_api to authenticated')
        await client.query('alter view dpg_v1_api.public_products owner to authenticated')
        await expect(client.query(runtimeReadonlyAcceptanceInTransaction))
          .rejects.toThrow('SUPABASE_RUNTIME_READONLY_API_OWNER_FAILED')
        await client.query('rollback')
        await client.query(runtimeReadonlyAcceptance)

        phase = 'reject_api_helper_signature_drift'
        await client.query('begin')
        await client.query(`
          create function dpg_v1.staff_has_capability(text)
          returns boolean language sql immutable as 'select true'
        `)
        await client.query('drop policy v1_products_staff_select on dpg_v1.products')
        await client.query(`
          create policy v1_products_staff_select on dpg_v1.products
          for select to authenticated
          using (status = 'PUBLISHED' or dpg_v1.staff_has_capability('catalogue.read'::text))
        `)
        await expect(client.query(runtimeReadonlyAcceptanceInTransaction))
          .rejects.toThrow('SUPABASE_RUNTIME_READONLY_RLS_POLICY_SET_FAILED')
        await client.query('rollback')
        await client.query(runtimeReadonlyAcceptance)

        phase = 'reject_staff_context_helper_drift'
        await client.query('begin')
        await client.query(`
          create or replace function dpg_v1.current_staff_context()
          returns table (
            auth_user_id uuid,
            email text,
            display_name text,
            status dpg_v1.staff_status,
            roles dpg_v1.staff_role[],
            capabilities dpg_v1.staff_capability[]
          )
          language sql
          stable
          security definer
          set search_path = pg_catalog, dpg_v1
          as $$
            select auth.uid(), 'synthetic@example.invalid'::text, 'Synthetic'::text,
                   'active'::dpg_v1.staff_status,
                   enum_range(null::dpg_v1.staff_role),
                   enum_range(null::dpg_v1.staff_capability)
            where auth.uid() is not null
          $$
        `)
        await expect(client.query(runtimeReadonlyAcceptanceInTransaction))
          .rejects.toThrow('SUPABASE_RUNTIME_READONLY_STAFF_CONTEXT_HELPER_FAILED')
        await client.query('rollback')
        await client.query(runtimeReadonlyAcceptance)

        phase = 'reject_public_staff_helper_grants'
        await client.query('begin')
        await client.query('grant execute on function dpg_v1.current_staff_context() to public')
        await expect(client.query(runtimeReadonlyAcceptanceInTransaction))
          .rejects.toThrow('SUPABASE_RUNTIME_READONLY_STAFF_HELPER_GRANT_SET_FAILED')
        await client.query('rollback')
        await client.query(runtimeReadonlyAcceptance)

        await client.query('begin')
        await client.query('grant execute on function dpg_v1.staff_has_capability(dpg_v1.staff_capability) to public')
        await expect(client.query(runtimeReadonlyAcceptanceInTransaction))
          .rejects.toThrow('SUPABASE_RUNTIME_READONLY_STAFF_HELPER_GRANT_SET_FAILED')
        await client.query('rollback')
        await client.query(runtimeReadonlyAcceptance)

        phase = 'reject_effective_staff_role_membership'
        for (const membershipOption of ['inherit true', 'inherit false']) {
          for (const role of [
            'anon', 'service_role', 'dpg_runtime', 'dpg_runtime_login',
            'dpg_readonly', 'dpg_readonly_login', 'dpg_backup',
          ]) {
            await client.query('begin')
            await client.query(`grant authenticated to ${role} with ${membershipOption}`)
            await expect(client.query(runtimeReadonlyAcceptanceInTransaction))
              .rejects.toThrow('SUPABASE_RUNTIME_READONLY_STAFF_HELPER_EFFECTIVE_PRIVILEGES_FAILED')
            await client.query('rollback')
            await client.query(runtimeReadonlyAcceptance)
          }
        }

        phase = 'reject_capability_helper_security_mode_drift'
        await client.query('begin')
        await client.query(`
          create or replace function dpg_v1.staff_has_capability(p_capability dpg_v1.staff_capability)
          returns boolean
          language plpgsql
          stable
          security definer
          set search_path = pg_catalog, dpg_v1
          as $$
          begin
            return true;
          end
          $$
        `)
        await expect(client.query(runtimeReadonlyAcceptanceInTransaction))
          .rejects.toThrow('SUPABASE_RUNTIME_READONLY_CAPABILITY_HELPER_FAILED')
        await client.query('rollback')
        await client.query(runtimeReadonlyAcceptance)

        phase = 'reject_capability_helper_configuration_drift'
        await client.query('begin')
        await client.query(`
          create or replace function dpg_v1.staff_has_capability(p_capability dpg_v1.staff_capability)
          returns boolean
          language plpgsql
          stable
          security invoker
          set search_path = public
          set statement_timeout = '15s'
          as $$
          begin
            if auth.uid() is null or p_capability is null then
              return false;
            end if;

            return exists (
              select 1
              from dpg_v1.current_staff_context() context
              where p_capability = any(context.capabilities)
            );
          end
          $$
        `)
        await expect(client.query(runtimeReadonlyAcceptanceInTransaction))
          .rejects.toThrow('SUPABASE_RUNTIME_READONLY_CAPABILITY_HELPER_FAILED')
        await client.query('rollback')
        await client.query(runtimeReadonlyAcceptance)

        phase = 'reject_api_function_security_mode_drift'
        await client.query('begin')
        await client.query('alter function dpg_v1_api.public_product_get(uuid) security definer')
        await expect(client.query(runtimeReadonlyAcceptanceInTransaction))
          .rejects.toThrow('SUPABASE_RUNTIME_READONLY_API_FUNCTION_SECURITY_MODE_FAILED')
        await client.query('rollback')
        await client.query(runtimeReadonlyAcceptance)

        phase = 'reject_api_function_set_drift'
        await client.query('begin')
        await client.query(`
          create function dpg_v1_api.codex_unexpected_helper()
          returns integer language sql immutable as 'select 1'
        `)
        await expect(client.query(runtimeReadonlyAcceptanceInTransaction))
          .rejects.toThrow('SUPABASE_RUNTIME_READONLY_API_FUNCTION_SET_FAILED')
        await client.query('rollback')
        await client.query(runtimeReadonlyAcceptance)

        phase = 'reject_api_function_grant_drift'
        await client.query('begin')
        await client.query('grant execute on function dpg_v1_api.public_product_get(uuid) to public')
        await expect(client.query(runtimeReadonlyAcceptanceInTransaction))
          .rejects.toThrow('SUPABASE_RUNTIME_READONLY_API_FUNCTION_GRANT_SET_FAILED')
        await client.query('rollback')
        await client.query(runtimeReadonlyAcceptance)

        phase = 'reject_migration_ledger_source_drift'
        const pendingProvenanceMigration = EXPECTED_RUNTIME_MIGRATIONS.at(-1)
        const pendingProvenanceSql = stripOuterTransaction(await readFile(
          `supabase/migrations/${pendingProvenanceMigration}`, 'utf8',
        ))
        let provenanceMigrationStarted = false
        const incorrectProvenanceClient = new Proxy(client, {
          get(target, property) {
            if (property === 'query') {
              return (sql, ...values) => {
                if (typeof sql === 'string' && sql.trim() === pendingProvenanceSql.trim()) {
                  provenanceMigrationStarted = true
                }
                return target.query(sql, ...values)
              }
            }
            return Reflect.get(target, property, target)
          },
        })
        await client.query('begin')
        await client.query(`
          update dpg_control.runtime_migration_ledger
          set application_source = 'runner-applied'
          where filename = $1
        `, [ADOPTED_CHECKPOINT_MIGRATIONS[0]])
        await client.query('delete from dpg_control.runtime_migration_ledger where filename = $1', [pendingProvenanceMigration])
        await expect(executeRuntimeMigrations(incorrectProvenanceClient, 'apply'))
          .rejects.toThrow('migration_ledger_source_drift')
        expect(provenanceMigrationStarted).toBe(false)
        await client.query('rollback')

        phase = 'reject_backup_write_privilege'
        await client.query('grant insert (id) on dpg_v1.products to dpg_backup')
        await expect(client.query(runtimeReadonlyAcceptance))
          .rejects.toThrow('SUPABASE_RUNTIME_READONLY_BACKUP_WRITE_PRIVILEGE')
        await client.query('rollback').catch(() => undefined)
        await client.query('revoke insert (id) on dpg_v1.products from dpg_backup')
        await client.query(runtimeReadonlyAcceptance)

        phase = 'reject_api_relation_set_drift'
        await client.query('create sequence dpg_v1_api.unexpected_runtime_sequence')
        await expect(client.query(runtimeReadonlyAcceptance))
          .rejects.toThrow('SUPABASE_RUNTIME_READONLY_API_RELATION_SET_FAILED')
        await client.query('rollback').catch(() => undefined)
        await client.query('drop sequence dpg_v1_api.unexpected_runtime_sequence')
        phase = 'reject_runtime_schema_grant_drift'
        await client.query('grant usage on schema dpg_v1_api to service_role')
        await expect(client.query(runtimeReadonlyAcceptance))
          .rejects.toThrow('SUPABASE_RUNTIME_READONLY_API_SCHEMA_GRANT_SET_FAILED')
        await client.query('rollback').catch(() => undefined)
        await client.query('revoke usage on schema dpg_v1_api from service_role')
        phase = 'reject_api_relation_grant_drift'
        await client.query('grant select (id) on dpg_v1_api.public_products to service_role')
        await expect(client.query(runtimeReadonlyAcceptance))
          .rejects.toThrow('SUPABASE_RUNTIME_READONLY_API_GRANT_SET_FAILED')
        await client.query('rollback').catch(() => undefined)
        await client.query('revoke select (id) on dpg_v1_api.public_products from service_role')
        await client.query(runtimeReadonlyAcceptance)

        phase = 'reject_migration_ledger_hash_drift'
        await client.query('begin')
        await client.query(`
          update dpg_control.runtime_migration_ledger
          set sha256 = repeat('0', 64)
          where filename = $1
        `, [EXPECTED_RUNTIME_MIGRATIONS.at(-1)])
        await expect(executeRuntimeMigrations(client, 'status')).rejects.toThrow('migration_ledger_drift')
        await client.query('rollback')
        await client.query('begin')
        for (const table of [
          'admin_sessions',
          'crawl_import_decisions',
          'crawl_product_snapshots',
          'crawl_runs',
          'product_families',
          'product_family_catalogue_gaps',
          'product_family_configuration_groups',
          'product_family_memberships',
          'publishing_credentials',
        ]) {
          await client.query(`alter table dpg_app.${table} no force row level security`)
          await client.query(`alter table dpg_app.${table} disable row level security`)
        }
        for (const table of [
          'product_families',
          'product_family_catalogue_gaps',
          'product_family_configuration_groups',
          'product_family_memberships',
        ]) {
          await client.query(`drop policy leo560_readonly_select on dpg_app.${table}`)
        }
        await client.query('drop policy leo540_backup_select on dpg_app.admin_sessions')
        phase = 'reject_rollback_hardening_precondition_drift'
        await expect(client.query(hardeningMigration))
          .rejects.toThrow(/LEO560_RLS_BACKUP_POLICY_PRECONDITION_FAILED:admin_sessions/)
        await client.query('rollback')

        await client.query(rlsAcceptance)
        await client.query(runtimeReadonlyAcceptance)
        await client.query(cataloguePreflight)
        phase = 'verify_final_migration_status'
        await executeRuntimeMigrations(client, 'status')
      } catch (error) {
        const failureKind = postgresFailureKind(error)
        const tcpProbe = postgresReadiness(container, '127.0.0.1')
        process.stderr.write(
          `[PG17_MIGRATION_DIAGNOSTIC] phase=${phase} client=${postgresClientState(client)} `
          + `container=${postgresContainerState(container)} tcp_probe=${Number.isInteger(tcpProbe.status) ? tcpProbe.status : 'unavailable'} `
          + `failure=${failureKind}\n`,
        )
        throw sanitizedIntegrationFailure(error, phase, failureKind)
      } finally {
        await client?.end().catch(() => undefined)
        spawnSync('docker', ['rm', '--force', container], { stdio: 'ignore' })
      }
    },
    120_000,
  )
})
