import { Pool } from 'npm:pg@8.20.0'

import {
  createOrderIntakeHandler,
  type OrderIntakeDatabase,
} from './handler.ts'
import { createOrderIntakeDatabase } from './database.ts'
import { isOrderIntakeDatabaseUrl, selectOrderIntakeDatabaseUrl } from './database-url.ts'

const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const databaseUrl = selectOrderIntakeDatabaseUrl(
  Deno.env.get('ORDER_INTAKE_DATABASE_URL')?.trim() ?? '',
  Deno.env.get('SUPABASE_DB_URL')?.trim() ?? '',
  { allowLocal: Deno.env.get('DPG_ORDER_INTAKE_ALLOW_LOCAL_DATABASE') === 'true' },
)
const signingSecret = Deno.env.get('ORDER_INTAKE_SIGNING_SECRET')?.trim() ?? ''

function requestIdFrom(request: Request): string {
  const candidate = request.headers.get('x-request-id')
  return candidate && REQUEST_ID_PATTERN.test(candidate) ? candidate : crypto.randomUUID()
}

function unavailable(requestId: string): Response {
  return Response.json(
    { error: { code: 'ORDER_REQUEST_FAILED' } },
    { status: 503, headers: { 'Cache-Control': 'private, no-store', 'X-Request-Id': requestId } },
  )
}

function reportConfigurationDiagnostic(requestId: string, operation: 'receipt' | 'submit' | 'other') {
  try {
    console.warn('ORDER_INTAKE_DIAGNOSTIC', JSON.stringify({
      requestId,
      operation,
      stage: 'configuration',
      status: 503,
    }))
  } catch {
    // Configuration telemetry must not alter the unavailable response.
  }
}

function createDatabase(url: string): OrderIntakeDatabase | null {
  const allowLocal = Deno.env.get('DPG_ORDER_INTAKE_ALLOW_LOCAL_DATABASE') === 'true'
  if (!isOrderIntakeDatabaseUrl(url, { allowLocal })) return null
  const parsed = new URL(url)
  const local = ['localhost', '127.0.0.1', '[::1]', 'db'].includes(parsed.hostname)
  const sslMode = parsed.searchParams.get('sslmode')

  const pool = new Pool({
    connectionString: url,
    max: 1,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
    ssl: local && sslMode === 'disable' ? false : { rejectUnauthorized: true },
  })

  return createOrderIntakeDatabase(pool)
}

const database = databaseUrl ? createDatabase(databaseUrl) : null
if (!database || new TextEncoder().encode(signingSecret).byteLength < 32) {
  console.info(JSON.stringify({
    event: 'ORDER_INTAKE_CONFIG_UNAVAILABLE',
    dedicatedUrlConfigured: Boolean(Deno.env.get('ORDER_INTAKE_DATABASE_URL')?.trim()),
    platformDefaultAccepted: isOrderIntakeDatabaseUrl(Deno.env.get('SUPABASE_DB_URL')?.trim() ?? ''),
    signingSecretValid: new TextEncoder().encode(signingSecret).byteLength >= 32,
  }))
  Deno.serve((request) => {
    const requestId = requestIdFrom(request)
    const operation = request.method === 'GET' ? 'receipt' : request.method === 'POST' ? 'submit' : 'other'
    reportConfigurationDiagnostic(requestId, operation)
    return unavailable(requestId)
  })
} else {
  Deno.serve(createOrderIntakeHandler({ database, signingSecret }))
}
