import { createHash } from 'node:crypto'
import { lstat, readFile, readdir, realpath } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'
import {
  attestTarget,
  configureMigrationSession,
  parseTargetConnection,
  sanitizeDatabaseError,
  type PostgresTarget,
} from './postgres-target'

type Artifact = { name: string; path: string }
type Manifest = {
  formatVersion: 2
  origin: 'postgresql'
  baseline: 'v1'
  postgresImage: string
  postgresVersion: string
  checksumFile: 'checksums.sha256'
  schemaManifest: string
  driftAllowlist: string
  layers: Artifact[]
  migrations: Artifact[]
}

type RunnerArgs = {
  target: PostgresTarget
  origin: string
  manifest: string
  migration?: string
  validateOnly: boolean
  baselineOnly: boolean
  skipBaseline: boolean
  sourceCommit?: string
}

type Validated = {
  args: RunnerArgs
  originPath: string
  manifest: Manifest
  files: Map<string, Buffer>
  checksums: Map<string, string>
}

const expectedLayerNames = ['extensions', 'core', 'catalog-integrity', 'publishing-runtime']
const expectedPostgresImage = 'postgres:16.10-bookworm@sha256:38471f330eb885e04de130b768d6db4e10469e2311879c7e5c699f6d2d8a1c74'
const sqlControlStatement = /(?:^|\n)\s*(?:COMMIT|ROLLBACK|START\s+TRANSACTION)\s*;/i

function fail(message: string): never {
  throw new Error(`MIGRATION_RUNNER_FAILED: ${message}`)
}

function parseArgs(argv: string[]): RunnerArgs {
  const values = new Map<string, string>()
  let validateOnly = false
  let baselineOnly = false
  let skipBaseline = false
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--validate-only') {
      validateOnly = true
      continue
    }
    if (arg === '--baseline-only') {
      baselineOnly = true
      continue
    }
    if (arg === '--skip-baseline') {
      skipBaseline = true
      continue
    }
    if (!arg.startsWith('--') || !argv[index + 1] || argv[index + 1].startsWith('--')) {
      fail(`invalid argument ${arg}`)
    }
    values.set(arg.slice(2), argv[index + 1])
    index += 1
  }

  const target = values.get('target') as PostgresTarget | undefined
  const origin = values.get('origin')
  const manifest = values.get('manifest')
  if (target !== 'disposable' && target !== 'isolated-staging') fail('target must be disposable or isolated-staging')
  if (!origin || !manifest) fail('origin and manifest are required')
  if (skipBaseline && !values.get('migration')) fail('--skip-baseline requires --migration')

  return {
    target,
    origin,
    manifest,
    migration: values.get('migration'),
    validateOnly,
    baselineOnly,
    skipBaseline,
    sourceCommit: values.get('source-commit'),
  }
}

function normalizeRelativePath(value: string) {
  const normalized = value.replaceAll('\\', '/')
  if (!normalized || path.posix.isAbsolute(normalized) || normalized.split('/').includes('..')) {
    fail(`path escapes origin: ${value}`)
  }
  return normalized
}

async function collectFiles(root: string, relativeRoot = ''): Promise<string[]> {
  const entries = await readdir(path.join(root, relativeRoot), { withFileTypes: true })
  const result: string[] = []
  for (const entry of entries) {
    const relative = path.posix.join(relativeRoot, entry.name)
    const absolute = path.join(root, relative)
    const info = await lstat(absolute)
    if (info.isSymbolicLink()) fail(`origin contains a symlink: ${relative}`)
    if (entry.isDirectory()) result.push(...await collectFiles(root, relative))
    else if (entry.isFile()) result.push(relative)
    else fail(`origin contains an unsupported file type: ${relative}`)
  }
  return result.sort()
}

function parseChecksums(content: string) {
  const result = new Map<string, string>()
  for (const line of content.split(/\r?\n/).map((value) => value.trim()).filter(Boolean)) {
    const match = line.match(/^([a-f0-9]{64})\s+[* ]?(.+)$/i)
    if (!match) fail('checksum file contains an invalid line')
    const relative = normalizeRelativePath(match[2])
    if (result.has(relative)) fail(`checksum file contains a duplicate path: ${relative}`)
    result.set(relative, match[1].toLowerCase())
  }
  if (result.size === 0) fail('checksum file is empty')
  return result
}

