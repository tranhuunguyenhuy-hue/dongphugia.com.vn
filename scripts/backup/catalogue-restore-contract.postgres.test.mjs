import { execFileSync, spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'

import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  buildCatalogueRestoreIdentitySql,
  buildCatalogueSequenceSql,
  buildRuntimeBaselinePreflightSql,
  CATALOGUE_TABLES,
} from './catalogue-restore-contract.mjs'

const { Client } = pg
const postgresImage = process.env.POSTGRES_SNAPSHOT_INTEGRATION_IMAGE
const integration = postgresImage ? describe : describe.skip

let containerName
let databaseClient
let publishedPort

async function readSequenceState(sequenceName) {
  const result = await databaseClient.query(`select last_value::bigint::text, is_called from ${sequenceName}`)
  return result.rows[0]
}

function logicalDumpHash(schema, mode) {
  const args = mode === 'schema'
    ? ['--schema-only', `--schema=${schema}`]
    : ['--data-only', '--column-inserts', `--schema=${schema}`]
  const dump = execFileSync('docker', [
    'exec', containerName, 'pg_dump', '-U', 'postgres', '-d', 'postgres', ...args,
  ], { encoding: 'buffer', stdio: ['ignore', 'pipe', 'pipe'] })
  const normalized = dump.toString('utf8').split('\n').filter((line) => (
    !/^-- Dumped (?:from database|by pg_dump) version /.test(line)
    && !/^\\(?:un)?restrict [^\s]+$/.test(line)
  )).join('\n')
  return createHash('sha256').update(normalized).digest('hex')
}

