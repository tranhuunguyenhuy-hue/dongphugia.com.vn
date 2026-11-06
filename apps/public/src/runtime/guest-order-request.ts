import type { PublicWorkerEnvironment } from '../worker-policy'
import { createOrderIntakeSignature } from '../../../../packages/app-contracts/src/order-intake-signature'

const MAX_REQUEST_BYTES = 16 * 1024
const MAX_RESPONSE_BYTES = 4 * 1024
const PUBLIC_CACHE_CONTROL = 'private, no-store'
const PHONE_PATTERN = /^(?:\+84|0)(?:3|5|7|8|9)\d{8}$/
const ORDER_NUMBER_PATTERN = /^DPG-[0-9]{6}-[0-9A-F]{8}$/
const IDEMPOTENCY_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SAFE_ERROR_CODES = new Set([
  'METHOD_NOT_ALLOWED',
  'ORIGIN_FORBIDDEN',
  'UNSUPPORTED_MEDIA_TYPE',
  'REQUEST_TOO_LARGE',
  'UNAUTHORIZED',
  'INVALID_INPUT',
  'INVALID_CUSTOMER_NAME',
  'INVALID_CUSTOMER_PHONE',
  'INVALID_CUSTOMER_EMAIL',
  'INVALID_CUSTOMER_ADDRESS',
  'INVALID_NOTE',
  'INVALID_ITEM',
  'INVALID_QUANTITY',
  'DUPLICATE_PRODUCT',
  'INVALID_INSTALL_OPTION',
  'INVALID_IDEMPOTENCY_KEY',
  'IDEMPOTENCY_KEY_REUSED',
  'PRODUCT_UNAVAILABLE',
  'PRODUCT_REQUIRES_QUOTE',
  'ORDER_RATE_LIMITED',
  'ORDER_REQUEST_FAILED',
])

export type GuestOrderEnvironment = Pick<PublicWorkerEnvironment,
  'PUBLIC_ORDER_INTAKE_URL' | 'PUBLIC_SUPABASE_PUBLISHABLE_KEY' | 'ORDER_INTAKE_SIGNING_SECRET' | 'ORDER_REQUEST_LIMITER'>

class RequestFailure extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code)
  }
}

function jsonResponse(body: unknown, status: number, requestId: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Cache-Control': PUBLIC_CACHE_CONTROL,
      'Content-Type': 'application/json; charset=utf-8',
      'X-Request-Id': requestId,
    },
  })
}

function configuredUpstream(environment: GuestOrderEnvironment): { endpoint: URL; publishableKey: string; signingSecret: string } {
  const rawEndpoint = environment.PUBLIC_ORDER_INTAKE_URL
  const publishableKey = environment.PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const signingSecret = environment.ORDER_INTAKE_SIGNING_SECRET
  if (typeof rawEndpoint !== 'string' || typeof publishableKey !== 'string'
      || typeof signingSecret !== 'string' || new TextEncoder().encode(signingSecret).byteLength < 32) {
    throw new RequestFailure(503, 'ORDER_INTAKE_UNAVAILABLE')
  }

  let endpoint: URL
  try {
    endpoint = new URL(rawEndpoint)
  } catch {
    throw new RequestFailure(503, 'ORDER_INTAKE_UNAVAILABLE')
  }

  const hostedEndpoint = endpoint.protocol === 'https:'
    && /^[a-z0-9-]+\.supabase\.co$/i.test(endpoint.hostname)
  const localEndpoint = endpoint.protocol === 'http:'
    && ['localhost', '127.0.0.1'].includes(endpoint.hostname)
    && endpoint.port === '54321'
  if (
    (!hostedEndpoint && !localEndpoint) ||
    endpoint.pathname !== '/functions/v1/order-intake' ||
    endpoint.username || endpoint.password || endpoint.search || endpoint.hash ||
    !/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)
  ) throw new RequestFailure(503, 'ORDER_INTAKE_UNAVAILABLE')

  return { endpoint, publishableKey, signingSecret }
}

async function signedUpstreamHeaders(
  method: 'GET' | 'POST',
  endpoint: URL,
  origin: string,
  requestId: string,
  idempotencyKey: string,
  bodyText: string,
  publishableKey: string,
  signingSecret: string,
): Promise<Headers> {
  const timestamp = String(Math.floor(Date.now() / 1000))
  const signature = await createOrderIntakeSignature(signingSecret, {
    method,
    path: endpoint.pathname,
    origin,
    requestId,
    idempotencyKey,
    timestamp,
    bodyText,
  })
  return new Headers({
    'Idempotency-Key': idempotencyKey,
    'Origin': origin,
    'apikey': publishableKey,
    'X-Request-Id': requestId,
    'X-DPG-Order-Timestamp': timestamp,
    'X-DPG-Order-Signature': signature,
  })
}

