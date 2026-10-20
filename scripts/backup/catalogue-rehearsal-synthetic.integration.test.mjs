import { spawnSync } from 'node:child_process'
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import pg from 'pg'
import { describe, expect, it } from 'vitest'

import {
  CATALOGUE_RESTORE_ORDER,
  CATALOGUE_TABLES,
  buildRehearsalTargetCheckSql,
  compareCatalogueManifests,
} from './catalogue-restore-contract.mjs'

const databaseUrl = process.env.POSTGRES_SNAPSHOT_INTEGRATION_URL
const image = process.env.POSTGRES_SNAPSHOT_INTEGRATION_IMAGE
const runIntegration = Boolean(databaseUrl && image && process.platform === 'linux')

function docker(args, options = {}) {
  const result = spawnSync('docker', ['run', '--rm', '--pull=never', '--network=host', ...args], {
    encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, ...options,
  })
  if (result.status !== 0) throw new Error(`synthetic_pg_command_failed:${result.status}`)
  return result.stdout
}

function databaseConnection(name) {
  const url = new URL(databaseUrl)
  url.pathname = `/${name}`
  return url.toString()
}

async function catalogueSnapshot(client) {
  const tables = []
  for (const tableName of CATALOGUE_TABLES) {
    const result = await client.query(`select count(*)::bigint as row_count,
      encode(sha256(convert_to(coalesce(string_agg(to_jsonb(item)::text, E'\\n'
        order by to_jsonb(item)::text COLLATE "C"), ''), 'UTF8')), 'hex') as sha256
      from dpg_app.${tableName} item`)
    tables.push({ tableName, rowCount: Number(result.rows[0].row_count), sha256: result.rows[0].sha256 })
  }
  return { contract: 'dongphugia:catalogue-filtered-restore:v1', tables, excludedRows: [] }
}

