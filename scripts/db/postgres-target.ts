import { createHash } from 'node:crypto'
import type { ClientConfig, QueryResultRow } from 'pg'

export type PostgresTarget = 'disposable' | 'isolated-staging'

export type TargetConnection = ClientConfig & {
  database: string
  user: string
  password: string
  host: string
  port: number
}

export type TargetAttestation = {
  database: string
  user: string
  marker: string
  serverVersion: string
  fingerprint: string
}

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])
const EXPECTED_POSTGRES_VERSION = '16.10'
const ISOLATED_DATABASE = 'dpg_isolated_staging'
const ISOLATED_MIGRATOR = 'dpg_staging_migrator'
const ISOLATED_APP = 'dpg_staging_app'
const ISOLATED_MARKER = 'dongphugia:isolated-staging:v1'

export const TARGET_CONTRACT = {
  postgresVersion: EXPECTED_POSTGRES_VERSION,
  isolatedStaging: {
    database: ISOLATED_DATABASE,
    migrator: ISOLATED_MIGRATOR,
    app: ISOLATED_APP,
    marker: ISOLATED_MARKER,
  },
} as const

export class TargetValidationError extends Error {
  constructor(message: string) {
    super(`TARGET_VALIDATION_FAILED: ${message}`)
    this.name = 'TargetValidationError'
  }
}

function fail(message: string): never {
  throw new TargetValidationError(message)
}

function requiredConfirmation(target: PostgresTarget) {
  if (target === 'isolated-staging') {
    if (process.env.ISOLATED_STAGING_POSTGRES !== '1') {
      fail('ISOLATED_STAGING_POSTGRES=1 is required')
    }
    return
  }
  if (process.env.DISPOSABLE_POSTGRES !== '1') {
    fail('DISPOSABLE_POSTGRES=1 is required')
  }
}

function decode(value: string, label: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    fail(`${label} is not valid URL encoding`)
  }
}

function assertPort(value: string) {
  const port = value ? Number(value) : 5432
  if (!Number.isInteger(port) || port < 1 || port > 65535) fail('database port is invalid')
  return port
}

function assertTargetDatabase(target: PostgresTarget, database: string, user: string) {
  if (target === 'isolated-staging') {
    if (database !== ISOLATED_DATABASE || user !== ISOLATED_MIGRATOR) {
      fail('isolated Staging database/user identity is not exact')
    }
    return
  }
  if (!/^dpg_disposable_[a-z0-9_]{3,48}$/.test(database)) {
    fail('disposable database identity is not allowlisted')
  }
  if (!/^dpg_disposable_[a-z0-9_]{3,48}$/.test(user)) {
    fail('disposable migration role identity is not allowlisted')
  }
}

export function parseTargetConnection(target: PostgresTarget, connectionString: string | undefined): TargetConnection {
  requiredConfirmation(target)
  if (!connectionString) fail('target-specific migration URL is required')

  let parsed: URL
  try {
    parsed = new URL(connectionString)
  } catch {
    fail('database URL is invalid')
  }
  if (!['postgresql:', 'postgres:'].includes(parsed.protocol)) fail('database URL is not PostgreSQL')
  if (parsed.search || parsed.hash) fail('database URL query/hash overrides are forbidden')
  if (!parsed.hostname || !LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase())) {
    fail('migration target must resolve to loopback')
  }

  const user = decode(parsed.username, 'database user')
  const password = decode(parsed.password, 'database password')
  const database = decode(parsed.pathname.replace(/^\//, ''), 'database name')
  if (!user || !password || !database) fail('database URL is missing user, password, or database')
  assertTargetDatabase(target, database, user)

  return {
    host: parsed.hostname,
    port: assertPort(parsed.port),
    database,
    user,
    password,
    ssl: false,
    connectionTimeoutMillis: 5_000,
    query_timeout: 30_000,
    statement_timeout: 30_000,
    application_name: 'dongphugia-foundation-migrator',
  }
}

export function expectedTargetMarker(target: PostgresTarget) {
  if (target === 'isolated-staging') return ISOLATED_MARKER
  return 'dongphugia:disposable:v1'
}

export function expectedAppRole(target: PostgresTarget) {
  return target === 'isolated-staging' ? ISOLATED_APP : 'dpg_disposable_app'
}

type AttestationRow = QueryResultRow & {
  database_name: string
  role_name: string
  marker: string | null
  server_version: string
  server_address: string | null
  app_role_exists: boolean
}

export async function attestTarget(client: { query: (sql: string) => Promise<{ rows: AttestationRow[] }> }, target: PostgresTarget): Promise<TargetAttestation> {
  const result = await client.query(`
    SELECT current_database() AS database_name,
           current_user AS role_name,
           shobj_description(dat.oid, 'pg_database') AS marker,
           current_setting('server_version') AS server_version,
           inet_server_addr()::text AS server_address,
           EXISTS (
             SELECT 1 FROM pg_roles WHERE rolname = '${expectedAppRole(target)}'
           ) AS app_role_exists
    FROM pg_database dat
    WHERE dat.datname = current_database()
  `)
  const row = result.rows[0]
  if (!row) fail('database target attestation returned no row')
  if (row.database_name !== (target === 'isolated-staging' ? ISOLATED_DATABASE : row.database_name)) {
    fail('database name attestation mismatch')
  }
  if (target === 'isolated-staging' && row.role_name !== ISOLATED_MIGRATOR) {
    fail('migration role attestation mismatch')
  }
  if (target === 'disposable' && !/^dpg_disposable_[a-z0-9_]{3,48}$/.test(row.role_name)) {
    fail('disposable migration role attestation mismatch')
  }
  if (row.marker !== expectedTargetMarker(target)) fail('server-side database marker mismatch')
  if (!row.server_version.startsWith(`${EXPECTED_POSTGRES_VERSION} `) && row.server_version !== EXPECTED_POSTGRES_VERSION) {
    fail('PostgreSQL server version does not match the pinned contract')
  }
  if (!row.app_role_exists) fail('isolated runtime role is missing')

  const fingerprint = createHash('sha256')
    .update(`${row.database_name}|${row.role_name}|${row.marker}|${row.server_version}`)
    .digest('hex')

  return {
    database: row.database_name,
    user: row.role_name,
    marker: row.marker,
    serverVersion: row.server_version,
    fingerprint,
  }
}

export async function configureMigrationSession(client: { query: (sql: string) => Promise<unknown> }) {
  await client.query("SET statement_timeout = '30s'")
  await client.query("SET lock_timeout = '5s'")
  await client.query("SET idle_in_transaction_session_timeout = '60s'")
  await client.query("SET application_name = 'dongphugia-foundation-migrator'")
}

export function sanitizeDatabaseError(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
    ? error.code.match(/^[A-Z0-9]{5}$/)?.[0]
    : undefined
  return code ? `postgresql_error:${code}` : 'postgresql_error:unknown'
}
