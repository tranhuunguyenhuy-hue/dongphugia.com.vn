export const DISPOSABLE_DATABASE_NAME = 'dpg_legacy_recovery_disposable'

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
