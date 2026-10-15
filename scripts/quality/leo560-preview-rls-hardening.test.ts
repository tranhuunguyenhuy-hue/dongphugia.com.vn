import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { Client } from 'pg'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const migrationPath = path.join(root, 'supabase/migrations/20261016090000_leo560_preview_rls_hardening.sql')
const acceptancePath = path.join(root, 'supabase/tests/leo560_preview_rls_hardening.sql')
const rollbackPath = path.join(root, 'docs/deploy/leo560-preview-rls-hardening-rollback.sql')
const integrationUrl = process.env.POSTGRES_SNAPSHOT_INTEGRATION_URL

const targetTables = [
  'admin_sessions',
  'crawl_import_decisions',
  'crawl_product_snapshots',
  'crawl_runs',
  'product_families',
  'product_family_catalogue_gaps',
  'product_family_configuration_groups',
  'product_family_memberships',
  'publishing_credentials',
] as const

const readonlyTables = [
  'product_families',
  'product_family_catalogue_gaps',
  'product_family_configuration_groups',
  'product_family_memberships',
] as const

function isLoopbackConnection(value: string) {
  try {
    const hostname = new URL(value).hostname.replace(/^\[|\]$/g, '')
    return ['localhost', '127.0.0.1', '::1'].includes(hostname)
  } catch {
    return false
  }
}

const disposableIntegration = Boolean(integrationUrl && isLoopbackConnection(integrationUrl))

function extractSqlContractArrays(sql: string, variableName: string) {
  const pattern = new RegExp(`${variableName} constant text\\[\\] := array\\[([\\s\\S]*?)\\];`, 'g')
  return [...sql.matchAll(pattern)].map((match) => (
    [...(match[1] ?? '').matchAll(/'([^']+)'/g)].map((entry) => entry[1])
  ))
}

async function bootstrapObservedPreviewState(client: Client) {
  await client.query(`
    do $roles$
    declare role_name text;
    begin
      foreach role_name in array array[
        'dpg_migration', 'dpg_backup', 'dpg_readonly', 'dpg_runtime',
        'anon', 'authenticated', 'service_role'
      ]::text[]
      loop
        if not exists (select 1 from pg_roles where rolname = role_name) then
          execute format(
            'create role %I nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls',
            role_name
          );
        end if;
      end loop;
    end
    $roles$;

    create schema dpg_control authorization dpg_migration;
    create schema dpg_app authorization dpg_migration;
    grant usage on schema dpg_app to dpg_backup, dpg_readonly;

    set role dpg_migration;
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
    insert into dpg_control.target_contract values (
      true, 'dongphugia-runtime', 'ap-southeast-1', 'preview',
      'production-derived-reduced-runtime', true, false, false, 367001600
    );

    create table dpg_app.admin_sessions (id integer primary key);
    create table dpg_app.crawl_import_decisions (id integer primary key);
    create table dpg_app.crawl_product_snapshots (id integer primary key);
    create table dpg_app.crawl_runs (id integer primary key);
    create table dpg_app.product_families (id integer primary key);
    create table dpg_app.product_family_catalogue_gaps (id integer primary key);
    create table dpg_app.product_family_configuration_groups (id integer primary key);
    create table dpg_app.product_family_memberships (id integer primary key);
    create table dpg_app.publishing_credentials (id integer primary key);

    insert into dpg_app.admin_sessions values (1);
    insert into dpg_app.crawl_import_decisions values (1);
    insert into dpg_app.crawl_product_snapshots values (1);
    insert into dpg_app.crawl_runs values (1);
    insert into dpg_app.product_families values (1);
    insert into dpg_app.product_family_catalogue_gaps values (1);
    insert into dpg_app.product_family_configuration_groups values (1);
    insert into dpg_app.product_family_memberships values (1);
    insert into dpg_app.publishing_credentials values (1);

    grant select on all tables in schema dpg_app to dpg_backup;
    grant select on table
      dpg_app.product_families,
      dpg_app.product_family_catalogue_gaps,
      dpg_app.product_family_configuration_groups,
      dpg_app.product_family_memberships
    to dpg_readonly;

    create policy leo540_backup_select on dpg_app.admin_sessions for select to dpg_backup using (true);
    create policy leo540_backup_select on dpg_app.crawl_import_decisions for select to dpg_backup using (true);
    create policy leo540_backup_select on dpg_app.crawl_product_snapshots for select to dpg_backup using (true);
    create policy leo540_backup_select on dpg_app.crawl_runs for select to dpg_backup using (true);
    create policy leo540_backup_select on dpg_app.product_families for select to dpg_backup using (true);
    create policy leo540_backup_select on dpg_app.product_family_catalogue_gaps for select to dpg_backup using (true);
    create policy leo540_backup_select on dpg_app.product_family_configuration_groups for select to dpg_backup using (true);
    create policy leo540_backup_select on dpg_app.product_family_memberships for select to dpg_backup using (true);
    create policy leo540_backup_select on dpg_app.publishing_credentials for select to dpg_backup using (true);
    reset role;
  `)
}

