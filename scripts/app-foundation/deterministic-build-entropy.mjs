import crypto, { createHmac } from 'node:crypto'
import { syncBuiltinESMExports } from 'node:module'

const seed = process.env.DPG_DETERMINISTIC_BUILD_SEED

if (!seed || !/^[0-9a-f]{64}$/.test(seed)) {
  throw new Error('DPG_DETERMINISTIC_BUILD_SEED_REQUIRED')
}

const callsiteInvocations = new Map()

function callsiteInvocation(kind) {
  const callsite = new Error().stack
    ?.split('\n')
    .slice(3)
    .find((line) => !line.includes('deterministic-build-entropy.mjs'))
    ?.replaceAll(process.cwd(), '/workspace/apps/public') || 'unknown-callsite'
  const invocationKey = `${kind}:${callsite}`
  const invocation = callsiteInvocations.get(invocationKey) || 0
  callsiteInvocations.set(invocationKey, invocation + 1)
  return { callsite, invocation }
}

crypto.randomBytes = function deterministicBuildRandomBytes(size, callback) {
  if (!Number.isSafeInteger(size) || size < 0) throw new RangeError('size must be a non-negative safe integer')
  const { callsite, invocation } = callsiteInvocation(`randomBytes:${size}`)
  const chunks = []
  let generated = 0
  while (generated < size) {
    const block = createHmac('sha256', seed)
      .update(`dongphugia:public-worker-build-entropy:v1:${callsite}:${invocation}:${chunks.length}`)
      .digest()
    chunks.push(block)
    generated += block.byteLength
  }
  const value = Buffer.concat(chunks).subarray(0, size)
  if (typeof callback === 'function') {
    queueMicrotask(() => callback(null, value))
    return undefined
  }
  return value
}

crypto.randomUUID = function deterministicBuildRandomUuid() {
  const { callsite, invocation } = callsiteInvocation('randomUUID')
  const bytes = createHmac('sha256', seed)
    .update(`dongphugia:public-worker-build-uuid:v1:${callsite}:${invocation}`)
    .digest()
    .subarray(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

syncBuiltinESMExports()
