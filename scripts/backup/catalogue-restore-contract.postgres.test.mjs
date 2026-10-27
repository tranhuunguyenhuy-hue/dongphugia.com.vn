import { randomUUID } from 'node:crypto'

import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  buildCatalogueSequenceSql,
  buildRuntimeBaselinePreflightSql,
  CATALOGUE_TABLES,
} from './catalogue-restore-contract.mjs'

const { Client } = pg
const serviceUrl = process.env.POSTGRES_SNAPSHOT_INTEGRATION_URL
const integration = serviceUrl ? describe : describe.skip

let databaseName
let databaseClient

async function readSequenceState(sequenceName) {
  const result = await databaseClient.query(`select last_value::bigint::text, is_called from ${sequenceName}`)
  return result.rows[0]
}

integration('Issue 160 baseline and sequence behavior on synthetic PostgreSQL', () => {
  beforeAll(async () => {
    const admin = new Client({ connectionString: serviceUrl })
    await admin.connect()
    databaseName = `issue160_contract_${randomUUID().replaceAll('-', '')}`
    try {
      await admin.query(`create database "${databaseName}"`)
    } finally {
      await admin.end()
    }

    const databaseUrl = new URL(serviceUrl)
    databaseUrl.pathname = `/${databaseName}`
    databaseClient = new Client({ connectionString: databaseUrl.toString() })
    await databaseClient.connect()
    await databaseClient.query(`
      create schema dpg_app;
      create schema dpg_control;
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
  }, 30_000)

  afterAll(async () => {
    await databaseClient?.end()
    if (!databaseName) return
    const admin = new Client({ connectionString: serviceUrl })
    await admin.connect()
    try {
      await admin.query(`drop database if exists "${databaseName}" with (force)`)
    } finally {
      await admin.end()
    }
  }, 30_000)

  it('accepts the exact empty catalogue baseline and rejects row or RLS drift', async () => {
    const preflight = await databaseClient.query(buildRuntimeBaselinePreflightSql())
    expect(Object.values(preflight.rows[0])[0]).toMatch(/^\d+\|13\|27$/)

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
})
