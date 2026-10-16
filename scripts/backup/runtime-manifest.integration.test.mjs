import { readFileSync } from 'node:fs'

import { Client } from 'pg'
import { describe, expect, it } from 'vitest'

import {
  CANONICAL_V1_RESTORE_COUNT_TABLES,
  RESTORE_COUNT_TABLES,
} from './manifest-contract.mjs'

const databaseUrl = process.env.POSTGRES_SNAPSHOT_INTEGRATION_URL
const integration = databaseUrl ? describe : describe.skip
const runtimeManifestSql = readFileSync('scripts/backup/runtime-manifest.sql', 'utf8')

function databaseConnection(name) {
  const url = new URL(databaseUrl)
  url.pathname = `/${name}`
  return url.toString()
}

async function bootstrapRuntimeManifestDatabase(client) {
  await client.query(`
    create schema dpg_app;
    create schema dpg_v1;
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

    create table dpg_control.leo538_restore_manifest (
      table_name text primary key,
      row_count bigint not null,
      sha256 text not null,
      source_authority text not null
    );
  `)

  for (const tableName of RESTORE_COUNT_TABLES) {
    await client.query(`create table dpg_app.${tableName} (id integer)`)
  }
  for (const identity of CANONICAL_V1_RESTORE_COUNT_TABLES) {
    const tableName = identity.replace('dpg_v1.', '')
    await client.query(`create table dpg_v1.${tableName} (label text, recorded_at timestamp with time zone)`)
  }

  await client.query(`
    insert into dpg_v1.categories values
      ('zebra', '2026-10-16 03:20:17+00'),
      ('äpple', '2026-10-16 05:20:17+00')
  `)
}

async function runtimeManifest(client, timezone) {
  await client.query(`set time zone '${timezone}'`)
  const result = await client.query(runtimeManifestSql)
  const queryResult = Array.isArray(result) ? result.at(-1) : result
  return JSON.parse(queryResult.rows[0].jsonb_build_object)
}

function categoryHash(manifest) {
  return manifest.data.find((entry) => entry.tableName === 'dpg_v1.categories').sha256
}

integration('LEO-540 runtime manifest database contract', () => {
  it('produces the same row hash in different session timezones', async () => {
    const databaseName = `runtime_manifest_${process.pid}_${Date.now()}`
    const admin = new Client({ connectionString: databaseUrl })
    await admin.connect()
    await admin.query(`create database ${databaseName}`)

    const client = new Client({ connectionString: databaseConnection(databaseName) })
    try {
      await client.connect()
      await bootstrapRuntimeManifestDatabase(client)

      const utc = await runtimeManifest(client, 'UTC')
      const hoChiMinh = await runtimeManifest(client, 'Asia/Ho_Chi_Minh')

      expect(categoryHash(hoChiMinh) === categoryHash(utc)).toBe(true)
    } finally {
      await client.end()
      await admin.query(`drop database ${databaseName} with (force)`)
      await admin.end()
    }
  })
})
