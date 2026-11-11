import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createOrderIntakeSignature,
  type OrderIntakeSignatureInput,
} from '../../../packages/app-contracts/src/order-intake-signature'
import { createOrderIntakeHandler } from './handler'

const secret = 'synthetic-order-intake-signing-secret-32-bytes'
const origin = 'https://pr-272-dongphugia-v1-public-preview.tranhuunguyenhuy.workers.dev'
const requestId = '8b96aecb-8c34-4c46-879f-292369aa961d'
const idempotencyKey = '11111111-1111-4111-8111-111111111111'
const input = {
  customer_name: 'Synthetic Guest',
  customer_phone: '0901234567',
  customer_email: '',
  customer_address: '',
  note: '',
  items: [{ productId: 42, sku: 'SKU-42-A', quantity: 2, installOption: 'none' }],
}
const bodyText = JSON.stringify(input)
const nowSeconds = 1_799_000_000

afterEach(() => {
  vi.restoreAllMocks()
})

async function signedRequest(method: 'GET' | 'POST', body = '') {
  const signatureInput: OrderIntakeSignatureInput = {
    method,
    path: '/functions/v1/order-intake',
    origin,
    requestId,
    idempotencyKey,
    timestamp: String(nowSeconds),
    bodyText: body,
  }
  const signature = await createOrderIntakeSignature(secret, signatureInput)
  return new Request(`https://project.supabase.co${signatureInput.path}`, {
    method,
    headers: {
      Origin: origin,
      apikey: 'sb_publishable_test_key',
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
      'X-Request-Id': requestId,
      'X-DPG-Order-Timestamp': signatureInput.timestamp,
      'X-DPG-Order-Signature': signature,
    },
    ...(method === 'POST' ? { body } : {}),
  })
}

