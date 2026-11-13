export const DISPOSABLE_DATABASE_NAME = 'dpg_legacy_recovery_disposable'
export const LOCAL_ADMIN_PREVIEW_DATABASE_NAME = 'dpg_legacy_admin_preview'
export const LOCAL_ADMIN_FULL_PREVIEW_DATABASE_NAME = 'dpg_legacy_admin_full_preview'
export const LOCAL_ADMIN_PREVIEW_PORT = '55439'

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])

export function assertDisposableLocalDatabase(connectionString) {
  if (!connectionString) throw new Error('LOCAL_DATABASE_URL_REQUIRED')
  let url
  try { url = new URL(connectionString) } catch { throw new Error('LOCAL_DATABASE_URL_INVALID') }
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  const database = decodeURIComponent(url.pathname.slice(1))
  const queryKeys = [...new Set(url.searchParams.keys())]
  if (url.protocol !== 'postgresql:' || !LOOPBACK_HOSTS.has(hostname)
    || database !== DISPOSABLE_DATABASE_NAME || url.hash
    || queryKeys.some((key) => key !== 'schema') || url.searchParams.getAll('schema').length > 1) {
    throw new Error('LOCAL_DISPOSABLE_DATABASE_REQUIRED')
  }
  return {
    hostname,
    database,
    port: url.port || '5432',
    username: decodeURIComponent(url.username),
    schema: url.searchParams.get('schema') ?? 'public',
  }
}

export function assertLocalAdminPreviewDatabase(connectionString) {
  return assertLocalAdminDatabase(connectionString, LOCAL_ADMIN_PREVIEW_DATABASE_NAME, 'LOCAL_ADMIN_PREVIEW')
}

export function assertLocalAdminFullPreviewDatabase(connectionString) {
  return assertLocalAdminDatabase(connectionString, LOCAL_ADMIN_FULL_PREVIEW_DATABASE_NAME, 'LOCAL_ADMIN_FULL_PREVIEW')
}

function assertLocalAdminDatabase(connectionString, requiredDatabase, errorPrefix) {
  if (!connectionString) throw new Error('LOCAL_ADMIN_PREVIEW_DATABASE_URL_REQUIRED')
  let url
  try { url = new URL(connectionString) } catch { throw new Error('LOCAL_ADMIN_PREVIEW_DATABASE_URL_INVALID') }
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  const database = decodeURIComponent(url.pathname.slice(1))
  const queryKeys = [...new Set(url.searchParams.keys())]
  if (url.protocol !== 'postgresql:' || hostname !== '127.0.0.1'
    || database !== requiredDatabase
    || (url.port || '5432') !== LOCAL_ADMIN_PREVIEW_PORT
    || decodeURIComponent(url.username) !== 'postgres' || url.password
    || url.hash || queryKeys.some((key) => key !== 'schema')
    || url.searchParams.getAll('schema').length > 1
    || (url.searchParams.get('schema') ?? 'public') !== 'public') {
    throw new Error(`${errorPrefix}_DATABASE_REQUIRED`)
  }
  return { hostname, database, port: url.port, username: 'postgres', schema: 'public' }
}

export function assertLocalAdminPreviewServerIdentity(target, identity) {
  if (target.hostname !== '127.0.0.1' || target.port !== LOCAL_ADMIN_PREVIEW_PORT
    || identity.serverAddress !== '127.0.0.1' || Number(identity.serverPort) !== Number(LOCAL_ADMIN_PREVIEW_PORT)
    || identity.databaseName !== target.database
    || Math.floor(Number(identity.serverVersionNum) / 10000) !== 17
    || !identity.dataDirectory || identity.dataDirectory !== identity.expectedDataDirectory) {
    throw new Error('LOCAL_ADMIN_PREVIEW_POSTGRES_SERVER_IDENTITY_MISMATCH')
  }
  return true
}

export function assertSameLocalDatabase(primary, direct) {
  if (direct.database !== primary.database || direct.hostname !== primary.hostname
    || direct.port !== primary.port || direct.username !== primary.username || direct.schema !== primary.schema) {
    throw new Error('LOCAL_DIRECT_URL_MISMATCH')
  }
}

export function assertDryRunOnly(args) {
  if (args.includes('--apply')) throw new Error('WRITE_MODE_NOT_IMPLEMENTED')
  if (!args.includes('--dry-run')) throw new Error('DRY_RUN_FLAG_REQUIRED')
}
