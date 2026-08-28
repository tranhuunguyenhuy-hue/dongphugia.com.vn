import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.95.0'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key, if-match, x-request-id',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Cache-Control': 'no-store',
}

export class RuntimeHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code)
    this.name = 'RuntimeHttpError'
  }
}

type RpcError = { message?: unknown; code?: unknown }

function configuredPublicKey(): string {
  const legacyKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (legacyKey) return legacyKey

  const configuredKeys = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')
  if (configuredKeys) {
    try {
      const parsed = JSON.parse(configuredKeys) as Record<string, unknown>
      if (typeof parsed.default === 'string' && parsed.default.length > 0) return parsed.default
    } catch {
      // Configuration errors are intentionally collapsed into a generic 500.
    }
  }

  throw new RuntimeHttpError(500, 'RUNTIME_CONFIGURATION_ERROR')
}

export async function requireAuthenticatedClient(request: Request): Promise<{
  client: SupabaseClient
  user: User
}> {
  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) {
    throw new RuntimeHttpError(401, 'UNAUTHORIZED')
  }

  const token = authorization.slice('Bearer '.length).trim()
  if (token.length < 20) throw new RuntimeHttpError(401, 'UNAUTHORIZED')

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  if (!supabaseUrl) throw new RuntimeHttpError(500, 'RUNTIME_CONFIGURATION_ERROR')

  const client = createClient(supabaseUrl, configuredPublicKey(), {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: authorization } },
  })
  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) throw new RuntimeHttpError(401, 'UNAUTHORIZED')
  return { client, user: data.user }
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new RuntimeHttpError(400, 'INVALID_JSON')
  }
}

export function idempotencyKey(request: Request): string {
  const value = request.headers.get('Idempotency-Key')?.trim()
  if (!value || value.length < 8 || value.length > 200) {
    throw new RuntimeHttpError(400, 'INVALID_IDEMPOTENCY_KEY')
  }
  return value
}

export function integerParam(value: string | null, code: string): number {
  if (!value || !/^\d+$/.test(value)) throw new RuntimeHttpError(400, code)
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new RuntimeHttpError(400, code)
  return parsed
}

export function optionalIntegerParam(value: string | null | undefined, code: string): number | null {
  if (value === null || value === undefined || value === '') return null
  return integerParam(value, code)
}

export function expectedVersion(request: Request, bodyValue?: unknown): number | null {
  const raw = bodyValue ?? request.headers.get('If-Match')?.replace(/^W\//, '').replaceAll('"', '')
  return raw === null || raw === undefined || raw === '' ? null : integerParam(String(raw), 'INVALID_EXPECTED_VERSION')
}

export function paginationParam(value: string | null, fallback: number, code: string, maximum: number): number {
  if (value === null) return fallback
  if (!/^\d+$/.test(value)) throw new RuntimeHttpError(400, code)
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > maximum) throw new RuntimeHttpError(400, code)
  return parsed
}

function rpcCode(error: RpcError): string {
  const message = typeof error.message === 'string' ? error.message : ''
  const known = [
    'UNAUTHORIZED', 'INVALID_', 'PRODUCT_', 'QUOTE_', 'IDEMPOTENCY_',
    'ORDER_', 'RESOURCE_', 'FORBIDDEN', 'STALE_', 'MEDIA_', 'PUBLISHING_', 'LEO542_',
  ]
  const code = known.find((prefix) => message.startsWith(prefix))
  return code ? message.slice(0, 80) : 'RUNTIME_OPERATION_FAILED'
}

export function rpcFailure(error: RpcError): RuntimeHttpError {
  const code = rpcCode(error)
  const status = code === 'UNAUTHORIZED' ? 401
    : code === 'IDEMPOTENCY_KEY_REUSED' ? 409
      : code === 'IDEMPOTENCY_IN_PROGRESS' ? 409
      : code === 'STALE_VERSION' ? 412
        : code === 'PUBLISHING_DISABLED' ? 503
          : code.startsWith('MEDIA_') ? 422
            : code.startsWith('FORBIDDEN') ? 403
              : code.startsWith('RESOURCE_') ? 404
      : code.startsWith('INVALID_') || code.startsWith('PRODUCT_') || code.startsWith('QUOTE_') ? 400
          : 500
  return new RuntimeHttpError(status, code)
}

export async function callRpc<T>(
  client: SupabaseClient,
  functionName: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await client.rpc(functionName, args)
  if (error) throw rpcFailure(error)
  return data as T
}

export function jsonResponse(body: unknown, status = 200, requestId?: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      ...(requestId ? { 'X-Request-Id': requestId } : {}),
    },
  })
}

export function errorResponse(error: unknown, requestId: string): Response {
  const safe = error instanceof RuntimeHttpError
    ? error
    : new RuntimeHttpError(500, 'INTERNAL_SERVER_ERROR')
  if (safe.status >= 500) console.error(JSON.stringify({ request_id: requestId, code: safe.code }))
  return jsonResponse({ error: { code: safe.code, request_id: requestId } }, safe.status, requestId)
}

export function handleOptions(request: Request): Response | null {
  return request.method === 'OPTIONS' ? new Response('ok', { headers: corsHeaders }) : null
}

export function requestId(): string {
  return crypto.randomUUID()
}