describe('LEO-560 Preview RLS hardening', () => {
  it('keeps the target, privileges, policies, and rollback scope exact', async () => {
    const [migration, acceptance, rollback] = await Promise.all([
      readFile(migrationPath, 'utf8'),
      readFile(acceptancePath, 'utf8'),
      readFile(rollbackPath, 'utf8'),
    ])

    for (const table of targetTables) {
      expect(migration).toContain(`'${table}'`)
      expect(rollback).toContain(`alter table dpg_app.${table} disable row level security`)
    }
    for (const table of readonlyTables) {
      expect(rollback).toContain(`drop policy leo560_readonly_select on dpg_app.${table}`)
    }

    for (const sql of [migration, acceptance, rollback]) {
      const targetContracts = extractSqlContractArrays(sql, 'target_tables')
      const readonlyContracts = extractSqlContractArrays(sql, 'readonly_tables')
      expect(targetContracts.length).toBeGreaterThan(0)
      expect(readonlyContracts.length).toBeGreaterThan(0)
      for (const contract of targetContracts) expect(contract).toEqual(targetTables)
      for (const contract of readonlyContracts) expect(contract).toEqual(readonlyTables)
    }

    expect(migration).toContain("project_name = 'dongphugia-runtime'")
    expect(migration).toContain("region = 'ap-southeast-1'")
    expect(migration).toContain("environment = 'preview'")
    expect(migration).toContain("data_class = 'production-derived-reduced-runtime'")
    expect(migration).toContain("p.polname = 'leo540_backup_select'")
    expect(migration).toContain('create policy leo560_readonly_select')
    expect(migration).toContain("rolname in ('dpg_migration', 'dpg_backup', 'dpg_readonly', 'dpg_runtime')")
    expect(migration).not.toMatch(/^\s*grant\b/im)
    expect(migration).not.toMatch(/^\s*(insert|update|delete|truncate)\s+(?:into|from\s+)?dpg_app\./im)
    expect(migration).not.toMatch(/revoke .* from .*dpg_backup|revoke .* from .*dpg_readonly/i)

    expect(acceptance).toContain('begin transaction isolation level repeatable read read only')
    expect(acceptance.trimEnd()).toMatch(/rollback;$/)
    expect(rollback).not.toMatch(/^\s*(drop table|truncate|delete|update|insert)\b/im)
    expect(rollback).not.toMatch(/drop policy leo540_backup_select/i)
    expect(rollback).not.toMatch(/revoke .*dpg_backup|revoke .*dpg_readonly/i)
  })

  it.runIf(disposableIntegration)(
    'preserves backup/read-only access, blocks broad roles and owner bypass, and restores the observed catalog state',
    async () => {
      if (!integrationUrl) throw new Error('POSTGRES_SNAPSHOT_INTEGRATION_URL_REQUIRED')

      const databaseName = `leo560_rls_${process.pid}_${Date.now()}`
      const admin = new Client({ connectionString: integrationUrl })
      await admin.connect()
      await admin.query(`create database ${databaseName}`)

      const databaseUrl = new URL(integrationUrl)
      databaseUrl.pathname = `/${databaseName}`
      const client = new Client({ connectionString: databaseUrl.toString() })

      try {
        await client.connect()
        await bootstrapObservedPreviewState(client)

        const migration = await readFile(migrationPath, 'utf8')
        await client.query('alter role dpg_migration bypassrls')
        await expect(client.query(migration)).rejects.toThrow(/LEO560_RLS_ROLE_CONTRACT_FAILED/)
        await client.query('rollback')
        await client.query('alter role dpg_migration nobypassrls')
        await client.query(migration)

        const acceptance = (await readFile(acceptancePath, 'utf8')).replace(/^\\set[^\n]*\n/, '')
        await client.query(acceptance)

        await client.query('alter role dpg_migration bypassrls')
        await expect(client.query(acceptance)).rejects.toThrow(/LEO560_RLS_ACCEPTANCE_ROLE_CONTRACT_FAILED/)
        await client.query('rollback')
        await client.query('alter role dpg_migration nobypassrls')

        await client.query('alter role dpg_migration createdb')
        await expect(client.query(acceptance)).rejects.toThrow(/LEO560_RLS_ACCEPTANCE_ROLE_CONTRACT_FAILED/)
        await client.query('rollback')
        await client.query('alter role dpg_migration nocreatedb')

        await client.query('alter role dpg_runtime createdb')
        await expect(client.query(acceptance)).rejects.toThrow(/LEO560_RLS_ACCEPTANCE_ROLE_CONTRACT_FAILED/)
        await client.query('rollback')
        await client.query('alter role dpg_runtime nocreatedb')

        await client.query('alter table dpg_app.admin_sessions owner to postgres')
        await expect(client.query(acceptance)).rejects.toThrow(/LEO560_RLS_ACCEPTANCE_POLICY_FAILED/)
        await client.query('rollback')
        await client.query('alter table dpg_app.admin_sessions owner to dpg_migration')
        await client.query(acceptance)

        const hardened = await client.query<{
          table_name: string
          rls_enabled: boolean
          rls_forced: boolean
          policy_count: number
        }>(`
          select c.relname as table_name,
                 c.relrowsecurity as rls_enabled,
                 c.relforcerowsecurity as rls_forced,
                 count(p.*)::int as policy_count
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          left join pg_policy p on p.polrelid = c.oid
          where n.nspname = 'dpg_app' and c.relname = any($1::text[])
          group by c.oid, c.relname, c.relrowsecurity, c.relforcerowsecurity
          order by c.relname
        `, [targetTables])

        expect(hardened.rows).toHaveLength(targetTables.length)
        for (const row of hardened.rows) {
          expect(row.rls_enabled).toBe(true)
          expect(row.rls_forced).toBe(true)
          expect(row.policy_count).toBe(readonlyTables.includes(row.table_name as typeof readonlyTables[number]) ? 2 : 1)
        }

        await client.query('set role dpg_backup')
        for (const table of targetTables) {
          const result = await client.query<{ count: number }>(`select count(*)::int as count from dpg_app.${table}`)
          expect(result.rows[0]?.count).toBe(1)
        }
        await expect(client.query('insert into dpg_app.product_families values (2)')).rejects.toThrow()
        await expect(client.query('truncate table dpg_app.product_families')).rejects.toThrow()
        await client.query('reset role')

        await client.query('set role dpg_readonly')
        for (const table of readonlyTables) {
          const result = await client.query<{ count: number }>(`select count(*)::int as count from dpg_app.${table}`)
          expect(result.rows[0]?.count).toBe(1)
        }
        for (const table of targetTables.filter((name) => !readonlyTables.includes(name as typeof readonlyTables[number]))) {
          await expect(client.query(`select * from dpg_app.${table}`)).rejects.toThrow()
        }
        await client.query('reset role')

        await client.query('set role dpg_migration')
        const ownerResult = await client.query<{ count: number }>(
          'select count(*)::int as count from dpg_app.product_families',
        )
        expect(ownerResult.rows[0]?.count).toBe(0)
        await client.query('reset role')

        await client.query('set role anon')
        await expect(client.query('select * from dpg_app.product_families')).rejects.toThrow()
        await client.query('reset role')

        const rollback = await readFile(rollbackPath, 'utf8')
        await client.query('grant truncate on table dpg_app.product_families to service_role')
        await expect(client.query(rollback)).rejects.toThrow(/LEO560_RLS_ROLLBACK_BROAD_PRIVILEGE_FAILED/)
        await client.query('rollback')
        await client.query('revoke truncate on table dpg_app.product_families from service_role')
        await client.query(rollback)
        const restored = await client.query<{ table_name: string; rls_enabled: boolean; rls_forced: boolean; policy_count: number }>(`
          select c.relname as table_name,
                 c.relrowsecurity as rls_enabled,
                 c.relforcerowsecurity as rls_forced,
                 count(p.*)::int as policy_count
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          left join pg_policy p on p.polrelid = c.oid
          where n.nspname = 'dpg_app' and c.relname = any($1::text[])
          group by c.oid, c.relname, c.relrowsecurity, c.relforcerowsecurity
          order by c.relname
        `, [targetTables])
        expect(restored.rows).toHaveLength(targetTables.length)
        for (const row of restored.rows) {
          expect(row).toMatchObject({ rls_enabled: false, rls_forced: false, policy_count: 1 })
        }
      } finally {
        await client.end().catch(() => undefined)
        await admin.query(`drop database if exists ${databaseName} with (force)`)
        await admin.end()
      }
    },
    30_000,
  )
})