async function readAndValidateInputs(args: RunnerArgs): Promise<Validated> {
  const cwd = process.cwd()
  const originPath = await realpath(path.resolve(cwd, args.origin)).catch(() => fail('origin directory is missing'))
  const originSegments = originPath.split(path.sep)
  if (originSegments.includes('prisma') && originSegments[originSegments.indexOf('prisma') + 1] === 'migrations') {
    fail('SQLite-origin prisma/migrations path is forbidden')
  }
  const allOriginFiles = await collectFiles(originPath)
  if (allOriginFiles.some((file) => path.basename(file) === 'migration_lock.toml')) {
    fail('SQLite migration_lock.toml is forbidden in origin')
  }

  const manifestPath = await realpath(path.resolve(cwd, args.manifest)).catch(() => fail('manifest is missing'))
  const manifestRelative = path.relative(originPath, manifestPath)
  if (!manifestRelative || manifestRelative.startsWith('..') || path.isAbsolute(manifestRelative)) {
    fail('manifest must live inside the PostgreSQL origin')
  }
  let manifest: Manifest
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest
  } catch {
    fail('manifest is missing or invalid JSON')
  }
  if (
    manifest.formatVersion !== 2
    || manifest.origin !== 'postgresql'
    || manifest.baseline !== 'v1'
    || manifest.postgresVersion !== '16.10'
    || manifest.postgresImage !== expectedPostgresImage
    || manifest.checksumFile !== 'checksums.sha256'
  ) {
    fail('manifest is not the approved PostgreSQL Baseline v1 contract')
  }
  if (!Array.isArray(manifest.layers) || manifest.layers.length !== expectedLayerNames.length) fail('manifest baseline layers are incomplete')
  if (manifest.layers.map((layer) => layer.name).join('|') !== expectedLayerNames.join('|')) fail('manifest baseline layer order is invalid')
  if (!Array.isArray(manifest.migrations)) fail('manifest migrations must be an array')
  if (!manifest.schemaManifest || !manifest.driftAllowlist) fail('manifest schema/allowlist paths are required')

  const declared = [
    ...manifest.layers.map((layer) => normalizeRelativePath(layer.path)),
    ...manifest.migrations.map((migration) => normalizeRelativePath(migration.path)),
    normalizeRelativePath(manifest.schemaManifest),
    normalizeRelativePath(manifest.driftAllowlist),
  ]
  if (new Set(declared).size !== declared.length) fail('manifest declares duplicate artifacts')
  const allowedOriginFiles = new Set([...declared, 'manifest.json', manifest.checksumFile])
  for (const file of allOriginFiles) if (!allowedOriginFiles.has(file)) fail(`origin contains an unlisted artifact: ${file}`)
  for (const file of allowedOriginFiles) if (!allOriginFiles.includes(file)) fail(`manifest declares a missing artifact: ${file}`)

  const checksumContent = await readFile(path.join(originPath, manifest.checksumFile), 'utf8').catch(() => fail('checksum file is missing'))
  const checksums = parseChecksums(checksumContent)
  if (checksums.size !== declared.length || declared.some((file) => !checksums.has(file))) {
    fail('checksum file does not exactly cover declared artifacts')
  }
  for (const file of checksums.keys()) if (!declared.includes(file)) fail(`checksum file contains an unlisted artifact: ${file}`)

  const files = new Map<string, Buffer>()
  for (const file of declared) {
    const bytes = await readFile(path.join(originPath, file)).catch(() => fail(`declared artifact is missing: ${file}`))
    const digest = createHash('sha256').update(bytes).digest('hex')
    if (checksums.get(file) !== digest) fail(`checksum mismatch: ${file}`)
    files.set(file, bytes)
  }
  for (const file of [...manifest.layers, ...manifest.migrations].map((item) => normalizeRelativePath(item.path))) {
    const sql = files.get(file)?.toString('utf8')
    if (!sql) fail(`SQL artifact is empty: ${file}`)
    if (sqlControlStatement.test(sql)) fail(`SQL artifact contains transaction control: ${file}`)
  }

  const schema = await readFile(path.join(cwd, 'prisma/schema.prisma'), 'utf8').catch(() => fail('Prisma schema is missing'))
  const datasource = schema.match(/datasource\s+db\s*\{([\s\S]*?)\}/m)?.[1] ?? ''
  if (!/provider\s*=\s*"postgresql"/.test(datasource)) fail('Prisma datasource provider is not PostgreSQL')
  parseTargetConnection(args.target, process.env.POSTGRES_MIGRATION_URL)
  return { args, originPath, manifest, files, checksums }
}

async function ensureLedger(client: Client) {
  await client.query(`
    CREATE SCHEMA IF NOT EXISTS deployment_meta;
    CREATE TABLE IF NOT EXISTS deployment_meta.migration_ledger (
      migration_id text PRIMARY KEY,
      artifact_path text NOT NULL UNIQUE,
      sha256 text NOT NULL,
      source_commit text,
      applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
    );
  `)
}

async function existingPublicObjects(client: Client) {
  const result = await client.query(`
    SELECT count(*)::int AS count
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
  `)
  return Number(result.rows[0]?.count ?? 0)
}

async function acquireLock(client: Client) {
  const result = await client.query("SELECT pg_try_advisory_lock(hashtext('dongphugia:postgres-migration:v1')) AS locked")
  if (result.rows[0]?.locked !== true) fail('another migration owner holds the advisory lock')
}

async function releaseLock(client: Client) {
  await client.query("SELECT pg_advisory_unlock(hashtext('dongphugia:postgres-migration:v1'))").catch(() => undefined)
}