describe('order-intake signed backend handler', () => {
  it('logs only a correlated configuration category when the signing secret is invalid', async () => {
    const diagnostics = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const database = { create: vi.fn(), receipt: vi.fn() }
    const handler = createOrderIntakeHandler({ database, signingSecret: 'short', nowSeconds: () => nowSeconds })
    const response = await handler(await signedRequest('GET'))

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: { code: 'ORDER_REQUEST_FAILED' } })
    expect(response.headers.get('x-request-id')).toBe(requestId)
    expect(diagnostics.mock.calls).toHaveLength(1)
    expect(diagnostics.mock.calls[0]?.[0]).toBe('ORDER_INTAKE_DIAGNOSTIC')
    expect(JSON.parse(String(diagnostics.mock.calls[0]?.[1]))).toEqual({
      requestId,
      operation: 'receipt',
      stage: 'configuration',
      status: 503,
    })
    expect(database.receipt).not.toHaveBeenCalled()
  })

  it('requires the exact SKU selected by the guest', async () => {
    const database = { create: vi.fn(), receipt: vi.fn() }
    const handler = createOrderIntakeHandler({ database, signingSecret: secret, nowSeconds: () => nowSeconds })
    const missingSkuBody = JSON.stringify({
      ...input,
      items: [{ productId: 42, quantity: 2, installOption: 'none' }],
    })
    const response = await handler(await signedRequest('POST', missingSkuBody))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: { code: 'INVALID_ITEM' } })
    expect(database.create).not.toHaveBeenCalled()
  })

  it('rejects direct public-key callers before any database operation', async () => {
    const database = { create: vi.fn(), receipt: vi.fn() }
    const handler = createOrderIntakeHandler({ database, signingSecret: secret, nowSeconds: () => nowSeconds })
    const response = await handler(new Request('https://project.supabase.co/functions/v1/order-intake', {
      method: 'POST',
      headers: {
        Origin: origin,
        apikey: 'sb_publishable_test_key',
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: bodyText,
    }))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: { code: 'UNAUTHORIZED' } })
    expect(database.create).not.toHaveBeenCalled()
    expect(database.receipt).not.toHaveBeenCalled()
  })

  it('passes only a valid signed request to the database adapter', async () => {
    const receipt = { order_number: 'DPG-261106-0000002A', status: 'pending', payment_status: 'unpaid' }
    const database = { create: vi.fn().mockResolvedValue(receipt), receipt: vi.fn() }
    const handler = createOrderIntakeHandler({ database, signingSecret: secret, nowSeconds: () => nowSeconds })
    const response = await handler(await signedRequest('POST', bodyText))

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ data: receipt })
    expect(database.create).toHaveBeenCalledWith(input, idempotencyKey, requestId)
    expect(database.receipt).not.toHaveBeenCalled()
  })

  it('preserves two selected SKUs of one Product as distinct request lines', async () => {
    const twoSkuInput = {
      ...input,
      items: [
        { productId: 42, sku: 'SKU-42-A', quantity: 1, installOption: 'none' },
        { productId: 42, sku: 'SKU-42-B', quantity: 1, installOption: 'none' },
      ],
    }
    const twoSkuBody = JSON.stringify(twoSkuInput)
    const receipt = { order_number: 'DPG-261106-0000002A', status: 'pending', payment_status: 'unpaid' }
    const database = { create: vi.fn().mockResolvedValue(receipt), receipt: vi.fn() }
    const handler = createOrderIntakeHandler({ database, signingSecret: secret, nowSeconds: () => nowSeconds })

    const response = await handler(await signedRequest('POST', twoSkuBody))

    expect(response.status).toBe(201)
    expect(database.create).toHaveBeenCalledWith(twoSkuInput, idempotencyKey, requestId)
  })

  it('rejects an altered signed payload without calling the database', async () => {
    const database = { create: vi.fn(), receipt: vi.fn() }
    const handler = createOrderIntakeHandler({ database, signingSecret: secret, nowSeconds: () => nowSeconds })
    const valid = await signedRequest('POST', bodyText)
    const changed = new Request(valid, { body: JSON.stringify({ ...input, note: 'tampered' }) })
    const response = await handler(changed)

    expect(response.status).toBe(401)
    expect(database.create).not.toHaveBeenCalled()
  })

  it('logs a correlated signature rejection without exposing signed request material', async () => {
    const diagnostics = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const database = { create: vi.fn(), receipt: vi.fn() }
    const handler = createOrderIntakeHandler({ database, signingSecret: secret, nowSeconds: () => nowSeconds })
    const valid = await signedRequest('GET')
    const headers = new Headers(valid.headers)
    headers.set('X-DPG-Order-Signature', 'a'.repeat(64))
    const response = await handler(new Request(valid, { headers }))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: { code: 'UNAUTHORIZED' } })
    expect(response.headers.get('x-request-id')).toBe(requestId)
    expect(diagnostics.mock.calls).toHaveLength(1)
    expect(diagnostics.mock.calls[0]?.[0]).toBe('ORDER_INTAKE_DIAGNOSTIC')
    const event = JSON.parse(String(diagnostics.mock.calls[0]?.[1]))
    expect(event).toEqual({ requestId, operation: 'receipt', stage: 'signature', status: 401 })
    const logged = JSON.stringify(diagnostics.mock.calls)
    expect(logged).not.toContain(secret)
    expect(logged).not.toContain(idempotencyKey)
    expect(logged).not.toContain(origin)
    expect(logged).not.toContain('a'.repeat(64))
    expect(database.receipt).not.toHaveBeenCalled()
  })

  it('logs only a correlated database category when receipt storage fails', async () => {
    const diagnostics = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const databaseError = 'postgres://private.invalid/?password=DB_PRIVATE'
    const database = { create: vi.fn(), receipt: vi.fn().mockRejectedValue(new Error(databaseError)) }
    const handler = createOrderIntakeHandler({ database, signingSecret: secret, nowSeconds: () => nowSeconds })
    const response = await handler(await signedRequest('GET'))

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: { code: 'ORDER_REQUEST_FAILED' } })
    expect(response.headers.get('x-request-id')).toBe(requestId)
    expect(diagnostics.mock.calls).toHaveLength(1)
    expect(diagnostics.mock.calls[0]?.[0]).toBe('ORDER_INTAKE_DIAGNOSTIC')
    const event = JSON.parse(String(diagnostics.mock.calls[0]?.[1]))
    expect(event).toEqual({ requestId, operation: 'receipt', stage: 'database', status: 503 })
    expect(JSON.stringify(diagnostics.mock.calls)).not.toContain(databaseError)
  })

  it('logs a safe decode category when order persistence returns an invalid receipt', async () => {
    const diagnostics = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const database = { create: vi.fn().mockResolvedValue({ order_number: 'PRIVATE_INVALID_RECEIPT' }), receipt: vi.fn() }
    const handler = createOrderIntakeHandler({ database, signingSecret: secret, nowSeconds: () => nowSeconds })
    const response = await handler(await signedRequest('POST', bodyText))

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: { code: 'ORDER_REQUEST_FAILED' } })
    expect(response.headers.get('x-request-id')).toBe(requestId)
    expect(diagnostics.mock.calls).toHaveLength(1)
    expect(diagnostics.mock.calls[0]?.[0]).toBe('ORDER_INTAKE_DIAGNOSTIC')
    expect(JSON.parse(String(diagnostics.mock.calls[0]?.[1]))).toEqual({
      requestId,
      operation: 'submit',
      stage: 'decode',
      status: 503,
    })
    expect(JSON.stringify(diagnostics.mock.calls)).not.toContain('PRIVATE_INVALID_RECEIPT')
  })

  it('verifies a signed receipt read and returns only the safe receipt fields', async () => {
    const receipt = { order_number: 'DPG-261106-0000002A', status: 'pending', payment_status: 'unpaid' }
    const database = { create: vi.fn(), receipt: vi.fn().mockResolvedValue(receipt) }
    const handler = createOrderIntakeHandler({ database, signingSecret: secret, nowSeconds: () => nowSeconds })
    const response = await handler(await signedRequest('GET'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: receipt })
    expect(database.receipt).toHaveBeenCalledWith(idempotencyKey)
    expect(database.create).not.toHaveBeenCalled()
  })

  it('logs a safe decode category when receipt storage returns an invalid shape', async () => {
    const diagnostics = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const database = { create: vi.fn(), receipt: vi.fn().mockResolvedValue({ order_number: 'PRIVATE_INVALID_RECEIPT' }) }
    const handler = createOrderIntakeHandler({ database, signingSecret: secret, nowSeconds: () => nowSeconds })
    const response = await handler(await signedRequest('GET'))

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: { code: 'ORDER_REQUEST_FAILED' } })
    expect(response.headers.get('x-request-id')).toBe(requestId)
    expect(diagnostics.mock.calls).toHaveLength(1)
    expect(JSON.parse(String(diagnostics.mock.calls[0]?.[1]))).toEqual({
      requestId,
      operation: 'receipt',
      stage: 'decode',
      status: 503,
    })
    expect(JSON.stringify(diagnostics.mock.calls)).not.toContain('PRIVATE_INVALID_RECEIPT')
  })

  it('allows signed loopback requests for isolated local browser acceptance', async () => {
    const receipt = { order_number: 'DPG-261106-0000002A', status: 'pending', payment_status: 'unpaid' }
    const database = { create: vi.fn().mockResolvedValue(receipt), receipt: vi.fn() }
    const handler = createOrderIntakeHandler({ database, signingSecret: secret, nowSeconds: () => nowSeconds })
    const localInput: OrderIntakeSignatureInput = {
      method: 'POST',
      path: '/functions/v1/order-intake',
      origin: 'http://127.0.0.1:3000',
      requestId,
      idempotencyKey,
      timestamp: String(nowSeconds),
      bodyText,
    }
    const signature = await createOrderIntakeSignature(secret, localInput)
    const response = await handler(new Request('http://127.0.0.1:54321/functions/v1/order-intake', {
      method: 'POST',
      headers: {
        Origin: localInput.origin,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
        'X-Request-Id': requestId,
        'X-DPG-Order-Timestamp': localInput.timestamp,
        'X-DPG-Order-Signature': signature,
      },
      body: bodyText,
    }))

    expect(response.status).toBe(201)
    expect(database.create).toHaveBeenCalledWith(input, idempotencyKey, requestId)
  })
})
