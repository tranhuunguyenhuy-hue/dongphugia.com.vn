import { describe, expect, it, vi } from 'vitest'

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
  items: [{ productId: 42, quantity: 2, installOption: 'none' }],
}
const bodyText = JSON.stringify(input)
const nowSeconds = 1_799_000_000

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

  it('rejects an altered signed payload without calling the database', async () => {
    const database = { create: vi.fn(), receipt: vi.fn() }
    const handler = createOrderIntakeHandler({ database, signingSecret: secret, nowSeconds: () => nowSeconds })
    const valid = await signedRequest('POST', bodyText)
    const changed = new Request(valid, { body: JSON.stringify({ ...input, note: 'tampered' }) })
    const response = await handler(changed)

    expect(response.status).toBe(401)
    expect(database.create).not.toHaveBeenCalled()
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
