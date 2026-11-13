// M1: read-only connection to V1 Supabase through a scoped Cloudflare Hyperdrive.
// Disabled by default; never insert connection strings or service keys in source.
let poolPromise: Promise<import('pg').Pool> | undefined
export type PublicHyperdrive = { connectionString: string }
export function publicPostgresEnabled() {
  return process.env.PUBLIC_CATALOGUE_SOURCE === 'postgresql'
}
async function getPool() {
  if (!poolPromise) {
    poolPromise = (async () => {
      const { env } = await import('cloudflare:workers')
      const hyperdrive = (env as { PUBLIC_DB?: PublicHyperdrive }).PUBLIC_DB
      if (!hyperdrive?.connectionString) throw new Error('PUBLIC_DATABASE_BINDING_REQUIRED')
      const { Pool } = await import('pg')
      return new Pool({
        connectionString: hyperdrive.connectionString,
        max: 2,
        idleTimeoutMillis: 1000,
        connectionTimeoutMillis: 3000,
        query_timeout: 5000,
      })
    })()
  }
  try { return await poolPromise }
  catch (error) { poolPromise = undefined; throw error }
}
/** Fixed SELECT only; all dynamic parameters are bound, no Postgres writes allowed. */
export async function readPublicRows<T>(
  statement: string,
  values: readonly (string | number | boolean)[] = [],
): Promise<T[]> {
  if (!publicPostgresEnabled()) throw new Error('PUBLIC_DATABASE_MODE_DISABLED')
  if (!/^\s*(SELECT|WITH)\b/i.test(statement) || statement.includes(';')) {
    throw new Error('PUBLIC_DATABASE_READ_ONLY_REQUIRED')
  }
  const pool = await getPool()
  const response = await pool.query(statement, [...values])
  return response.rows as T[]
}
