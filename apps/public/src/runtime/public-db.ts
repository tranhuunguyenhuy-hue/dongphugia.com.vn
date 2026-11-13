// M1: read-only connection to V1 Supabase through a scoped Cloudflare Hyperdrive.
// Disabled by default; never insert connection strings or service keys in source.
export type PublicHyperdrive = { connectionString: string }
export function publicPostgresEnabled() {
  return process.env.PUBLIC_CATALOGUE_SOURCE === 'postgresql'
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
  const { connectionString } = await getHyperdrive()
  const { Client } = await import('pg')
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 3000,
    query_timeout: 5000,
  })
  try {
    await client.connect()
    const response = await client.query(statement, [...values])
    return response.rows as T[]
  } finally {
    await client.end().catch(() => undefined)
  }
}
