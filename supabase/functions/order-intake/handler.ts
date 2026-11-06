import {
  verifyOrderIntakeSignature,
  type OrderIntakeSignatureInput,
} from '../../../packages/app-contracts/src/order-intake-signature.ts'

type OrderRequestItem = {
  productId: number
  quantity: number
  installOption: 'none' | 'install' | 'replace'
}

type OrderRequestInput = {
  customer_name: string
  customer_phone: string
  customer_email: string
  customer_address: string
  note: string
  items: OrderRequestItem[]
}

export type OrderIntakeDatabase = Readonly<{
  create(input: OrderRequestInput, idempotencyKey: string, requestId: string): Promise<unknown>
  receipt(idempotencyKey: string): Promise<unknown>
}>

type HandlerOptions = Readonly<{
  database: OrderIntakeDatabase
  signingSecret: string
  nowSeconds?: () => number
}>

const MAX_REQUEST_BYTES = 16 * 1024
const PHONE_PATTERN = /^(?:\+84|0)(?:3|5|7|8|9)\d{8}$/
const ORDER_NUMBER_PATTERN = /^DPG-[0-9]{6}-[0-9A-F]{8}$/
const IDEMPOTENCY_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ALLOWED_ERROR_CODES = new Set([
  'METHOD_NOT_ALLOWED', 'ORIGIN_FORBIDDEN', 'UNSUPPORTED_MEDIA_TYPE', 'REQUEST_TOO_LARGE',
  'UNAUTHORIZED', 'INVALID_INPUT', 'INVALID_CUSTOMER_NAME', 'INVALID_CUSTOMER_PHONE',
  'INVALID_CUSTOMER_EMAIL', 'INVALID_CUSTOMER_ADDRESS', 'INVALID_NOTE', 'INVALID_ITEM',
  'INVALID_QUANTITY', 'DUPLICATE_PRODUCT', 'INVALID_INSTALL_OPTION', 'INVALID_IDEMPOTENCY_KEY',
  'IDEMPOTENCY_KEY_REUSED', 'PRODUCT_UNAVAILABLE', 'PRODUCT_REQUIRES_QUOTE', 'ORDER_RATE_LIMITED',
  'ORDER_REQUEST_FAILED',
])

class RequestFailure extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code)
  }
}

function jsonResponse(body: unknown, status: number, requestId: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Request-Id': requestId,
    },
  })
}

function isAllowedOrigin(origin: string | null): origin is string {
  if (!origin) return false
  try {
    const parsed = new URL(origin)
    const localHttp = parsed.protocol === 'http:'
      && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
    if ((parsed.protocol !== 'https:' && !localHttp) || parsed.origin !== origin) return false
    if (localHttp) return true
    return parsed.hostname === 'www.dongphugia.vn'
      || parsed.hostname === 'dongphugia.vn'
      || /^pr-[0-9]+-dongphugia-v1-public-preview\.tranhuunguyenhuy\.workers\.dev$/i.test(parsed.hostname)
  } catch {
    return false
  }
}

async function readBoundedJson(request: Request): Promise<{ value: unknown; bodyText: string }> {
  const contentLength = request.headers.get('content-length')
  if (contentLength && Number(contentLength) > MAX_REQUEST_BYTES) {
    throw new RequestFailure(413, 'REQUEST_TOO_LARGE')
  }
  const reader = request.body?.getReader()
  if (!reader) throw new RequestFailure(400, 'INVALID_INPUT')

  const chunks: Uint8Array[] = []
  let totalBytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > MAX_REQUEST_BYTES) {
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
  let bodyText: string
  try {
    bodyText = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new RequestFailure(400, 'INVALID_INPUT')
  }
  try {
    return { value: JSON.parse(bodyText), bodyText }
  } catch {
    throw new RequestFailure(400, 'INVALID_INPUT')
  }
}

function stringField(value: unknown, field: string, maximum: number, required = false): string {
  if (value === undefined || value === null) {
    if (required) throw new RequestFailure(400, `INVALID_${field}`)
    return ''
  }
  if (typeof value !== 'string') throw new RequestFailure(400, `INVALID_${field}`)
  const normalized = value.trim()
  if (normalized.length > maximum || (required && normalized.length === 0)) {
    throw new RequestFailure(400, `INVALID_${field}`)
  }
  return normalized
}

function validateInput(value: unknown): OrderRequestInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RequestFailure(400, 'INVALID_INPUT')
  }
  const input = value as Record<string, unknown>
  const name = stringField(input.customer_name, 'CUSTOMER_NAME', 200, true)
  const rawPhone = stringField(input.customer_phone, 'CUSTOMER_PHONE', 20, true)
  const phone = rawPhone.replace(/[\s().-]/g, '')
  if (!PHONE_PATTERN.test(phone)) throw new RequestFailure(400, 'INVALID_CUSTOMER_PHONE')
  const email = stringField(input.customer_email, 'CUSTOMER_EMAIL', 200)
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new RequestFailure(400, 'INVALID_CUSTOMER_EMAIL')
  }
  const address = stringField(input.customer_address, 'CUSTOMER_ADDRESS', 1000)
  const note = stringField(input.note, 'NOTE', 2000)
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 20) {
    throw new RequestFailure(400, 'INVALID_INPUT')
  }

  const items = input.items.map((item): OrderRequestItem => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new RequestFailure(400, 'INVALID_ITEM')
    }
    const record = item as Record<string, unknown>
    if (!Number.isSafeInteger(record.productId) || Number(record.productId) < 1) {
      throw new RequestFailure(400, 'INVALID_ITEM')
    }
    if (!Number.isSafeInteger(record.quantity) || Number(record.quantity) < 1 || Number(record.quantity) > 99) {
      throw new RequestFailure(400, 'INVALID_QUANTITY')
    }
    const installOption = record.installOption ?? 'none'
    if (installOption !== 'none' && installOption !== 'install' && installOption !== 'replace') {
      throw new RequestFailure(400, 'INVALID_INSTALL_OPTION')
    }
    return { productId: Number(record.productId), quantity: Number(record.quantity), installOption }
  })
  if (new Set(items.map((item) => item.productId)).size !== items.length) {
    throw new RequestFailure(400, 'DUPLICATE_PRODUCT')
  }

  return { customer_name: name, customer_phone: phone, customer_email: email, customer_address: address, note, items }
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