integration('Issue 160 baseline and sequence behavior on synthetic PostgreSQL', () => {
  beforeAll(async () => {
    containerName = `issue160-contract-${randomUUID().replaceAll('-', '')}`
    execFileSync('docker', [
      'run', '--detach', '--name', containerName, '--publish', '127.0.0.1::5432',
      '--env', 'POSTGRES_HOST_AUTH_METHOD=trust', postgresImage,
    ], { stdio: ['ignore', 'pipe', 'pipe'] })

    const deadline = Date.now() + 30_000
    let ready = false
    while (Date.now() < deadline) {
      const probe = spawnSync('docker', [
        'exec', containerName, 'pg_isready', '-q', '-t', '1', '-h', '127.0.0.1',
        '-U', 'postgres', '-d', 'postgres',
      ], { stdio: 'ignore', timeout: 2_000 })
      if (probe.status === 0) {
        ready = true
        break
      }
      await delay(250)
    }
    if (!ready) throw new Error('synthetic_postgres_not_ready')

    publishedPort = execFileSync('docker', ['port', containerName, '5432/tcp'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim().split(':').at(-1)
    if (!publishedPort || !/^\d+$/.test(publishedPort)) throw new Error('synthetic_postgres_port_unavailable')
    databaseClient = new Client({ connectionString: `postgresql://postgres@127.0.0.1:${publishedPort}/postgres` })
    await databaseClient.connect()
    await databaseClient.query(`
      create schema dpg_app;
      create schema dpg_control;
      create schema dpg_v1;
      create schema auth;
      create schema storage;
      create table dpg_control.target_contract (
        singleton boolean,
        project_name text,
        region text,
        environment text,
        data_class text,
        production_data_allowed boolean,
        production_credentials_allowed boolean,
        production_writes_allowed boolean,
        hard_database_ceiling_bytes bigint
      );
      insert into dpg_control.target_contract values (
        true, 'dongphugia-runtime', 'ap-southeast-1', 'preview',
        'production-derived-reduced-runtime', true, false, false, 367001600
      );
      create table dpg_control.runtime_migration_ledger (filename text);
      create table dpg_control.leo538_restore_manifest (manifest_hash text);
      create table dpg_v1.categories (id uuid primary key);
      create table dpg_v1.role_capabilities (role text, capability text);
      create table auth.users (id uuid primary key);
      create table storage.objects (id uuid primary key);
    `)

    for (const [index, table] of CATALOGUE_TABLES.entries()) {
      await databaseClient.query(`create table dpg_app."${table}" (id bigserial primary key)`)
      if (index >= 13) {
        await databaseClient.query(`alter table dpg_app."${table}" enable row level security`)
        await databaseClient.query(`alter table dpg_app."${table}" force row level security`)
      }
    }
    await databaseClient.query(`
      create role dpg_catalogue_restore nologin noinherit nosuperuser nocreatedb
        nocreaterole noreplication bypassrls;
      create role dpg_catalogue_restore_login login noinherit nosuperuser nocreatedb
        nocreaterole noreplication nobypassrls;
      grant dpg_catalogue_restore to dpg_catalogue_restore_login
        with inherit false, set true;
      grant usage on schema dpg_app, dpg_control, dpg_v1 to dpg_catalogue_restore;
      grant select, insert, update, delete on all tables in schema dpg_app to dpg_catalogue_restore;
      grant select on dpg_control.target_contract, dpg_control.runtime_migration_ledger,
        dpg_control.leo538_restore_manifest, dpg_v1.categories,
        dpg_v1.role_capabilities to dpg_catalogue_restore;
    `)
    for (const table of CATALOGUE_TABLES) {
      await databaseClient.query(`alter sequence dpg_app.${table}_id_seq owner to dpg_catalogue_restore`)
    }
  }, 30_000)

  afterAll(async () => {
    await databaseClient?.end()
    if (containerName) {
      try {
        execFileSync('docker', ['rm', '--force', containerName], { stdio: 'ignore' })
      } catch {
        // Cleanup is best-effort after a failing test; the unique container name is never reused.
      }
    }
  }, 30_000)

  it('accepts the exact empty catalogue baseline and rejects row or RLS drift', async () => {
    const preflight = await databaseClient.query(buildRuntimeBaselinePreflightSql())
    const selectResult = Array.isArray(preflight)
      ? preflight.find((result) => result.rows?.length > 0)
      : preflight
    expect(selectResult?.rows).toHaveLength(1)
    expect(Object.values(selectResult.rows[0])[0]).toMatch(/^\d+\|13\|27$/)

    await databaseClient.query('insert into dpg_app.products default values')
    await expect(databaseClient.query(buildRuntimeBaselinePreflightSql()))
      .rejects.toThrow('runtime_baseline_catalogue_not_empty')
    await databaseClient.query('delete from dpg_app.products')

    await databaseClient.query('alter table dpg_app.brands enable row level security')
    await databaseClient.query('alter table dpg_app.brands force row level security')
    await expect(databaseClient.query(buildRuntimeBaselinePreflightSql()))
      .rejects.toThrow('runtime_baseline_rls_gap_set_changed')
  })

  it('restarts catalogue sequences transactionally and restores their prior state on rollback', async () => {
    await databaseClient.query('insert into dpg_app.brands default values')
    await databaseClient.query('insert into dpg_app.brands (id) values (10)')
    const before = await readSequenceState('dpg_app.brands_id_seq')
    expect(before).toEqual({ last_value: '1', is_called: true })

    await databaseClient.query('begin')
    await databaseClient.query(buildCatalogueSequenceSql())
    expect(await readSequenceState('dpg_app.brands_id_seq'))
      .toEqual({ last_value: '11', is_called: false })
    await databaseClient.query('rollback')
    expect(await readSequenceState('dpg_app.brands_id_seq'))
      .toEqual({ last_value: '1', is_called: true })

    await databaseClient.query('begin')
    await databaseClient.query(buildCatalogueSequenceSql())
    await databaseClient.query('commit')
    expect(await readSequenceState('dpg_app.brands_id_seq'))
      .toEqual({ last_value: '11', is_called: false })
    expect((await databaseClient.query("select nextval('dpg_app.brands_id_seq')::text as value")).rows[0].value)
      .toBe('11')
  })

  it('restores a full logical schema and data snapshot with sequence state equivalence', async () => {
    const schema = `issue160_snapshot_${randomUUID().replaceAll('-', '')}`
    const dumpPath = `/tmp/${schema}.custom`
    const quoteIdentifier = (value) => `"${value.replaceAll('"', '""')}"`
    const identifier = quoteIdentifier(schema)

    try {
      await databaseClient.query(`
        create schema ${identifier};
        create table ${identifier}.records (
          id bigint generated by default as identity primary key,
          payload text not null
        );
        insert into ${identifier}.records (payload) values ('synthetic-before');
        alter table ${identifier}.records enable row level security;
        alter table ${identifier}.records force row level security;
        create policy records_snapshot_read on ${identifier}.records
          for select to public using (true);
        create function ${identifier}.record_count() returns bigint
          language sql stable as $$ select count(*) from ${identifier}.records $$;
        grant select on ${identifier}.records to public;
        grant execute on function ${identifier}.record_count() to public;
      `)
      const schemaHashBefore = logicalDumpHash(schema, 'schema')
      const dataHashBefore = logicalDumpHash(schema, 'data')
      execFileSync('docker', [
        'exec', containerName, 'pg_dump', '-U', 'postgres', '-d', 'postgres',
        '--format=custom', `--schema=${schema}`, `--file=${dumpPath}`,
      ], { stdio: ['ignore', 'pipe', 'pipe'] })

      await databaseClient.query(`
        insert into ${identifier}.records (payload) values ('synthetic-after');
        drop function ${identifier}.record_count();
        drop policy records_snapshot_read on ${identifier}.records;
        alter table ${identifier}.records no force row level security;
        revoke select on ${identifier}.records from public;
      `)

      execFileSync('docker', [
        'exec', containerName, 'pg_restore', '-U', 'postgres', '-d', 'postgres',
        '--format=custom', '--clean', '--if-exists', '--single-transaction', '--exit-on-error', dumpPath,
      ], { stdio: ['ignore', 'pipe', 'pipe'] })

      expect(logicalDumpHash(schema, 'schema')).toBe(schemaHashBefore)
      expect(logicalDumpHash(schema, 'data')).toBe(dataHashBefore)
    } finally {
      await databaseClient.query(`drop schema if exists ${identifier} cascade`)
      execFileSync('docker', ['exec', containerName, 'rm', '-f', dumpPath], {
        stdio: ['ignore', 'ignore', 'ignore'],
      })
    }
  })

  it('accepts only the purpose-bound catalogue restore role and exact table grants', async () => {
    const restoreClient = new Client({
      connectionString: `postgresql://dpg_catalogue_restore_login@127.0.0.1:${publishedPort}/postgres`,
      options: '-c role=dpg_catalogue_restore',
    })
    try {
      await restoreClient.connect()
      await restoreClient.query(buildCatalogueRestoreIdentitySql())
      await databaseClient.query('create table dpg_app.unrelated_restore_probe (id integer)')
      await databaseClient.query('grant select on dpg_app.unrelated_restore_probe to dpg_catalogue_restore')
      await expect(restoreClient.query(buildCatalogueRestoreIdentitySql()))
        .rejects.toThrow('catalogue_restore_unrelated_grant_present')
      await databaseClient.query('revoke select on dpg_app.unrelated_restore_probe from dpg_catalogue_restore')
      await databaseClient.query('drop table dpg_app.unrelated_restore_probe')
    } finally {
      await restoreClient.end()
    }
  })
})
