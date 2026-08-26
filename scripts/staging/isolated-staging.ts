import { createHash, randomBytes } from 'node:crypto'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { compare } from '../db/postgres-schema-verify'

const repoRoot = process.cwd()
const imageName = 'dpg-foundation-isolated-staging:local'
const scopeLabel = 'com.dongphugia.deployment-foundation'
const scopeValue = 'isolated-staging-v1'
const postgresImage = 'postgres:16.10-bookworm@sha256:38471f330eb885e04de130b768d6db4e10469e2311879c7e5c699f6d2d8a1c74'
const names = {
  network: 'dpg-isolated-staging-backend',
  volume: 'dpg-isolated-staging-volume',
  postgres: 'dpg-isolated-staging-postgres',
  app: 'dpg-isolated-staging-app',
}

type ResourceKind = 'container' | 'volume' | 'network'
type Resource = { name: string; kind: ResourceKind }
type SchemaManifest = { formatVersion: number; objects: Array<{ kind: string; identity: string; properties: unknown }> }

function fail(message: string): never {
  throw new Error(`ISOLATED_STAGING_FAILED: ${message}`)
}

function docker(args: string[], options: { input?: string; allowFailure?: boolean } = {}) {
  try {
    return execFileSync('docker', args, {
      cwd: repoRoot,
      input: options.input,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
  } catch (error) {
    if (options.allowFailure) return ''
    const status = error && typeof error === 'object' && 'status' in error ? String(error.status) : 'unknown'
    const safeArgs = args.filter((arg) => !arg.includes('PASSWORD=') && !arg.includes('postgresql://')).slice(0, 5).join(' ')
    fail(`docker operation failed (${status}): docker ${safeArgs}`)
  }
}

function resource(name: string, kind: ResourceKind): Resource { return { name, kind } }
const resources: Resource[] = [
  resource(names.app, 'container'),
  resource(names.postgres, 'container'),
  resource(names.volume, 'volume'),
  resource(names.network, 'network'),
]

function inspectResource(item: Resource): Record<string, unknown> | undefined {
  const output = docker(['inspect', item.name], { allowFailure: true })
  if (!output) return undefined
  try {
    const parsed = JSON.parse(output) as Array<Record<string, unknown>>
    return parsed[0]
  } catch {
    fail(`could not inspect ${item.kind} identity`)
  }
}

function labelsOf(item: Resource, inspected: Record<string, unknown>) {
  const config = inspected.Config as Record<string, unknown> | undefined
  return (config?.Labels ?? inspected.Labels ?? {}) as Record<string, string | undefined>
}

function assertOwnedOrAbsent(item: Resource) {
  const inspected = inspectResource(item)
  if (!inspected) return
  const labels = labelsOf(item, inspected)
  if (labels[scopeLabel] !== scopeValue) fail(`${item.kind} ${item.name} exists without the foundation ownership marker`)
}

function removeOwned(item: Resource) {
  const inspected = inspectResource(item)
  if (!inspected) return
  const labels = labelsOf(item, inspected)
  if (labels[scopeLabel] !== scopeValue) fail(`refusing to remove unowned ${item.kind} ${item.name}`)
  if (item.kind === 'container') docker(['rm', '--force', item.name])
  if (item.kind === 'volume') docker(['volume', 'rm', item.name])
  if (item.kind === 'network') docker(['network', 'rm', item.name])
}

function cleanupResources() {
  for (const item of resources) removeOwned(item)
}

function gitOutput(args: string[]) {
  try {
    return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  } catch { return '' }
}

function preflight(allowDirty: boolean) {
  const branch = gitOutput(['branch', '--show-current'])
  const commit = gitOutput(['rev-parse', 'HEAD'])
  if (!branch || !/^[0-9a-f]{40}$/.test(commit)) fail('candidate branch/commit is unavailable')
  const dirty = gitOutput(['status', '--porcelain'])
  if (dirty && !allowDirty) fail('candidate worktree is dirty; pass --allow-dirty only for local non-promotable proof')
  if (process.env.CI === 'true' && branch !== 'main') fail('CI Staging candidate must come from protected main')
  return { branch, commit, dirty: Boolean(dirty) }
}

function randomSecret() { return randomBytes(24).toString('hex') }

function parsePort(output: string) {
  const match = output.match(/127\.0\.0\.1:(\d+)/)
  if (!match) fail('Docker did not publish a loopback port')
  return Number(match[1])
}

function waitForPostgres(adminPassword: string) {
  execFileSync('sleep', ['5'], { stdio: ['ignore', 'ignore', 'ignore'] })
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const value = docker([
      'exec', '-e', `PGPASSWORD=${adminPassword}`, names.postgres,
      'psql', '-X', '-At', '-U', 'dpg_staging_admin', '-d', 'dpg_isolated_staging',
      '-c', 'SELECT 1',
    ], { allowFailure: true })
    if (value === '1') return
    execFileSync('sleep', ['1'], { stdio: ['ignore', 'ignore', 'ignore'] })
  }
  fail('PostgreSQL did not reach a stable post-init server')
}

function runPsql(input: string, user: string, password: string) {
  docker([
    'exec', '-i', '-e', `PGPASSWORD=${password}`, names.postgres,
    'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', user, '-d', 'dpg_isolated_staging',
  ], { input })
}

function queryPsql(input: string, user: string, password: string) {
  return docker([
    'exec', '-i', '-e', `PGPASSWORD=${password}`, names.postgres,
    'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', user, '-d', 'dpg_isolated_staging', '-At',
  ], { input })
}

function startTarget() {
  for (const item of resources) assertOwnedOrAbsent(item)
  // A loopback-only published port is required for the host-side migration and smoke
  // checks. The bridge is still a dedicated, label-owned network and never shared with
  // Production; application-to-DB traffic uses the private `postgres` alias.
  docker(['network', 'create', '--label', `${scopeLabel}=${scopeValue}`, names.network])
  docker(['volume', 'create', '--label', `${scopeLabel}=${scopeValue}`, names.volume])
  const adminPassword = randomSecret()
  const migratorPassword = randomSecret()
  const appPassword = randomSecret()
  docker([
    'run', '--detach', '--name', names.postgres,
    '--label', `${scopeLabel}=${scopeValue}`,
    '--network', names.network, '--network-alias', 'postgres',
    '--mount', `type=volume,source=${names.volume},target=/var/lib/postgresql/data`,
    '--publish', '127.0.0.1:0:5432',
    '--env', 'POSTGRES_DB=dpg_isolated_staging',
    '--env', 'POSTGRES_USER=dpg_staging_admin',
    '--env', `POSTGRES_PASSWORD=${adminPassword}`,
    postgresImage,
  ])
  waitForPostgres(adminPassword)
  const init = readFileSyncLocal(path.join(repoRoot, 'scripts/staging/postgres-init.sql'))
    .replaceAll("PASSWORD :'migrator_password'", `PASSWORD '${migratorPassword}'`)
    .replaceAll("PASSWORD :'app_password'", `PASSWORD '${appPassword}'`)
  runPsql(init, 'dpg_staging_admin', adminPassword)
  const port = parsePort(docker(['port', names.postgres, '5432/tcp']))
  return {
    adminPassword,
    migratorPassword,
    appPassword,
    migrationUrl: `postgresql://dpg_staging_migrator:${migratorPassword}@127.0.0.1:${port}/dpg_isolated_staging`,
  }
}

function readFileSyncLocal(file: string) {
  try {
    return execFileSync('sed', ['-n', '1,240p', file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch { fail('staging bootstrap artifact is missing') }
}

function cliJson(args: string[], env: Record<string, string>) {
  try {
    const output = execFileSync('npx', ['tsx', ...args], {
      cwd: repoRoot,
      env: { ...process.env, ...env },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const line = output.trim().split(/\r?\n/).reverse().find((value) => value.startsWith('{'))
    if (!line) fail('command returned no sanitized JSON evidence')
    return JSON.parse(line) as Record<string, unknown>
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('ISOLATED_STAGING_FAILED:')) throw error
    fail(`candidate command failed: ${path.basename(args[0] ?? 'unknown')}`)
  }
}

function migrationEnv(target: ReturnType<typeof startTarget>) {
  return { ISOLATED_STAGING_POSTGRES: '1', POSTGRES_MIGRATION_URL: target.migrationUrl }
}

function runMigrations(target: ReturnType<typeof startTarget>, origin = 'db/postgres-migrations', manifest = 'db/postgres-migrations/manifest.json', migration?: string) {
  const args = [
    'scripts/db/postgres-migration-runner.ts',
    '--target', 'isolated-staging', '--origin', origin, '--manifest', manifest,
    '--source-commit', gitOutput(['rev-parse', 'HEAD']),
  ]
  if (migration) args.push('--migration', migration)
  return cliJson(args, migrationEnv(target))
}

function grantRuntime(target: ReturnType<typeof startTarget>) {
  runPsql(readFileSyncLocal(path.join(repoRoot, 'scripts/staging/runtime-grants.sql')), 'dpg_staging_migrator', target.migratorPassword)
}

function schemaManifest(target: ReturnType<typeof startTarget>, out: string) {
  return cliJson(['scripts/db/postgres-schema-manifest.ts', '--target', 'isolated-staging', '--out', out], migrationEnv(target))
}

function verifySchema(target: ReturnType<typeof startTarget>, expected = 'db/postgres-migrations/schema-manifest.json', allowlist = 'db/postgres-migrations/schema-drift-allowlist.json') {
  return cliJson(['scripts/db/postgres-schema-verify.ts', '--target', 'isolated-staging', '--expected', expected, '--allowlist', allowlist], migrationEnv(target))
}

function imageInfo(image: string) {
  const output = docker(['image', 'inspect', '--format', '{{.Id}}|{{.Architecture}}|{{index .Config.Labels "org.opencontainers.image.revision"}}', image])
  const [id, architecture, revision] = output.split('|')
  if (!id || architecture !== 'arm64') fail('candidate image is not ARM64')
  if (!/^sha256:[0-9a-f]{64}$/.test(id)) fail('candidate image digest is not immutable')
  return { id, architecture, revision: revision || null }
}

function prepareImage(commit: string, image?: string, build = false) {
  if (image && !build) {
    if (!image.includes('@sha256:') && !image.startsWith('dpg-foundation-isolated-staging:')) {
      fail('candidate image must use an immutable digest')
    }
    if (image.includes('@sha256:')) docker(['pull', image])
    const info = imageInfo(image)
    if (info.revision && info.revision !== commit) fail('candidate image revision does not match the checkout')
    return { image, ...info }
  }
  docker([
    'build', '--platform', 'linux/arm64', '--tag', imageName,
    '--label', `org.opencontainers.image.revision=${commit}`,
    '--build-arg', 'DEPLOY_TARGET=staging',
    '--build-arg', 'NEXT_PUBLIC_SITE_URL=https://isolated-staging.invalid',
    '--build-arg', 'BUNNY_CDN_HOSTNAME=cdn.dongphugia.com.vn',
    '--build-arg', 'PUBLISHING_BUNNY_CDN_HOSTNAME=media.dongphugia.vn',
    '.',
  ])
  return { image: imageName, ...imageInfo(imageName) }
}

function deployApp(target: ReturnType<typeof startTarget>, image: string) {
  const dbUrl = `postgresql://dpg_staging_app:${target.appPassword}@postgres:5432/dpg_isolated_staging`
  docker([
    'run', '--detach', '--name', names.app,
    '--label', `${scopeLabel}=${scopeValue}`,
    '--network', names.network,
    '--publish', '127.0.0.1::3000',
    '--env', 'NODE_ENV=production', '--env', 'DEPLOY_TARGET=staging', '--env', 'RUNTIME_ROLE=staging',
    '--env', 'NEXT_PUBLIC_SITE_URL=https://isolated-staging.invalid',
    '--env', `DATABASE_URL=${dbUrl}`, '--env', `DIRECT_URL=${dbUrl}`, '--env', `PUBLISHING_DATABASE_URL=${dbUrl}`,
    '--env', 'EXPECTED_DATABASE_IDENTITY=dongphugia:isolated-staging:v1',
    '--env', 'EXPECTED_PUBLISHING_DATABASE_IDENTITY=dongphugia:isolated-staging:v1',
    '--env', 'WRITE_FREEZE_MODE=true', '--env', 'PRODUCTION_INDEXING_ENABLED=false',
    '--env', 'PUBLISHING_ENVIRONMENT=staging',
    image,
  ])
  const env = JSON.parse(docker(['inspect', '--format', '{{json .Config.Env}}', names.app])) as string[]
  for (const key of ['DATABASE_URL=', 'DIRECT_URL=', 'PUBLISHING_DATABASE_URL=']) {
    const value = env.find((entry) => entry.startsWith(key))
    if (value !== `${key}${dbUrl}`) fail(`application ${key.slice(0, -1)} does not point to isolated Staging`)
  }
  const port = parsePort(docker(['port', names.app, '3000/tcp']))
  return { port }
}

async function smoke(port: number) {
  const request = async (pathname: string) => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}${pathname}`, { signal: AbortSignal.timeout(3_000) })
        const body = await response.text()
        if (response.status >= 500) throw new Error('server error')
        return { status: response.status, body }
      } catch {
        if (attempt === 59) fail(`runtime smoke did not become healthy: ${pathname}`)
        await new Promise((resolve) => setTimeout(resolve, 1_000))
      }
    }
    fail(`runtime smoke failed: ${pathname}`)
  }
  const health = await request('/api/health')
  if (health.status !== 200 || JSON.parse(health.body).ok !== true) fail('health smoke failed')
  const homepage = await request('/')
  if (homepage.status !== 200) fail('homepage smoke failed')
  const robots = await request('/robots.txt')
  if (robots.status !== 200 || !robots.body.includes('Disallow: /')) fail('staging noindex smoke failed')
  return { health: 'PASS', homepage: 'PASS', noindex: 'PASS' }
}

async function prepareProofOrigin(fixtureFile = 'pipeline-probe.sql', migrationName = 'disposable-pipeline-probe') {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'dpg-pipeline-proof-'))
  const tempOrigin = path.join(tempRoot, 'origin')
  await cp(path.join(repoRoot, 'db/postgres-migrations'), tempOrigin, { recursive: true })
  const fixturePath = `0001_${fixtureFile}`
  await cp(path.join(repoRoot, 'scripts/staging/fixtures', fixtureFile), path.join(tempOrigin, fixturePath))
  const manifestPath = path.join(tempOrigin, 'manifest.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as { migrations: unknown[] }
  manifest.migrations = [{ name: migrationName, path: fixturePath }]
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  const checksumFiles = [
    ...['0000_baseline_v1/extensions.sql', '0000_baseline_v1/core.sql', '0000_baseline_v1/catalog-integrity.sql', '0000_baseline_v1/publishing-runtime.sql'],
    'schema-manifest.json', 'schema-drift-allowlist.json', fixturePath,
  ]
  const checksums = []
  for (const file of checksumFiles) checksums.push(`${createHash('sha256').update(await readFile(path.join(tempOrigin, file))).digest('hex')}  ${file}`)
  await writeFile(path.join(tempOrigin, 'checksums.sha256'), `${checksums.join('\n')}\n`, 'utf8')
  return { tempRoot, origin: tempOrigin, manifest: manifestPath }
}

function expectMigrationRollback(target: ReturnType<typeof startTarget>, failureOrigin: { origin: string; manifest: string }) {
  const args = [
    'scripts/db/postgres-migration-runner.ts',
    '--target', 'isolated-staging', '--origin', failureOrigin.origin, '--manifest', failureOrigin.manifest,
    '--source-commit', gitOutput(['rev-parse', 'HEAD']),
  ]
  try {
    execFileSync('npx', ['tsx', ...args], {
      cwd: repoRoot,
      env: { ...process.env, ...migrationEnv(target) },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    fail('intentional migration failure unexpectedly succeeded')
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('ISOLATED_STAGING_FAILED:')) throw error
    const result = error as { stdout?: string; stderr?: string }
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
    if (!output.includes('postgresql_error:22012')) {
      const observed = output.match(/MIGRATION_RUNNER_FAILED:[^\r\n]*/)?.[0] ?? 'no-sanitized-runner-error'
      fail(`migration failure was not reported with sanitized SQLSTATE (${observed})`)
    }
  }
  const tableCount = queryPsql(
    "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='deployment_pipeline_probe_failure';",
    'dpg_staging_migrator',
    target.migratorPassword,
  )
  const ledgerCount = queryPsql(
    "SELECT count(*) FROM deployment_meta.migration_ledger WHERE migration_id='migration:disposable-pipeline-failure';",
    'dpg_staging_migrator',
    target.migratorPassword,
  )
  if (tableCount !== '0' || ledgerCount !== '0') fail('failed migration left schema or ledger residue')
}

async function replayOnce(targetImage: { image: string }, commit: string) {
  let target: ReturnType<typeof startTarget> | undefined
  try {
    target = startTarget()
    runMigrations(target)
    grantRuntime(target)
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'dpg-replay-manifest-'))
    try {
      const actualPath = path.join(tempRoot, 'actual.json')
      schemaManifest(target, actualPath)
      verifySchema(target)
      return { hash: createHash('sha256').update(await readFile(actualPath)).digest('hex'), image: targetImage.image, commit }
    } finally {
      await rm(tempRoot, { recursive: true, force: true })
    }
  } finally {
    cleanupResources()
  }
}

async function proof(options: { image?: string; build: boolean; allowDirty: boolean }) {
  const candidate = preflight(options.allowDirty)
  const image = prepareImage(candidate.commit, options.image, options.build)
  const replay1 = await replayOnce(image, candidate.commit)
  const replay2 = await replayOnce(image, candidate.commit)
  if (replay1.hash !== replay2.hash) fail('fresh Baseline v1 replay hashes differ')

  const failureOrigin = await prepareProofOrigin('pipeline-probe-failure.sql', 'disposable-pipeline-failure')
  try {
    try {
      const target = startTarget()
      runMigrations(target)
      grantRuntime(target)
      expectMigrationRollback(target, failureOrigin)
    } finally {
      cleanupResources()
    }
  } finally {
    await rm(failureOrigin.tempRoot, { recursive: true, force: true })
  }

  const proofOrigin = await prepareProofOrigin()
  try {
    try {
      const target = startTarget()
      runMigrations(target, proofOrigin.origin, proofOrigin.manifest)
      grantRuntime(target)
      const actualPath = path.join(proofOrigin.tempRoot, 'actual.json')
      schemaManifest(target, actualPath)
      const expected = JSON.parse(await readFile(path.join(repoRoot, 'db/postgres-migrations/schema-manifest.json'), 'utf8')) as SchemaManifest
      const actual = JSON.parse(await readFile(actualPath, 'utf8')) as SchemaManifest
      const drift = compare(expected, actual)
      if (drift.length === 0) fail('disposable candidate migration produced no observable schema change')
      const allowlistPath = path.join(proofOrigin.tempRoot, 'proof-allowlist.json')
      await writeFile(allowlistPath, JSON.stringify({
        formatVersion: 1,
        entries: drift.map((entry) => ({ ...entry, reason: 'disposable pipeline probe only', owner: 'Deployment Foundation', reviewBy: '2026-08-26' })),
      }, null, 2) + '\n', 'utf8')
      verifySchema(target, path.join(repoRoot, 'db/postgres-migrations/schema-manifest.json'), allowlistPath)
      const runtime = deployApp(target, image.image)
      const smokes = await smoke(runtime.port)
      return {
        status: 'PASS',
        branch: candidate.branch,
        commit: candidate.commit,
        imageDigest: image.id,
        postgresImage,
        baselineReplayHash: replay1.hash,
        disposableCandidate: '0001_pipeline_probe.sql (non-promotable; isolated proof only)',
        migrationFailureRollback: 'PASS: SQLSTATE sanitized and transaction/ledger residue absent',
        schemaDriftAllowlisted: drift.length,
        targetFingerprint: 'sanitized-and-attested-at-runtime',
        smokes,
        rollback: 'PASS: exact labeled database/network/volume recreated and cleaned after proof',
        production: 'NOT EXECUTED / REQUIRES SEPARATE PM APPROVAL',
      }
    } finally {
      cleanupResources()
    }
  } finally {
    await rm(proofOrigin.tempRoot, { recursive: true, force: true })
  }
}

async function provision(options: { image?: string; build: boolean; allowDirty: boolean }) {
  const candidate = preflight(options.allowDirty)
  const image = options.image || options.build ? prepareImage(candidate.commit, options.image, options.build) : undefined
  try {
    const target = startTarget()
    runMigrations(target)
    grantRuntime(target)
    const schema = verifySchema(target)
    const runtime = image ? deployApp(target, image.image) : undefined
    const smokes = runtime ? await smoke(runtime.port) : undefined
    console.log(JSON.stringify({ status: 'PASS', branch: candidate.branch, commit: candidate.commit, imageDigest: image?.id, schema, smokes, rollback: 'run npm run staging:isolated -- reset; recreate/replay is the only rollback', production: 'NOT EXECUTED' }))
  } catch (error) {
    cleanupResources()
    throw error
  }
}

async function main() {
  const argv = process.argv.slice(2)
  const command = argv[0] ?? 'proof'
  const imageIndex = argv.indexOf('--image')
  const image = imageIndex === -1 ? undefined : argv[imageIndex + 1]
  const build = argv.includes('--build')
  const allowDirty = argv.includes('--allow-dirty')
  if (command === 'reset' || command === 'down') {
    for (const item of resources) assertOwnedOrAbsent(item)
    cleanupResources()
    console.log(JSON.stringify({ status: 'PASS', action: 'reset', production: 'NOT TOUCHED' }))
    return
  }
  if (command === 'proof') {
    console.log(JSON.stringify(await proof({ image, build, allowDirty })))
    return
  }
  if (command === 'provision') {
    await provision({ image, build, allowDirty })
    return
  }
  fail(`unknown command: ${command}`)
}

const isDirectExecution = process.argv[1]
  ? path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
  : false
if (isDirectExecution) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message.split('\n')[0] : 'ISOLATED_STAGING_FAILED: unknown')
    process.exitCode = 1
  })
}
