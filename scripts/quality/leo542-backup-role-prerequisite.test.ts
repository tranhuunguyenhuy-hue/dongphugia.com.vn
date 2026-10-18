import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { Client } from 'pg'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const migrationPath = path.join(
  root,
  'supabase/migrations/20260828183000_leo542_backup_role_prerequisite.sql',
)
const integrationUrl = process.env.POSTGRES_SNAPSHOT_INTEGRATION_URL

function isLoopbackConnection(value: string) {
  try {
    const hostname = new URL(value).hostname.replace(/^\[|\]$/g, '')
    return ['localhost', '127.0.0.1', '::1'].includes(hostname)
  } catch {
    return false
  }
}

const disposableIntegration = Boolean(integrationUrl && isLoopbackConnection(integrationUrl))

describe('LEO-542 backup capability prerequisite', () => {
  it('recreates only the passwordless backup capability on the exact Preview target', async () => {
    const migration = await readFile(migrationPath, 'utf8')

    expect(migration).toContain("project_name = 'dongphugia-runtime'")
    expect(migration).toContain("region = 'ap-southeast-1'")
    expect(migration).toContain("environment = 'preview'")
    expect(migration).toContain("data_class = 'production-derived-reduced-runtime'")
    expect(migration).toContain('create role dpg_backup')
    expect(migration).toMatch(/create role dpg_backup\s+noinherit nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls/i)
    expect(migration).toContain("rolname = 'dpg_backup'")
    expect(migration).toContain('LEO542_BACKUP_ROLE_CONTRACT_FAILED')
    expect(migration).toContain('LEO542_BACKUP_ROLE_AUTHORITY_DRIFT_FAILED')
    expect(migration).toContain('pg_auth_members')
    expect(migration).toContain('pg_shdepend')
    expect(migration).toContain('pg_default_acl')
    expect(migration).toContain('aclexplode')
    expect(migration).toContain('pg_db_role_setting')
    expect(migration).not.toMatch(/\bpassword\b|\blogin\b|dpg_backup_login/i)
    expect(migration).not.toMatch(/^\s*(grant|revoke)\b/im)
    expect(migration).not.toMatch(/\bdpg_app\.|\bdpg_v1\.|\bauth\.|\bstorage\./i)
  })

  it.runIf(disposableIntegration)(
    'creates the exact capability idempotently and rejects attribute drift in disposable PostgreSQL',
    async () => {
      if (!integrationUrl) throw new Error('POSTGRES_SNAPSHOT_INTEGRATION_URL_REQUIRED')

      const databaseName = `leo542_backup_role_${process.pid}_${Date.now()}`
      const admin = new Client({ connectionString: integrationUrl })
      await admin.connect()
      await admin.query(`create database ${databaseName}`)

      const databaseUrl = new URL(integrationUrl)
      databaseUrl.pathname = `/${databaseName}`
      const client = new Client({ connectionString: databaseUrl.toString() })

      try {
        await client.connect()
        await client.query(`
          create schema dpg_control;
          create table dpg_control.target_contract (
            singleton boolean primary key,
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
        `)

        const migration = await readFile(migrationPath, 'utf8')
        await client.query(migration)
        await client.query(migration)

        const role = await client.query<{
          rolinherit: boolean
          rolcanlogin: boolean
          rolsuper: boolean
          rolcreatedb: boolean
          rolcreaterole: boolean
          rolreplication: boolean
          rolbypassrls: boolean
        }>(`
          select rolinherit, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole,
                 rolreplication, rolbypassrls
          from pg_roles where rolname = 'dpg_backup'
        `)
        expect(role.rows).toEqual([{
          rolinherit: false,
          rolcanlogin: false,
          rolsuper: false,
          rolcreatedb: false,
          rolcreaterole: false,
          rolreplication: false,
          rolbypassrls: false,
        }])

        await client.query('begin')
        await client.query('alter role dpg_backup login')
        await expect(client.query(migration)).rejects.toThrow(/LEO542_BACKUP_ROLE_CONTRACT_FAILED/)
        await client.query('rollback')

        await client.query('begin')
        await client.query("create type public.leo542_acl_type as enum ('synthetic')")
        await client.query('grant usage on type public.leo542_acl_type to dpg_backup')
        await expect(client.query(migration)).rejects.toThrow(/LEO542_BACKUP_ROLE_AUTHORITY_DRIFT_FAILED/)
        await client.query('rollback')

        await client.query('begin')
        await client.query('create role leo542_stronger_role noinherit nologin')
        await client.query('grant leo542_stronger_role to dpg_backup')
        await expect(client.query(migration)).rejects.toThrow(/LEO542_BACKUP_ROLE_AUTHORITY_DRIFT_FAILED/)
        await client.query('rollback')

        await client.query('begin')
        await client.query('create schema authorization dpg_backup')
        await expect(client.query(migration)).rejects.toThrow(/LEO542_BACKUP_ROLE_AUTHORITY_DRIFT_FAILED/)
        await client.query('rollback')

        await client.query('begin')
        await client.query('alter default privileges for role dpg_backup grant select on tables to public')
        await expect(client.query(migration)).rejects.toThrow(/LEO542_BACKUP_ROLE_AUTHORITY_DRIFT_FAILED/)
        await client.query('rollback')
      } finally {
        await client.end().catch(() => undefined)
        await admin.query(`drop database if exists ${databaseName} with (force)`)
        await admin.end()
      }
    },
    20_000,
  )
})
