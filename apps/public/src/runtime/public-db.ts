// M1: read-only connection to V1 Supabase through a scoped Cloudflare Hyperdrive.
// Disabled by default; never insert connection strings or service keys in source.
export type PublicHyperdrive = { connectionString: string }
export function publicPostgresEnabled() {
  return process.env.PUBLIC_CATALOGUE_SOURCE === 'postgresql'
}
const DIAGNOSTIC_TABLES = new Set([
  'products', 'categories', 'subcategories', 'brands', 'product_images', 'product_descriptions',
  'product_spec_values', 'spec_definitions', 'spec_options', 'product_documents',
  'product_feature_values', 'product_features', 'blog_posts', 'blog_categories',
  'blog_post_categories', 'blog_post_tags', 'tags',
])
let activeReadClients = 0
let peakReadClients = 0

function publicQueryTables(statement: string) {
  const tables = [...statement.matchAll(/\b(?:FROM|JOIN)\s+dpg_app\.([a-z_]+)/gi)]
    .map(match => match[1])
    .filter((table): table is string => DIAGNOSTIC_TABLES.has(table))
  return [...new Set(tables)].sort()
}

function recordPublicReadDiagnostic(event: 'PUBLIC_DATABASE_READ_OK' | 'PUBLIC_DATABASE_READ_FAILURE', queryTables: string[], started: number, error?: unknown) {
  if (process.env.PUBLIC_DB_DIAGNOSTICS !== 'true') return
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
  console.log(JSON.stringify({
    event,
    queryTables,
    elapsedMs: Math.max(0, Math.round(performance.now() - started)),
    activePgClients: activeReadClients,
    peakPgClients: peakReadClients,
    ...(event === 'PUBLIC_DATABASE_READ_FAILURE' && /^[0-9A-Z]{5}$/.test(code) ? { sqlState: code } : {}),
  }))
}

async function getHyperdrive() {
  const { env } = await import('cloudflare:workers')
  const hyperdrive = (env as { PUBLIC_DB?: PublicHyperdrive }).PUBLIC_DB
  if (!hyperdrive?.connectionString) throw new Error('PUBLIC_DATABASE_BINDING_REQUIRED')
  return hyperdrive
}
/** Fixed SELECT only; all dynamic parameters are bound, no Postgres writes allowed. */
export async function readPublicRows<T>(
  statement: string,
  values: readonly (string | number | boolean)[] = [],
): Promise<T[]> {
  if (!publicPostgresEnabled()) throw new Error('PUBLIC_DATABASE_MODE_DISABLED')
  if (!/^\s*SELECT\b/i.test(statement) || statement.includes(';')
    || /\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|GRANT|REVOKE|TRUNCATE|COPY|CALL)\b/i.test(statement)) {
    throw new Error('PUBLIC_DATABASE_READ_ONLY_REQUIRED')
  }
  const started = performance.now()
  const queryTables = publicQueryTables(statement)
  let closeClient: (() => Promise<unknown>) | null = null
  let countedActiveClient = false
  try {
    const { connectionString } = await getHyperdrive()
    const { Client } = await import('pg')
    const client = new Client({
      connectionString,
      connectionTimeoutMillis: 3000,
      query_timeout: 5000,
    })
    closeClient = () => client.end()
    activeReadClients += 1
    countedActiveClient = true
    peakReadClients = Math.max(peakReadClients, activeReadClients)
    await client.connect()
    const response = await client.query(statement, [...values])
    recordPublicReadDiagnostic('PUBLIC_DATABASE_READ_OK', queryTables, started)
    return response.rows as T[]
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
    recordPublicReadDiagnostic('PUBLIC_DATABASE_READ_FAILURE', queryTables, started, error)
    throw error
  } finally {
    if (closeClient) await closeClient().catch(() => undefined)
    if (countedActiveClient) activeReadClients -= 1
  }
}
