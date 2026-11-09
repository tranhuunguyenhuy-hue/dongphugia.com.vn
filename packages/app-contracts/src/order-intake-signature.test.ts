import { describe, expect, it } from 'vitest'

import {
  createOrderIntakeSignature,
  verifyOrderIntakeSignature,
  type OrderIntakeSignatureInput,
} from './order-intake-signature'

const secret = 'synthetic-order-intake-signing-secret-32-bytes'
const nowSeconds = 1_799_000_000
const request: OrderIntakeSignatureInput = {
  method: 'POST',
  path: '/functions/v1/order-intake',
  origin: 'https://pr-272-dongphugia-v1-public-preview.tranhuunguyenhuy.workers.dev',
  requestId: '8b96aecb-8c34-4c46-879f-292369aa961d',
  idempotencyKey: '11111111-1111-4111-8111-111111111111',
  timestamp: String(nowSeconds),
  bodyText: '{"customer_name":"Synthetic","items":[{"productId":42,"quantity":2}]}',
}

describe('signed Worker-to-order-intake request contract', () => {
  it('authenticates the exact method, path, origin, request id, idempotency key, and body', async () => {
    const signature = await createOrderIntakeSignature(secret, request)

    await expect(verifyOrderIntakeSignature(secret, request, signature, nowSeconds)).resolves.toBe(true)
    await expect(verifyOrderIntakeSignature(secret, { ...request, bodyText: `${request.bodyText} ` }, signature, nowSeconds)).resolves.toBe(false)
    await expect(verifyOrderIntakeSignature(secret, { ...request, origin: 'https://attacker.invalid' }, signature, nowSeconds)).resolves.toBe(false)
    await expect(verifyOrderIntakeSignature(secret, { ...request, idempotencyKey: '22222222-2222-4222-8222-222222222222' }, signature, nowSeconds)).resolves.toBe(false)
  })

  it('rejects signatures outside the short clock window or with invalid metadata', async () => {
    const signature = await createOrderIntakeSignature(secret, request)

    await expect(verifyOrderIntakeSignature(secret, request, signature, nowSeconds + 61)).resolves.toBe(false)
    const invalidMethod = { ...request, method: 'DELETE' } as unknown as OrderIntakeSignatureInput
    await expect(verifyOrderIntakeSignature(secret, invalidMethod, signature, nowSeconds)).resolves.toBe(false)
    await expect(verifyOrderIntakeSignature('short', request, signature, nowSeconds)).resolves.toBe(false)
    await expect(verifyOrderIntakeSignature(secret, request, 'not-a-signature', nowSeconds)).resolves.toBe(false)
    await expect(createOrderIntakeSignature(secret, { ...request, origin: 'http://external.invalid' }))
      .rejects.toThrow('ORDER_INTAKE_SIGNING_CONFIG_INVALID')
  })

  it('allows plain HTTP only for loopback origins used by isolated local E2E', async () => {
    const localRequest = { ...request, origin: 'http://127.0.0.1:3000' }
    const signature = await createOrderIntakeSignature(secret, localRequest)

    await expect(verifyOrderIntakeSignature(secret, localRequest, signature, nowSeconds)).resolves.toBe(true)
  })
})
