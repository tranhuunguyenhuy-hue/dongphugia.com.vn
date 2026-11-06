import type { OrderIntakeDatabase } from './handler.ts'

type QueryClient = Readonly<{
  query(sql: string, values?: unknown[]): Promise<{ rows: Array<{ response?: unknown }> }>
  release(): void
}>

type ConnectionPool = Readonly<{
  connect(): Promise<QueryClient>
}>

export function createOrderIntakeDatabase(pool: ConnectionPool): OrderIntakeDatabase {
  const inIntakeTransaction = async <T>(query: (client: QueryClient) => Promise<T>): Promise<T> => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      try {
        await client.query('SET LOCAL ROLE dpg_order_intake')
        const result = await query(client)
        await client.query('COMMIT')
        return result
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined)
        throw error
      }
    } finally {
      client.release()
    }
  }

  return {
    create: async (input, idempotencyKey, requestId) => inIntakeTransaction(async (client) => {
      const result = await client.query(
        'select public.guest_order_request_create($1::jsonb, $2, $3::uuid) as response',
        [JSON.stringify(input), idempotencyKey, requestId],
      )
      return result.rows[0]?.response ?? null
    }),
    receipt: async (idempotencyKey) => inIntakeTransaction(async (client) => {
      const result = await client.query(
        'select public.guest_order_request_receipt($1) as response',
        [idempotencyKey],
      )
      return result.rows[0]?.response ?? null
    }),
  }
}
