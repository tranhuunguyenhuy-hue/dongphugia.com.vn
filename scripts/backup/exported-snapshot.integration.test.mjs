import { accessSync, constants, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawn, execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { promisify } from 'node:util'

import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const execFileAsync = promisify(execFile)
const databaseUrl = process.env.POSTGRES_SNAPSHOT_INTEGRATION_URL
const postgresImage = process.env.POSTGRES_SNAPSHOT_INTEGRATION_IMAGE
const integration = databaseUrl && postgresImage ? describe : describe.skip
const snapshotPattern = /[0-9A-Fa-f]+-[0-9A-Fa-f]+-[0-9]+/
const repoRoot = process.cwd()
const harness = `${repoRoot}/scripts/backup/exported-snapshot.integration-harness.sh`

function waitForFile(path, timeoutMs = 20_000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs
    const poll = () => {
      if (existsSync(path)) return resolve()
      if (Date.now() >= deadline) return reject(new Error(`Timed out waiting for ${path}`))
      setTimeout(poll, 50)
    }
    poll()
  })
}

function runHarness(mode) {
  const id = randomUUID()
  const workspace = `/dev/shm/leo540-snapshot-test-${id}`
  const stateDir = `/dev/shm/leo540-snapshot-state-${id}`
  const pidFile = `${stateDir}/keeper.pid`
  const appFile = `${stateDir}/application-name`
  const psqlWrapper = `${stateDir}/psql`
  mkdirSync(workspace, { recursive: true })
  mkdirSync(stateDir, { recursive: true })
  writeFileSync(psqlWrapper, `#!/usr/bin/env bash\nexec docker run --rm --network host --interactive --env PGAPPNAME --mount type=bind,source=/dev/shm,target=/dev/shm \"$POSTGRES_IMAGE\" psql \"$@\"\n`, { mode: 0o700 })

  const child = spawn('bash', [harness], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PSQL_BIN: psqlWrapper,
      POSTGRES_IMAGE: postgresImage,
      SNAPSHOT_TEST_DATABASE_URL: databaseUrl,
      SNAPSHOT_TEST_WORKSPACE: workspace,
      SNAPSHOT_TEST_PID_FILE: pidFile,
      SNAPSHOT_TEST_APP_FILE: appFile,
      SNAPSHOT_TEST_MODE: mode,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', chunk => { stdout += chunk })
  child.stderr.on('data', chunk => { stderr += chunk })
  const completed = new Promise(resolve => child.on('close', code => resolve({ code, stdout, stderr })))
  return { child, workspace, stateDir, pidFile, appFile, completed }
}

async function assertKeeperGone(run) {
  const keeperPid = Number(readFileSync(run.pidFile, 'utf8'))
  const applicationName = readFileSync(run.appFile, 'utf8')
  expect(() => process.kill(keeperPid, 0)).toThrow()
  const client = new Client({ connectionString: databaseUrl })
  await client.connect()
  const activity = await client.query('select count(*)::int as count from pg_stat_activity where application_name = $1', [applicationName])
  await client.end()
  expect(activity.rows[0].count).toBe(0)
  expect(existsSync(run.workspace)).toBe(false)
}

integration('PostgreSQL exported snapshot lifecycle', () => {
  beforeAll(async () => {
    accessSync('/dev/shm', constants.W_OK)
    const client = new Client({ connectionString: databaseUrl })
    await client.connect()
    await client.query('drop schema if exists snapshot_contract_test cascade')
    await client.query('create schema snapshot_contract_test')
    await client.query('create table snapshot_contract_test.items (id integer primary key, label text not null)')
    await client.query("insert into snapshot_contract_test.items values (1, 'before-one'), (2, 'before-two')")
    await client.end()
  }, 30_000)

  afterAll(async () => {
    const client = new Client({ connectionString: databaseUrl })
    await client.connect()
    await client.query('drop schema if exists snapshot_contract_test cascade')
    await client.end()
  })

  it('keeps manifest and pg_dump on the same pre-mutation view', async () => {
    const run = runHarness('hold')
    await waitForFile(`${run.workspace}/ready`)
    const snapshotId = readFileSync(`${run.workspace}/snapshot.id`, 'utf8').trim()
    expect(snapshotId).toMatch(/^([0-9A-Fa-f]+)-([0-9A-Fa-f]+)-([0-9]+)$/)

    const manifestClient = new Client({ connectionString: databaseUrl })
    await manifestClient.connect()
    await manifestClient.query('begin isolation level repeatable read read only')
    await manifestClient.query(`set transaction snapshot '${snapshotId}'`)
    const manifest = await manifestClient.query('select count(*)::int as count, string_agg(label, $1 order by id) as labels from snapshot_contract_test.items', [','])
    await manifestClient.query('commit')
    await manifestClient.end()

    const writer = new Client({ connectionString: databaseUrl })
    await writer.connect()
    await writer.query("insert into snapshot_contract_test.items values (3, 'after-export')")
    await writer.end()

    const dump = await execFileAsync('docker', [
      'run', '--rm', '--network', 'host',
      '--env', `DATABASE_URL=${databaseUrl}`,
      '--env', `SNAPSHOT_ID=${snapshotId}`,
      postgresImage,
      'sh', '-ceu',
      'pg_dump "$DATABASE_URL" --snapshot="$SNAPSHOT_ID" --data-only --table=snapshot_contract_test.items --column-inserts --no-owner --no-privileges',
    ], { maxBuffer: 2_000_000 })

    expect(manifest.rows[0]).toEqual({ count: 2, labels: 'before-one,before-two' })
    expect(dump.stdout).toContain('before-one')
    expect(dump.stdout).toContain('before-two')
    expect(dump.stdout).not.toContain('after-export')

    writeFileSync(`${run.workspace}/release`, '')
    const result = await run.completed
    expect(result.code).toBe(0)
    expect(`${result.stdout}${result.stderr}`).not.toMatch(snapshotPattern)
    await assertKeeperGone(run)
    rmSync(run.stateDir, { recursive: true, force: true })
  }, 60_000)

  for (const mode of ['manifest-failure', 'dump-failure']) {
    it(`rolls back, terminates, and redacts the keeper on ${mode}`, async () => {
      const run = runHarness(mode)
      const result = await run.completed
      expect(result.code).not.toBe(0)
      expect(`${result.stdout}${result.stderr}`).not.toMatch(snapshotPattern)
      await assertKeeperGone(run)
      rmSync(run.stateDir, { recursive: true, force: true })
    }, 60_000)
  }
})