async function readBoundedBody(request: Request, maxBytes: number): Promise<string> {
  const contentLength = request.headers.get('content-length')
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new RequestFailure(413, 'REQUEST_TOO_LARGE')
  }

  const reader = request.body?.getReader()
  if (!reader) throw new RequestFailure(400, 'INVALID_JSON')

  const chunks: Uint8Array[] = []
  let totalBytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > maxBytes) {
        await reader.cancel()
        throw new RequestFailure(413, 'REQUEST_TOO_LARGE')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new RequestFailure(400, 'INVALID_JSON')
  }
}

function normalizedPhoneFrom(input: unknown): string {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new RequestFailure(400, 'INVALID_INPUT')
  }
  const phone = (input as Record<string, unknown>).customer_phone
  if (typeof phone !== 'string') throw new RequestFailure(400, 'INVALID_CUSTOMER_PHONE')
  const normalized = phone.trim().replace(/[\s().-]/g, '')
  if (!PHONE_PATTERN.test(normalized)) throw new RequestFailure(400, 'INVALID_CUSTOMER_PHONE')
  return normalized
}

async function digest(value: string): Promise<string> {
  const result = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(result), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function readBoundedResponse(response: Response): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []
  let totalBytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > MAX_RESPONSE_BYTES) {
        await reader.cancel()
        throw new RequestFailure(502, 'ORDER_INTAKE_FAILED')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(bytes)
}

function upstreamErrorCode(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'ORDER_INTAKE_FAILED'
  const error = (value as Record<string, unknown>).error
  if (!error || typeof error !== 'object' || Array.isArray(error)) return 'ORDER_INTAKE_FAILED'
  const code = (error as Record<string, unknown>).code
  return typeof code === 'string' && SAFE_ERROR_CODES.has(code) ? code : 'ORDER_INTAKE_FAILED'
}

function statusForError(code: string): number {
  if (code === 'ORIGIN_FORBIDDEN') return 403
  if (code === 'UNAUTHORIZED') return 401
  if (code === 'METHOD_NOT_ALLOWED') return 405
  if (code === 'UNSUPPORTED_MEDIA_TYPE') return 415
  if (code === 'REQUEST_TOO_LARGE') return 413
  if (code === 'ORDER_RATE_LIMITED') return 429
  if (code === 'IDEMPOTENCY_KEY_REUSED') return 409
  if (code === 'PRODUCT_UNAVAILABLE') return 409
  if (code === 'PRODUCT_REQUIRES_QUOTE') return 422
  if (code.startsWith('INVALID_') || code === 'DUPLICATE_PRODUCT') return 400
  return 503
}

function safeReceiptFrom(value: unknown): { order_number: string; status: 'pending'; payment_status: 'unpaid' } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const data = (value as Record<string, unknown>).data
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const record = data as Record<string, unknown>
  if (
    typeof record.order_number !== 'string' || !ORDER_NUMBER_PATTERN.test(record.order_number)
    || record.status !== 'pending' || record.payment_status !== 'unpaid'
  ) return null
  return {
    order_number: record.order_number,
    status: 'pending',
    payment_status: 'unpaid',
  }
}

async function readPersistedReceipt(
  endpoint: URL,
  publishableKey: string,
  origin: string,
  requestId: string,
  idempotencyKey: string,
  signingSecret: string,
  fetcher: typeof fetch,
): Promise<{ receipt: ReturnType<typeof safeReceiptFrom>; available: boolean }> {
  try {
    const headers = await signedUpstreamHeaders(
      'GET', endpoint, origin, requestId, idempotencyKey, '', publishableKey, signingSecret,
    )
    const response = await fetcher(endpoint, {
      method: 'GET',
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
      headers,
    })
    if (!response.ok) return { receipt: null, available: false }
    const payload: unknown = JSON.parse(await readBoundedResponse(response))
    const data = payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>).data
      : null
    if (data === null) return { receipt: null, available: true }
    const receipt = safeReceiptFrom(payload)
    return { receipt, available: receipt !== null }
  } catch {
    return { receipt: null, available: false }
  }
}

async function rateLimitByRequestIp(request: Request, limiter: NonNullable<GuestOrderEnvironment['ORDER_REQUEST_LIMITER']>) {
  const clientIp = request.headers.get('cf-connecting-ip') ?? 'unknown-client'
  const clientHash = await digest(clientIp)
  return limiter.limit({ key: `guest-order-request-ip:${clientHash}` })
}