async function applySql(client: Client, validated: Validated, file: string) {
  const sql = validated.files.get(file)?.toString('utf8')
  if (!sql) fail(`validated SQL bytes are unavailable: ${file}`)
  await client.query(sql)
}

async function ledgerRows(client: Client) {
  const result = await client.query<{ migration_id: string; artifact_path: string; sha256: string }>(
    'SELECT migration_id, artifact_path, sha256 FROM deployment_meta.migration_ledger ORDER BY applied_at, migration_id',
  )
  return result.rows
}

async function recordLedger(client: Client, migrationId: string, file: string, checksum: string, sourceCommit?: string) {
  await client.query(
    `INSERT INTO deployment_meta.migration_ledger (migration_id, artifact_path, sha256, source_commit)
     VALUES ($1, $2, $3, $4)`,
    [migrationId, file, checksum, sourceCommit ?? null],
  )
}

async function run() {
  const args = parseArgs(process.argv.slice(2))
  const validated = await readAndValidateInputs(args)
  if (args.validateOnly) {
    console.log(JSON.stringify({
      status: 'VALIDATED',
      target: args.target,
      baseline: validated.manifest.baseline,
      layers: validated.manifest.layers.length,
      migrations: validated.manifest.migrations.length,
    }))
    return
  }

  const client = new Client(parseTargetConnection(args.target, process.env.POSTGRES_MIGRATION_URL))
  const executed: string[] = []
  let attestation: Awaited<ReturnType<typeof attestTarget>> | undefined
  try {
    await client.connect()
    await configureMigrationSession(client)
    attestation = await attestTarget(client, args.target)
    await acquireLock(client)
    await ensureLedger(client)
    const rows = await ledgerRows(client)
    for (const row of rows) {
      const expected = validated.checksums.get(row.artifact_path)
      if (!expected || expected !== row.sha256) fail(`ledger checksum mismatch: ${row.artifact_path}`)
    }

    const baselineIds = validated.manifest.layers.map((layer) => `baseline-v1:${layer.name}`)
    const appliedIds = new Set(rows.map((row) => row.migration_id))
    const baselineComplete = baselineIds.every((id) => appliedIds.has(id))
    if (!baselineComplete && !args.skipBaseline) {
      if ((await existingPublicObjects(client)) > 0) fail('baseline is not recorded on a non-empty database; adoption is not supported')
      await client.query('BEGIN')
      try {
        for (const layer of validated.manifest.layers) {
          const file = normalizeRelativePath(layer.path)
          const id = `baseline-v1:${layer.name}`
          if (appliedIds.has(id)) continue
          await applySql(client, validated, file)
          await recordLedger(client, id, file, validated.checksums.get(file)!, args.sourceCommit)
          executed.push(file)
        }
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined)
        throw error
      }
    }

    const refreshedRows = await ledgerRows(client)
    const refreshedIds = new Set(refreshedRows.map((row) => row.migration_id))
    if (!validated.manifest.layers.every((layer) => refreshedIds.has(`baseline-v1:${layer.name}`))) {
      fail('baseline ledger is incomplete after replay')
    }
    if (!args.baselineOnly) {
      const requested = args.migration ? normalizeRelativePath(args.migration) : undefined
      const candidates = validated.manifest.migrations
        .map((migration) => normalizeRelativePath(migration.path))
        .filter((file) => !requested || file === requested)
      if (requested && !candidates.includes(requested)) fail('requested migration is not declared')
      for (const file of candidates) {
        const migration = validated.manifest.migrations.find((item) => normalizeRelativePath(item.path) === file)!
        const id = `migration:${migration.name}`
        if (refreshedIds.has(id)) continue
        await client.query('BEGIN')
        try {
          await applySql(client, validated, file)
          await recordLedger(client, id, file, validated.checksums.get(file)!, args.sourceCommit)
          await client.query('COMMIT')
          executed.push(file)
        } catch (error) {
          await client.query('ROLLBACK').catch(() => undefined)
          throw error
        }
      }
    }

    console.log(JSON.stringify({
      status: 'PASS',
      target: args.target,
      database: attestation?.database,
      targetFingerprint: attestation?.fingerprint,
      postgresVersion: attestation?.serverVersion,
      executed,
      ledgerCount: (await ledgerRows(client)).length,
    }))
  } catch (error) {
    const failure = error instanceof Error && error.message.startsWith('MIGRATION_RUNNER_FAILED:')
      ? error.message
      : `MIGRATION_RUNNER_FAILED: ${sanitizeDatabaseError(error)}`
    console.error(failure)
    process.exitCode = 1
  } finally {
    if (attestation) await releaseLock(client)
    await client.end().catch(() => undefined)
  }
}

const isDirectExecution = process.argv[1]
  ? path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
  : false

if (isDirectExecution) {
  void run().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message.split('\n')[0] : 'MIGRATION_RUNNER_FAILED: validation failed')
    process.exitCode = 1
  })
}

export { normalizeRelativePath, parseChecksums }
