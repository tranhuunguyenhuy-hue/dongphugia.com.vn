const SIGNATURE_VERSION = 'dpg-order-intake-v1'
const SIGNATURE_PATH = '/functions/v1/order-intake'
const MAX_CLOCK_SKEW_SECONDS = 60
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const HEX_SIGNATURE_PATTERN = /^[0-9a-f]{64}$/i

export type OrderIntakeSignatureInput = Readonly<{
  method: 'GET' | 'POST'
  path: string
  origin: string
  requestId: string
  idempotencyKey: string
  timestamp: string
  bodyText: string
}>

function secretBytes(secret: string): Uint8Array | null {
  const bytes = new TextEncoder().encode(secret)
  return bytes.byteLength >= 32 ? bytes : null
}

function hasValidMetadata(input: OrderIntakeSignatureInput): boolean {
  if (input.method !== 'GET' && input.method !== 'POST') return false
  if (input.path !== SIGNATURE_PATH) return false
  let origin: URL
  try {
    origin = new URL(input.origin)
  } catch {
    return false
  }
  const localHttp = origin.protocol === 'http:'
    && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)
  if ((origin.protocol !== 'https:' && !localHttp) || origin.origin !== input.origin) return false
  if (!UUID_PATTERN.test(input.requestId) || !UUID_PATTERN.test(input.idempotencyKey)) return false
  if (!/^\d{10}$/.test(input.timestamp)) return false
  if (input.method === 'GET' && input.bodyText !== '') return false
  return true
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const owned = new Uint8Array(bytes.byteLength)
  owned.set(bytes)
  return owned.buffer
}

async function canonicalMessage(input: OrderIntakeSignatureInput): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input.bodyText))
  return [
    SIGNATURE_VERSION,
    input.method,
    input.path,
    input.origin,
    input.requestId,
    input.idempotencyKey,
    input.timestamp,
    bytesToHex(new Uint8Array(digest)),
  ].join('\n')
}

export async function createOrderIntakeSignature(
  secret: string,
  input: OrderIntakeSignatureInput,
): Promise<string> {
  const keyBytes = secretBytes(secret)
  if (!keyBytes || !hasValidMetadata(input)) throw new Error('ORDER_INTAKE_SIGNING_CONFIG_INVALID')
  const key = await crypto.subtle.importKey(
    'raw', toArrayBuffer(keyBytes), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'HMAC', key, new TextEncoder().encode(await canonicalMessage(input)),
  )
  return bytesToHex(new Uint8Array(signature))
}

export async function verifyOrderIntakeSignature(
  secret: string,
  input: OrderIntakeSignatureInput,
  signature: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!secretBytes(secret) || !hasValidMetadata(input) || !HEX_SIGNATURE_PATTERN.test(signature)) return false
  const timestamp = Number(input.timestamp)
  if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > MAX_CLOCK_SKEW_SECONDS) return false

  try {
    const expected = await createOrderIntakeSignature(secret, input)
    let difference = 0
    for (let index = 0; index < expected.length; index += 1) {
      difference |= expected.charCodeAt(index) ^ signature.charCodeAt(index)
    }
    return difference === 0
  } catch {
    return false
  }
}