export async function handleGuestOrderReceiptRequest(
  request: Request,
  environment: GuestOrderEnvironment,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  const requestId = crypto.randomUUID()
  if (request.method !== 'GET') {
    return jsonResponse({ error: { code: 'METHOD_NOT_ALLOWED' } }, 405, requestId)
  }

  try {
    const origin = request.headers.get('origin')
    if (origin && new URL(origin).origin !== new URL(request.url).origin) {
      throw new RequestFailure(403, 'ORIGIN_FORBIDDEN')
    }
    const idempotencyKey = request.headers.get('idempotency-key')?.trim()
    if (!idempotencyKey || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
      throw new RequestFailure(400, 'INVALID_IDEMPOTENCY_KEY')
    }
    const upstream = configuredUpstream(environment)
    const limiter = environment.ORDER_REQUEST_LIMITER
    if (!limiter) throw new RequestFailure(503, 'ORDER_INTAKE_UNAVAILABLE')
    const rate = await rateLimitByRequestIp(request, limiter)
    if (!rate.success) throw new RequestFailure(429, 'ORDER_RATE_LIMITED')

    const forwardedOrigin = origin ?? new URL(request.url).origin
    const result = await readPersistedReceipt(
      upstream.endpoint,
      upstream.publishableKey,
      forwardedOrigin,
      requestId,
      idempotencyKey,
      upstream.signingSecret,
      fetcher,
    )
    if (!result.available) throw new RequestFailure(503, 'ORDER_INTAKE_UNAVAILABLE')
    return jsonResponse({ data: result.receipt }, 200, requestId)
  } catch (error) {
    if (error instanceof RequestFailure) {
      return jsonResponse({ error: { code: error.code } }, error.status, requestId)
    }
    return jsonResponse({ error: { code: 'ORDER_INTAKE_UNAVAILABLE' } }, 503, requestId)
  }
}

export async function handleGuestOrderRequest(
  request: Request,
  environment: GuestOrderEnvironment,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  const requestId = crypto.randomUUID()
  if (request.method !== 'POST') {
    return jsonResponse({ error: { code: 'METHOD_NOT_ALLOWED' } }, 405, requestId)
  }

  try {
    const origin = request.headers.get('origin')
    if (!origin || new URL(origin).origin !== new URL(request.url).origin) {
      throw new RequestFailure(403, 'ORIGIN_FORBIDDEN')
    }
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
      throw new RequestFailure(415, 'UNSUPPORTED_MEDIA_TYPE')
    }

    const idempotencyKey = request.headers.get('idempotency-key')?.trim()
    if (!idempotencyKey || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
      throw new RequestFailure(400, 'INVALID_IDEMPOTENCY_KEY')
    }

    const bodyText = await readBoundedBody(request, MAX_REQUEST_BYTES)
    let input: unknown
    try {
      input = JSON.parse(bodyText)
    } catch {
      throw new RequestFailure(400, 'INVALID_JSON')
    }
    const phone = normalizedPhoneFrom(input)
    const upstream = configuredUpstream(environment)
    const limiter = environment.ORDER_REQUEST_LIMITER
    if (!limiter) throw new RequestFailure(503, 'ORDER_INTAKE_UNAVAILABLE')

    const requestIpRate = await rateLimitByRequestIp(request, limiter)
    if (!requestIpRate.success) throw new RequestFailure(429, 'ORDER_RATE_LIMITED')

    // Check the idempotency record before the phone limit. A replay with the
    // same key must reach the canonical RPC so it can return the saved receipt
    // (or reject a changed payload) without counting as another new order.
    const persistedReceipt = await readPersistedReceipt(
      upstream.endpoint,
      upstream.publishableKey,
      origin,
      requestId,
      idempotencyKey,
      upstream.signingSecret,
      fetcher,
    )
    if (!persistedReceipt.receipt) {
      const phoneHash = await digest(phone)
      const rate = await limiter.limit({ key: `guest-order-phone:${phoneHash}` })
      if (!rate.success) throw new RequestFailure(429, 'ORDER_RATE_LIMITED')
    }

    let response: Response
    try {
      const headers = await signedUpstreamHeaders(
        'POST', upstream.endpoint, origin, requestId, idempotencyKey, bodyText,
        upstream.publishableKey, upstream.signingSecret,
      )
      headers.set('Content-Type', 'application/json')
      response = await fetcher(upstream.endpoint, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
        headers,
        body: bodyText,
      })
    } catch {
      throw new RequestFailure(503, 'ORDER_INTAKE_UNAVAILABLE')
    }

    let payload: unknown
    try {
      payload = JSON.parse(await readBoundedResponse(response))
    } catch (error) {
      if (error instanceof RequestFailure) throw error
      throw new RequestFailure(502, 'ORDER_INTAKE_FAILED')
    }

    if (!response.ok) {
      const code = upstreamErrorCode(payload)
      return jsonResponse({ error: { code } }, statusForError(code), requestId)
    }

    const receipt = safeReceiptFrom(payload)
    if (!receipt) throw new RequestFailure(502, 'ORDER_INTAKE_FAILED')

    return jsonResponse({ data: receipt }, 201, requestId)
  } catch (error) {
    if (error instanceof RequestFailure) {
      return jsonResponse({ error: { code: error.code } }, error.status, requestId)
    }
    return jsonResponse({ error: { code: 'ORDER_INTAKE_UNAVAILABLE' } }, 503, requestId)
  }
}
