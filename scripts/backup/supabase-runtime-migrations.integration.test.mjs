import { execFileSync, spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import pg from 'pg'
import { describe, expect, it } from 'vitest'

import {
  ADOPTED_CHECKPOINT_MIGRATIONS,
  EXPECTED_RUNTIME_MIGRATIONS,
  assertDatabaseSizeWithinContract,
  executeRuntimeMigrations,
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

describe('Supabase runtime migration adoption integration', () => {
  it.runIf(dockerIntegration)(
    'attests the checkpoint, commits pending migrations separately, and revalidates status',
    async () => {
      const container = `dpg-runtime-migrations-${process.pid}-${Date.now()}`
      docker('run', '--detach', '--name', container, '--publish', '127.0.0.1::5432',
        '--env', 'POSTGRES_HOST_AUTH_METHOD=trust', postgresImage)

      let client
      try {
        for (let attempt = 0; attempt < 45; attempt += 1) {
          const ready = spawnSync('docker', ['exec', container, 'pg_isready', '-U', 'postgres'])
          if (ready.status === 0) break
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
        const port = docker('port', container, '5432/tcp').split(':').at(-1)
        const connectionString = `postgresql://postgres@127.0.0.1:${port}/postgres`
        client = new Client({ connectionString })
        await client.connect()
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

        for (const filename of ADOPTED_CHECKPOINT_MIGRATIONS) {
          await client.query(await readFile(`supabase/migrations/${filename}`, 'utf8'))
        }

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

        await client.query("insert into dpg_app.brands (name, slug) values ('Rejected', 'rejected')")
        await expect(executeRuntimeMigrations(client, 'apply', attestCheckpoint))
          .rejects.toThrow(/SUPABASE_CHECKPOINT_UNEXPECTED_ROWS/)
        expect((await client.query(
          "select to_regclass('dpg_control.runtime_migration_ledger') is null as absent",
        )).rows[0]?.absent).toBe(true)
        await client.query("delete from dpg_app.brands where slug = 'rejected'")

        await client.query('alter role dpg_runtime_login connection limit 9')
        await expect(executeRuntimeMigrations(client, 'apply', attestCheckpoint))
          .rejects.toThrow(/SUPABASE_CHECKPOINT_ROLE_FAILED/)
        await client.query('alter role dpg_runtime_login connection limit 10')

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

        await executeRuntimeMigrations(client, 'apply', attestCheckpoint)

        const ledger = await client.query('select count(*)::integer as count from dpg_control.runtime_migration_ledger')
        expect(ledger.rows[0]?.count).toBe(23)

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

        await client.query(rlsAcceptance)
        await client.query(runtimeReadonlyAcceptance)
        await client.query(cataloguePreflight)

        await client.query('begin')
        await client.query(`
          create policy codex_unexpected_product_policy on dpg_v1.products
          for select to authenticated using (true)
        `)
        await expect(client.query(runtimeReadonlyAcceptance))
          .rejects.toThrow('SUPABASE_RUNTIME_READONLY_RLS_POLICY_SET_FAILED')
        await client.query('rollback')
        await client.query(runtimeReadonlyAcceptance)

        await client.query('begin')
        await client.query('drop policy v1_products_staff_select on dpg_v1.products')
        await client.query(`
          create policy v1_products_staff_select on dpg_v1.products
          for select to authenticated using (true)
        `)
        await expect(client.query(runtimeReadonlyAcceptance))
          .rejects.toThrow('SUPABASE_RUNTIME_READONLY_RLS_POLICY_SET_FAILED')
        await client.query('rollback')
        await client.query(runtimeReadonlyAcceptance)

        await client.query('begin')
        await client.query('grant create on schema dpg_v1_api to authenticated')
        await client.query('alter view dpg_v1_api.public_products owner to authenticated')
        await expect(client.query(runtimeReadonlyAcceptance))
          .rejects.toThrow('SUPABASE_RUNTIME_READONLY_API_OWNER_FAILED')
        await client.query('rollback')
        await client.query(runtimeReadonlyAcceptance)

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
        await expect(client.query(runtimeReadonlyAcceptance))
          .rejects.toThrow('SUPABASE_RUNTIME_READONLY_RLS_POLICY_SET_FAILED')
        await client.query('rollback')
        await client.query(runtimeReadonlyAcceptance)

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
        await expect(client.query(runtimeReadonlyAcceptance))
          .rejects.toThrow('SUPABASE_RUNTIME_READONLY_CAPABILITY_HELPER_FAILED')
        await client.query('rollback')
        await client.query(runtimeReadonlyAcceptance)

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
        await expect(client.query(runtimeReadonlyAcceptance))
          .rejects.toThrow('SUPABASE_RUNTIME_READONLY_CAPABILITY_HELPER_FAILED')
        await client.query('rollback')
        await client.query(runtimeReadonlyAcceptance)

        await client.query('begin')
        await client.query('alter function dpg_v1_api.public_product_get(uuid) security definer')
        await expect(client.query(runtimeReadonlyAcceptance))
          .rejects.toThrow('SUPABASE_RUNTIME_READONLY_API_FUNCTION_SECURITY_MODE_FAILED')
        await client.query('rollback')
        await client.query(runtimeReadonlyAcceptance)

        await client.query('begin')
        await client.query(`
          create function dpg_v1_api.codex_unexpected_helper()
          returns integer language sql immutable as 'select 1'
        `)
        await expect(client.query(runtimeReadonlyAcceptance))
          .rejects.toThrow('SUPABASE_RUNTIME_READONLY_API_FUNCTION_SET_FAILED')
        await client.query('rollback')
        await client.query(runtimeReadonlyAcceptance)

        await client.query('begin')
        await client.query('grant execute on function dpg_v1_api.public_product_get(uuid) to public')
        await expect(client.query(runtimeReadonlyAcceptance))
          .rejects.toThrow('SUPABASE_RUNTIME_READONLY_API_FUNCTION_GRANT_SET_FAILED')
        await client.query('rollback')
        await client.query(runtimeReadonlyAcceptance)

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

        await client.query('grant insert (id) on dpg_v1.products to dpg_backup')
        await expect(client.query(runtimeReadonlyAcceptance))
          .rejects.toThrow('SUPABASE_RUNTIME_READONLY_BACKUP_WRITE_PRIVILEGE')
        await client.query('rollback').catch(() => undefined)
        await client.query('revoke insert (id) on dpg_v1.products from dpg_backup')
        await client.query(runtimeReadonlyAcceptance)

        await client.query('create sequence dpg_v1_api.unexpected_runtime_sequence')
        await expect(client.query(runtimeReadonlyAcceptance))
          .rejects.toThrow('SUPABASE_RUNTIME_READONLY_API_RELATION_SET_FAILED')
        await client.query('rollback').catch(() => undefined)
        await client.query('drop sequence dpg_v1_api.unexpected_runtime_sequence')
        await client.query('grant usage on schema dpg_v1_api to service_role')
        await expect(client.query(runtimeReadonlyAcceptance))
          .rejects.toThrow('SUPABASE_RUNTIME_READONLY_API_SCHEMA_GRANT_SET_FAILED')
        await client.query('rollback').catch(() => undefined)
        await client.query('revoke usage on schema dpg_v1_api from service_role')
        await client.query('grant select (id) on dpg_v1_api.public_products to service_role')
        await expect(client.query(runtimeReadonlyAcceptance))
          .rejects.toThrow('SUPABASE_RUNTIME_READONLY_API_GRANT_SET_FAILED')
        await client.query('rollback').catch(() => undefined)
        await client.query('revoke select (id) on dpg_v1_api.public_products from service_role')
        await client.query(runtimeReadonlyAcceptance)

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
        await expect(client.query(hardeningMigration))
          .rejects.toThrow(/LEO560_RLS_BACKUP_POLICY_PRECONDITION_FAILED:admin_sessions/)
        await client.query('rollback')

        await client.query(rlsAcceptance)
        await client.query(runtimeReadonlyAcceptance)
        await client.query(cataloguePreflight)
        await executeRuntimeMigrations(client, 'status')
      } finally {
        await client?.end().catch(() => undefined)
        spawnSync('docker', ['rm', '--force', container], { stdio: 'ignore' })
      }
    },
    120_000,
  )
})
