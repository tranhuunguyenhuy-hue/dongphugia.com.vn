import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RateLimit } from '@cloudflare/workers-types'

import { handleGuestOrderRequest } from './guest-order-request'

const environment = {
  PUBLIC_ORDER_INTAKE_URL: 'https://demo.supabase.co/functions/v1/order-intake',
  PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_key',
}

const validBody = {
  customer_name: 'Nguyễn Văn A',
  customer_phone: '090 123 4567',
  customer_email: '',
  customer_address: '',
  note: '',
  items: [{ productId: 42, quantity: 2, installOption: 'none' }],
}

function createRequest(body: unknown = validBody, origin = 'https://preview.invalid') {
  return new Request('https://preview.invalid/api/order-requests', {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'application/json',
      'Idempotency-Key': '8b96aecb-8c34-4c46-079f-292369aa961d',
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/order-requests Worker adapter', () => {
  let limiter: { limit: ReturnType<typeof vi.fn> }
  let fetcher: ReturnType<typeof vi.fn>

  beforeEach(() => {
    limiter = { limit: vi.fn().mockResolvedValue({ success: true }) }
    fetcher = vi.fn().mockResolvedValue(Response.json({
      data: { order_number: 'DPG-261104-0000002A', status: 'pending', payment_status: 'unpaid' },
    }, { status: 201 }))
  })

  it('forwards only an allowed guest request with a hashed phone limit key', async () => {
    const response = await handleGuestOrderRequest(
      createRequest(),
      { ...environment, ORDER_REQUEST_LIMITER: limiter as unknown as RateLimit },
      fetcher as unknown as typeof fetch,
    )
    const body = await response.json()
    const options = fetcher.mock.calls[0]?.[1] as RequestInit
    const headers = new Headers(options.headers)

    expect(response.status).toBe(201)
    expect(body).toEqual({
      data: { order_number: 'DPG-261104-0000002A', status: 'pending', payment_status: 'unpaid' },
    })
    expect(limiter.limit).toHaveBeenCalledOnce()
    expect(limiter.limit.mock.calls[0]?.[0].key).not.toContain('0901234567')
    expect(headers.get('apikey')).toBe(environment.PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    expect(headers.has('authorization')).toBe(false)
    expect(headers.get('idempotency-key')).toBe('8b96aecb-8c34-4c46-079f-292369aa961d')
    expect(JSON.parse(String(options.body))).toEqual(validBody)
  })

  it('rejects a cross-origin caller before forwarding', async () => {
    const response = await handleGuestOrderRequest(
      createRequest(validBody, 'https://other.invalid'),
      { ...environment, ORDER_REQUEST_LIMITER: limiter as unknown as RateLimit },
      fetcher as unknown as typeof fetch,
    )

    expect(response.status).toBe(403)
    expect(fetcher).not.toHaveBeenCalled()
    expect(limiter.limit).not.toHaveBeenCalled()
  })

  it('fails closed when the public intake configuration is absent', async () => {
    const response = await handleGuestOrderRequest(
      createRequest(),
      { ORDER_REQUEST_LIMITER: limiter as unknown as RateLimit },
      fetcher as unknown as typeof fetch,
    )

    expect(response.status).toBe(503)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('blocks a rate-limited request without calling the Supabase function', async () => {
    limiter.limit.mockResolvedValueOnce({ success: false })
    const response = await handleGuestOrderRequest(
      createRequest(),
      { ...environment, ORDER_REQUEST_LIMITER: limiter as unknown as RateLimit },
      fetcher as unknown as typeof fetch,
    )
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body).toEqual({ error: { code: 'ORDER_RATE_LIMITED' } })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('does not expose an unrecognized upstream response', async () => {
    fetcher.mockResolvedValueOnce(Response.json({ error: { code: 'DATABASE_ERROR', details: 'private' } }, { status: 500 }))
    const response = await handleGuestOrderRequest(
      createRequest(),
      { ...environment, ORDER_REQUEST_LIMITER: limiter as unknown as RateLimit },
      fetcher as unknown as typeof fetch,
    )
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body).toEqual({ error: { code: 'ORDER_INTAKE_FAILED' } })
    expect(JSON.stringify(body)).not.toContain('private')
  })
})