function safeReceipt(value: unknown): { order_number: string; status: 'pending'; payment_status: 'unpaid' } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const data = value as Record<string, unknown>
  if (typeof data.order_number !== 'string' || !ORDER_NUMBER_PATTERN.test(data.order_number)
      || data.status !== 'pending' || data.payment_status !== 'unpaid') return null
  return { order_number: data.order_number, status: 'pending', payment_status: 'unpaid' }
}

function safeDatabaseError(value: unknown): string {
  const candidate = value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>).error
    : null
  if (typeof candidate === 'string' && ALLOWED_ERROR_CODES.has(candidate)) return candidate
  if (value instanceof Error) {
    const match = [...ALLOWED_ERROR_CODES].find((code) => value.message === code || value.message.startsWith(`${code}:`))
    if (match) return match
  }
  return 'ORDER_REQUEST_FAILED'
}

function signedInput(request: Request, bodyText: string): OrderIntakeSignatureInput | null {
  const origin = request.headers.get('origin')
  const requestId = request.headers.get('x-request-id')
  const idempotencyKey = request.headers.get('idempotency-key')?.trim()
  const timestamp = request.headers.get('x-dpg-order-timestamp')
  if (!isAllowedOrigin(origin) || !requestId || !REQUEST_ID_PATTERN.test(requestId)
      || !idempotencyKey || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)
      || !timestamp || !/^\d{10}$/.test(timestamp)) return null
  return {
    method: request.method as 'GET' | 'POST',
    path: new URL(request.url).pathname,
    origin,
    requestId,
    idempotencyKey,
    timestamp,
    bodyText,
  }
}

export function createOrderIntakeHandler(options: HandlerOptions): (request: Request) => Promise<Response> {
  const nowSeconds = options.nowSeconds ?? (() => Math.floor(Date.now() / 1000))
  return async (request) => {
    const requestId = request.headers.get('x-request-id')?.match(REQUEST_ID_PATTERN)
      ? request.headers.get('x-request-id')!
      : crypto.randomUUID()
    if (request.method !== 'POST' && request.method !== 'GET') {
      return jsonResponse({ error: { code: 'METHOD_NOT_ALLOWED' } }, 405, requestId)
    }
    if (new URL(request.url).pathname !== '/functions/v1/order-intake') {
      return jsonResponse({ error: { code: 'UNAUTHORIZED' } }, 401, requestId)
    }
    if (!isAllowedOrigin(request.headers.get('origin'))) {
      return jsonResponse({ error: { code: 'ORIGIN_FORBIDDEN' } }, 403, requestId)
    }
    if (request.method === 'POST' && !request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
      return jsonResponse({ error: { code: 'UNSUPPORTED_MEDIA_TYPE' } }, 415, requestId)
    }

    const idempotencyKey = request.headers.get('idempotency-key')?.trim()
    if (!idempotencyKey || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
      return jsonResponse({ error: { code: 'INVALID_IDEMPOTENCY_KEY' } }, 400, requestId)
    }
    if (options.signingSecret.length < 32) {
      return jsonResponse({ error: { code: 'ORDER_REQUEST_FAILED' } }, 503, requestId)
    }

    try {
      let bodyText = ''
      let input: OrderRequestInput | null = null
      if (request.method === 'POST') {
        const parsed = await readBoundedJson(request)
        bodyText = parsed.bodyText
        input = validateInput(parsed.value)
      }
      const signatureInput = signedInput(request, bodyText)
      const signature = request.headers.get('x-dpg-order-signature') ?? ''
      if (!signatureInput || !(await verifyOrderIntakeSignature(
        options.signingSecret, signatureInput, signature, nowSeconds(),
      ))) throw new RequestFailure(401, 'UNAUTHORIZED')

      if (request.method === 'GET') {
        const receipt = safeReceipt(await options.database.receipt(idempotencyKey))
        return jsonResponse({ data: receipt }, 200, requestId)
      }

      const result = await options.database.create(input!, idempotencyKey, requestId)
      const errorCode = safeDatabaseError(result)
      if (errorCode !== 'ORDER_REQUEST_FAILED' || (result && typeof result === 'object' && 'error' in result)) {
        return jsonResponse({ error: { code: errorCode } }, statusForError(errorCode), requestId)
      }
      const receipt = safeReceipt(result)
      if (!receipt) throw new RequestFailure(503, 'ORDER_REQUEST_FAILED')
      return jsonResponse({ data: receipt }, 201, requestId)
    } catch (error) {
      if (error instanceof RequestFailure) {
        return jsonResponse({ error: { code: error.code } }, error.status, requestId)
      }
      return jsonResponse({ error: { code: safeDatabaseError(error) } }, 503, requestId)
    }
  }
}
