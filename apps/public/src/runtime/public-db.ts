// Database reads are opt-in. No connection string or privileged key is committed.
import type { QueryResultRow } from 'pg'

export type PublicHyperdrive = { connectionString: string }
let poolPromise: Promise<import('pg').Pool> | undefined

export function publicPostgresEnabled() {
  return process.env.PUBLIC_CATALOGUE_SOURCE === 'postgresql'
}

async function publicPool() {
  if (!poolPromise) {
    poolPromise = (async () => {
      const { env } = await import('cloudflare:workers')
      const binding = (env as { PUBLIC_DB?: PublicHyperdrive }).PUBLIC_DB
      if (!binding?.connectionString) throw new Error('PUBLIC_DATABASE_BINDING_REQUIRED')
      const { Pool } = await import('pg')
      return new Pool({
        connectionString: binding.connectionString,
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

/** Only fixed, parameterized SELECT statements may use this interface. */
export async function readPublicRows<T extends QueryResultRow>(
  statement: string,
  values: readonly (string | number | boolean)[] = [],
): Promise<T[]> {
  if (!publicPostgresEnabled()) throw new Error('PUBLIC_DATABASE_MODE_DISABLED')
  if (!/^\s*(SELECT|WITH)\b/i.test(statement) || /;/.test(statement)) {
    throw new Error('PUBLIC_DATABASE_READ_ONLY_REQUIRED')
  }
  const pool = await publicPool()
  const result = await pool.query<T>(statement, [...values])
  return result.rows
}
