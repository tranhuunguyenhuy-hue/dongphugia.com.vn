import { spawnSync } from 'node:child_process'
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import pg from 'pg'
import { describe, expect, it } from 'vitest'

import {
  CATALOGUE_RESTORE_ORDER,
  CATALOGUE_TABLES,
  buildCatalogueSnapshotSql,
  buildRehearsalTargetCheckSql,
  compareCatalogueManifests,
} from './catalogue-restore-contract.mjs'

const databaseUrl = process.env.POSTGRES_SNAPSHOT_INTEGRATION_URL
const image = process.env.POSTGRES_SNAPSHOT_INTEGRATION_IMAGE
const runIntegration = Boolean(databaseUrl && image && process.platform === 'linux')
const runContainerStaging = Boolean(image && process.platform === 'linux')

function docker(args, options = {}) {
  const result = spawnSync('docker', ['run', '--rm', '--pull=never', '--network=host', ...args], {
    encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, ...options,
  })
  if (result.status !== 0) throw new Error(`synthetic_pg_command_failed:${result.status}`)
  return result.stdout
}

function dockerCommand(args, options = {}) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 30_000, ...options,
  })
  if (result.status !== 0) throw new Error('synthetic_container_command_failed')
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

describe.skipIf(!runContainerStaging)('read-only recovery container staging', () => {
  it('streams synthetic archive, tools, and recipient input into network-none tmpfs', async () => {
    const suffix = process.pid + '_' + Date.now()
    const containerName = 'c-stage-' + suffix
    const stagingHelper = join(process.cwd(), 'scripts/backup/c-actions-container-staging.sh')
    const folder = await mkdtemp(join(tmpdir(), 'c-actions-staging-synthetic-'))
    const archivePath = join(folder, 'synthetic.dump.age')
    const agePath = join(folder, 'synthetic-age')
    const ageKeygenPath = join(folder, 'synthetic-age-keygen')
    const syntheticCiphertext = 'synthetic-ciphertext-only'
    const syntheticIdentity = 'synthetic-identity-only'
    const syntheticRecipient = 'synthetic-recipient-only'
    const ageScript = '#!/bin/sh\nset -eu\ntest "$1" = --version\nprintf "%s\\n" synthetic-age-tool-ok\n'
    const ageKeygenScript = [
      '#!/bin/sh',
      'set -eu',
      'test "$1" = -y',
      'test "$(cat "$2")" = ' + syntheticIdentity,
      'printf "%s\\n" ' + syntheticRecipient,
      '',
    ].join('\n')
    let started = false

    try {
      await writeFile(archivePath, syntheticCiphertext)
      await writeFile(agePath, ageScript)
      await writeFile(ageKeygenPath, ageKeygenScript)

      const start = spawnSync('docker', [
        'run', '--detach', '--rm', '--pull=never', '--name', containerName,
        '--log-driver=none', '--network', 'none', '--read-only', '--pids-limit', '64',
        '--user', '999:999', '--memory', '512m', '--memory-swap', '512m',
        '--tmpfs', '/var/lib/postgresql/data:rw,nosuid,nodev,noexec,size=8m,uid=999,gid=999,mode=0700',
        '--tmpfs', '/recovery-data:rw,nosuid,nodev,noexec,size=8m,uid=999,gid=999,mode=0700',
        '--tmpfs', '/recovery-tools:rw,nosuid,nodev,exec,size=8m,uid=999,gid=999,mode=0700',
        '--entrypoint', 'sh', image, '-c', 'while :; do sleep 60; done',
      ], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 30_000 })
      started = start.status === 0
      expect(start.status).toBe(0)

      expect(dockerCommand(['inspect', '--format', '{{.HostConfig.ReadonlyRootfs}}', containerName]).trim()).toBe('true')
      expect(dockerCommand(['inspect', '--format', '{{.HostConfig.NetworkMode}}', containerName]).trim()).toBe('none')
      expect(dockerCommand(['inspect', '--format', '{{.HostConfig.LogConfig.Type}}', containerName]).trim()).toBe('none')
      expect(dockerCommand(['inspect', '--format', '{{.Config.User}}', containerName]).trim()).toBe('999:999')
      expect(dockerCommand(['inspect', '--format', '{{.HostConfig.Memory}}', containerName]).trim()).toBe('536870912')
      expect(dockerCommand(['inspect', '--format', '{{.HostConfig.MemorySwap}}', containerName]).trim()).toBe('536870912')
      const tmpfsConfig = JSON.parse(dockerCommand(['inspect', '--format', '{{json .HostConfig.Tmpfs}}', containerName]))
      expect(Object.keys(tmpfsConfig).sort()).toEqual([
        '/recovery-data', '/recovery-tools', '/var/lib/postgresql/data',
      ])

      const stage = (source, destination, owner, mode) => {
        const result = spawnSync('bash', [
          '-c', 'source "$1"; stage_container_tmpfs_file "$2" "$3" "$4" "$5" "$6"',
          'bash', stagingHelper, containerName, source, destination, owner, mode,
        ], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 30_000 })
        expect(result.status).toBe(0)
      }
      stage(archivePath, '/recovery-data/archive.age', 'postgres:postgres', '0400')
      stage(agePath, '/recovery-tools/age', 'postgres:postgres', '0555')
      stage(ageKeygenPath, '/recovery-tools/age-keygen', 'postgres:postgres', '0555')

      expect(dockerCommand(['exec', '--user', 'postgres', containerName, 'cat', '/recovery-data/archive.age'])).toBe(syntheticCiphertext)
      expect(dockerCommand(['exec', '--user', 'postgres', containerName, 'stat', '-c', '%a %U:%G', '/recovery-data/archive.age']).trim()).toBe('400 postgres:postgres')
      expect(dockerCommand(['exec', '--user', 'postgres', containerName, '/recovery-tools/age', '--version']).trim()).toBe('synthetic-age-tool-ok')
      expect(dockerCommand(['exec', '--user', 'postgres', containerName, 'stat', '-c', '%a %U:%G', '/recovery-tools/age-keygen']).trim()).toBe('555 postgres:postgres')

      const handoff = spawnSync('bash', [
        '-c', 'source "$1"; verify_container_age_identity_from_stdin "$2" "$3"',
        'bash', stagingHelper, containerName, syntheticRecipient,
      ], { input: syntheticIdentity + '\n', encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 30_000 })
      expect(handoff.status).toBe(0)
      expect(dockerCommand(['exec', '--user', 'postgres', containerName, 'stat', '-c', '%a %U:%G', '/recovery-data/age-identity']).trim()).toBe('600 postgres:postgres')
    } finally {
      if (started) spawnSync('docker', ['rm', '--force', containerName], { encoding: 'utf8', timeout: 30_000 })
      await rm(folder, { recursive: true, force: true })
    }
  }, 120_000)
})

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

      // Exercise the actual snapshot SQL used by the protected recovery workflow.
      const snapshotResults = await source.query(buildCatalogueSnapshotSql())
      const snapshotRow = snapshotResults.flatMap((result) => result.rows ?? [])
        .find((row) => typeof row.jsonb_build_object === 'string')
      expect(snapshotRow).toBeDefined()
      const generatedSnapshot = JSON.parse(snapshotRow.jsonb_build_object)
      expect(generatedSnapshot.tables).toHaveLength(27)
      expect(generatedSnapshot.excludedRows).toEqual(['blog_posts'])

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