describe.skipIf(!runIntegration)('catalogue rehearsal PG17.6 synthetic restore', () => {
  it('imports only 27 catalogue data tables and rejects missing names and excluded data', async () => {
    const suffix = `${process.pid}_${Date.now()}`
    const sourceName = `b1_source_${suffix}`
    const targetName = `b1_target_${suffix}`
    const folder = await mkdtemp(join(tmpdir(), 'b1-catalogue-synthetic-'))
    const archivePath = join(folder, 'synthetic.dump')
    const admin = new pg.Client({ connectionString: databaseUrl })
    let source
    let target
    await admin.connect()
    try {
      await admin.query(`create database ${sourceName}`)
      await admin.query(`create database ${targetName}`)
      source = new pg.Client({ connectionString: databaseConnection(sourceName) })
      target = new pg.Client({ connectionString: databaseConnection(targetName) })
      await source.connect()
      await target.connect()
      await source.query('create schema dpg_app; create schema dpg_v1; create schema dpg_control; create schema unexpected')
      for (const table of CATALOGUE_TABLES) {
        await source.query(`create table dpg_app.${table} (id integer primary key, label text)`)
        await source.query(`insert into dpg_app.${table} values (1, 'synthetic')`)
      }
      await source.query("create table dpg_app.blog_posts (id integer); insert into dpg_app.blog_posts values (1)")
      await source.query("create table dpg_app.product_families (id integer); insert into dpg_app.product_families values (1)")
      await source.query("create sequence dpg_app.unused_seq")
      await source.query("create table dpg_v1.staff_users (id integer); insert into dpg_v1.staff_users values (1)")
      await source.query("create table dpg_v1.products (id integer); insert into dpg_v1.products values (1)")
      await source.query("create table dpg_control.private_flags (id integer); insert into dpg_control.private_flags values (1)")
      await source.query("create table unexpected.private_rows (id integer); insert into unexpected.private_rows values (1)")
      await source.query("create table unexpected.products (id integer); insert into unexpected.products values (99)")

      const dump = spawnSync('docker', [
        'run', '--rm', '--pull=never', '--network=host', image,
        'pg_dump', '--format=custom', '--no-owner', '--no-privileges',
        '--schema=dpg_app', '--schema=dpg_v1', '--schema=dpg_control', '--schema=unexpected',
        '-d', databaseConnection(sourceName),
      ], { maxBuffer: 8 * 1024 * 1024 })
      expect(dump.status).toBe(0)
      await writeFile(archivePath, dump.stdout)
      await chmod(folder, 0o755)
      await chmod(archivePath, 0o644)

      const volume = ['--volume', `${folder}:/work:ro`, image]
      docker([...volume, 'pg_restore', '--schema-only', '--exit-on-error',
        '--no-owner', '--no-privileges', '-d', databaseConnection(targetName), '/work/synthetic.dump'])
      for (const table of CATALOGUE_RESTORE_ORDER) {
        docker([...volume, 'pg_restore', '--data-only', '--exit-on-error', '--no-owner',
          '--no-privileges', '--schema=dpg_app', '--strict-names', `--table=${table}`,
          '-d', databaseConnection(targetName), '/work/synthetic.dump'])
      }

      const expected = await catalogueSnapshot(source)
      const actual = await catalogueSnapshot(target)
      expect(actual.tables).toHaveLength(27)
      expect(actual.tables.every((table) => table.rowCount === 1)).toBe(true)
      expect(compareCatalogueManifests(expected, actual).violations).toEqual([])
      await expect(target.query(buildRehearsalTargetCheckSql())).resolves.toBeDefined()
      expect((await target.query('select count(*)::int as n from dpg_v1.staff_users')).rows[0].n).toBe(0)
      expect((await target.query('select count(*)::int as n from dpg_app.blog_posts')).rows[0].n).toBe(0)
      expect((await target.query('select count(*)::int as n from unexpected.products')).rows[0].n).toBe(0)

      const missing = spawnSync('docker', ['run', '--rm', '--pull=never', '--network=host',
        ...volume, 'pg_restore', '--data-only', '--exit-on-error', '--no-owner',
        '--no-privileges', '--schema=dpg_app', '--strict-names', '--table=missing_catalogue',
        '-d', databaseConnection(targetName), '/work/synthetic.dump'],
      { encoding: 'utf8' })
      expect(missing.status).not.toBe(0)

      await target.query('insert into dpg_app.blog_posts values (1)')
      await expect(target.query(buildRehearsalTargetCheckSql())).rejects.toThrow(/EXCLUDED_ROWS/)
      await target.query('delete from dpg_app.blog_posts')
      await target.query('insert into dpg_v1.staff_users values (1)')
      await expect(target.query(buildRehearsalTargetCheckSql())).rejects.toThrow(/EXCLUDED_ROWS/)
      await target.query('delete from dpg_v1.staff_users')
      await target.query('insert into dpg_app.product_families values (1)')
      await expect(target.query(buildRehearsalTargetCheckSql())).rejects.toThrow(/EXCLUDED_ROWS/)
      await target.query('delete from dpg_app.product_families')
      await target.query('insert into unexpected.private_rows values (1)')
      await expect(target.query(buildRehearsalTargetCheckSql())).rejects.toThrow(/EXCLUDED_ROWS/)
      await target.query('delete from unexpected.private_rows')
      await target.query('select lo_create(12345)')
      await expect(target.query(buildRehearsalTargetCheckSql())).rejects.toThrow(/LARGE_OBJECTS/)
      await target.query('select lo_unlink(12345)')
      await target.query("select setval('dpg_app.unused_seq', 42, false)")
      await expect(target.query(buildRehearsalTargetCheckSql())).rejects.toThrow(/EXCLUDED_SEQUENCE/)
      await target.query('select nextval(\'dpg_app.unused_seq\')')
      await expect(target.query(buildRehearsalTargetCheckSql())).rejects.toThrow(/EXCLUDED_SEQUENCE/)
    } finally {
      if (source) await source.end()
      if (target) await target.end()
      await admin.query(`drop database if exists ${sourceName} with (force)`)
      await admin.query(`drop database if exists ${targetName} with (force)`)
      await admin.end()
      await rm(folder, { recursive: true, force: true })
    }
  }, 120_000)
})
