import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RateLimit } from '@cloudflare/workers-types'
import { verifyOrderIntakeSignature } from '../../../../packages/app-contracts/src/order-intake-signature'

import { handleGuestOrderReceiptRequest, handleGuestOrderRequest } from './guest-order-request'

afterEach(() => {
  vi.restoreAllMocks()
})

const environment = {
  PUBLIC_ORDER_INTAKE_URL: 'https://demo.supabase.co/functions/v1/order-intake',
  PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_key',
  ORDER_INTAKE_SIGNING_SECRET: 'synthetic-order-intake-signing-secret-32-bytes',
}

const validBody = {
  customer_name: 'Nguyễn Văn A',
  customer_phone: '090 123 4567',
  customer_email: '',
  customer_address: '',
  note: '',
  items: [{ productId: 42, sku: 'SKU-42-A', quantity: 2, installOption: 'none' }],
}

function createRequest(body: unknown = validBody, origin = 'https://preview.invalid') {
  return new Request('https://preview.invalid/api/order-requests', {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'application/json',
      'Idempotency-Key': '8b96aecb-8c34-4c46-879f-292369aa961d',
      'X-DPG-Order-Timestamp': '0000000000',
      'X-DPG-Order-Signature': 'caller-forged-signature',
    },
    body: JSON.stringify(body),
  })
}

function createReceiptRequest(key = '8b96aecb-8c34-4c46-879f-292369aa961d', origin = 'https://preview.invalid') {
  return new Request('https://preview.invalid/api/order-requests/receipt', {
    method: 'GET',
    headers: { Origin: origin, 'Idempotency-Key': key },
  })
}

function expectReceiptDiagnostic(
  calls: unknown[][],
  stage: string,
  upstreamStatus?: number,
) {
  expect(calls).toHaveLength(1)
  expect(calls[0]?.[0]).toBe('PUBLIC_ORDER_INTAKE_DIAGNOSTIC')
  const event = JSON.parse(String(calls[0]?.[1])) as Record<string, unknown>
  expect(event).toEqual({
    requestId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
    operation: 'receipt',
    stage,
    ...(upstreamStatus === undefined ? {} : { upstreamStatus }),
  })
  return event
}

describe('POST /api/order-requests Worker adapter', () => {
  let limiter: { limit: ReturnType<typeof vi.fn> }
  let fetcher: ReturnType<typeof vi.fn>

  beforeEach(() => {
    limiter = { limit: vi.fn().mockResolvedValue({ success: true }) }
    fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'GET') return Response.json({ data: null }, { status: 200 })
      return Response.json({
        data: {
          order_number: 'DPG-261104-0000002A',
          status: 'pending',
          payment_status: 'unpaid',
          customer_phone: 'private',
          total: 123456,
        },
      }, { status: 201 })
    })
  })

  it('forwards only an allowed guest request with a hashed phone limit key', async () => {
    const response = await handleGuestOrderRequest(
      createRequest(),
      { ...environment, ORDER_REQUEST_LIMITER: limiter as unknown as RateLimit },
      fetcher as unknown as typeof fetch,
    )
    const body = await response.json()
    const options = fetcher.mock.calls[1]?.[1] as RequestInit
    const headers = new Headers(options.headers)

    expect(response.status).toBe(201)
    expect(body).toEqual({
      data: { order_number: 'DPG-261104-0000002A', status: 'pending', payment_status: 'unpaid' },
    })
    expect(limiter.limit).toHaveBeenCalledTimes(2)
    expect(limiter.limit.mock.calls[0]?.[0].key).toMatch(/^guest-order-request-ip:/)
    expect(limiter.limit.mock.calls[1]?.[0].key).toMatch(/^guest-order-phone:/)
    expect(limiter.limit.mock.calls[1]?.[0].key).not.toContain('0901234567')
    expect(headers.get('apikey')).toBe(environment.PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    expect(headers.has('authorization')).toBe(false)
    expect(headers.get('idempotency-key')).toBe('8b96aecb-8c34-4c46-879f-292369aa961d')
    expect(JSON.parse(String(options.body))).toEqual(validBody)
    expect((fetcher.mock.calls[0]?.[1] as RequestInit).method).toBe('GET')
    expect(await verifyOrderIntakeSignature(environment.ORDER_INTAKE_SIGNING_SECRET, {
      method: 'POST',
      path: '/functions/v1/order-intake',
      origin: 'https://preview.invalid',
      requestId: headers.get('x-request-id')!,
      idempotencyKey: headers.get('idempotency-key')!,
      timestamp: headers.get('x-dpg-order-timestamp')!,
      bodyText: String(options.body),
    }, headers.get('x-dpg-order-signature')!)).toBe(true)
    expect(headers.get('x-dpg-order-signature')).not.toBe('caller-forged-signature')
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

  it('replays an existing receipt before the phone rate limit and strips upstream extras', async () => {
    fetcher.mockImplementationOnce(async () => Response.json({
      data: {
        order_number: 'DPG-261104-0000002A',
        status: 'pending',
        payment_status: 'unpaid',
        customer_phone: 'private',
      },
    }, { status: 200 }))
    const response = await handleGuestOrderRequest(
      createRequest(),
      { ...environment, ORDER_REQUEST_LIMITER: limiter as unknown as RateLimit },
      fetcher as unknown as typeof fetch,
    )

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({
      data: { order_number: 'DPG-261104-0000002A', status: 'pending', payment_status: 'unpaid' },
    })
    expect(limiter.limit).toHaveBeenCalledOnce()
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect((fetcher.mock.calls[1]?.[1] as RequestInit).method).toBe('POST')
  })

  it('does not expose an unrecognized upstream response', async () => {
    fetcher
      .mockResolvedValueOnce(Response.json({ data: null }, { status: 200 }))
      .mockResolvedValueOnce(Response.json({ error: { code: 'DATABASE_ERROR', details: 'private' } }, { status: 500 }))
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

  it('returns a safe conflict when an idempotency key is reused with changed input', async () => {
    fetcher
      .mockResolvedValueOnce(Response.json({ data: null }, { status: 200 }))
      .mockResolvedValueOnce(Response.json(
        { error: { code: 'IDEMPOTENCY_KEY_REUSED', details: 'private' } },
        { status: 409 },
      ))

    const response = await handleGuestOrderRequest(
      createRequest({ ...validBody, note: 'changed request' }),
      { ...environment, ORDER_REQUEST_LIMITER: limiter as unknown as RateLimit },
      fetcher as unknown as typeof fetch,
    )

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: { code: 'IDEMPOTENCY_KEY_REUSED' } })
  })
})

describe('GET /api/order-requests/receipt Worker adapter', () => {
  let limiter: { limit: ReturnType<typeof vi.fn> }
  let fetcher: ReturnType<typeof vi.fn>

  beforeEach(() => {
    limiter = { limit: vi.fn().mockResolvedValue({ success: true }) }
    fetcher = vi.fn().mockResolvedValue(Response.json({
      data: {
        order_number: 'DPG-261104-0000002A',
        status: 'pending',
        payment_status: 'unpaid',
        customer_email: 'private@example.invalid',
        total: 123456,
      },
    }, { status: 200 }))
  })

  it('returns only a verified minimal receipt for a valid bearer key', async () => {
    const response = await handleGuestOrderReceiptRequest(
      createReceiptRequest(),
      { ...environment, ORDER_REQUEST_LIMITER: limiter as unknown as RateLimit },
      fetcher as unknown as typeof fetch,
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      data: { order_number: 'DPG-261104-0000002A', status: 'pending', payment_status: 'unpaid' },
    })
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(fetcher).toHaveBeenCalledOnce()
    expect((fetcher.mock.calls[0]?.[1] as RequestInit).method).toBe('GET')
    const headers = new Headers((fetcher.mock.calls[0]?.[1] as RequestInit).headers)
    expect(await verifyOrderIntakeSignature(environment.ORDER_INTAKE_SIGNING_SECRET, {
      method: 'GET',
      path: '/functions/v1/order-intake',
      origin: 'https://preview.invalid',
      requestId: headers.get('x-request-id')!,
      idempotencyKey: headers.get('idempotency-key')!,
      timestamp: headers.get('x-dpg-order-timestamp')!,
      bodyText: '',
    }, headers.get('x-dpg-order-signature')!)).toBe(true)
  })

  it('returns an empty receipt when the key has no persisted record', async () => {
    fetcher.mockResolvedValueOnce(Response.json({ data: null }, { status: 200 }))
    const response = await handleGuestOrderReceiptRequest(
      createReceiptRequest(),
      { ...environment, ORDER_REQUEST_LIMITER: limiter as unknown as RateLimit },
      fetcher as unknown as typeof fetch,
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: null })
  })

  it('rejects an invalid bearer key and cross-origin lookup before forwarding', async () => {
    const invalidKeyResponse = await handleGuestOrderReceiptRequest(
      createReceiptRequest('not-a-random-key'),
      { ...environment, ORDER_REQUEST_LIMITER: limiter as unknown as RateLimit },
      fetcher as unknown as typeof fetch,
    )
    const crossOriginResponse = await handleGuestOrderReceiptRequest(
      createReceiptRequest(undefined, 'https://attacker.invalid'),
      { ...environment, ORDER_REQUEST_LIMITER: limiter as unknown as RateLimit },
      fetcher as unknown as typeof fetch,
    )

    expect(invalidKeyResponse.status).toBe(400)
    expect(crossOriginResponse.status).toBe(403)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('logs only a correlated configuration category while keeping the public failure generic', async () => {
    const diagnostics = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const response = await handleGuestOrderReceiptRequest(
      createReceiptRequest(),
      {
        ...environment,
        PUBLIC_ORDER_INTAKE_URL: `${environment.PUBLIC_ORDER_INTAKE_URL}?token=CONFIG_SECRET`,
        ORDER_REQUEST_LIMITER: limiter as unknown as RateLimit,
      },
      fetcher as unknown as typeof fetch,
    )

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: { code: 'ORDER_INTAKE_UNAVAILABLE' } })
    const event = expectReceiptDiagnostic(diagnostics.mock.calls, 'configuration')
    expect(response.headers.get('x-request-id')).toBe(event.requestId)
    expect(JSON.stringify(diagnostics.mock.calls)).not.toContain('CONFIG_SECRET')
    expect(JSON.stringify(diagnostics.mock.calls)).not.toContain('demo.supabase.co')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('logs a signing category without including signing or request material', async () => {
    const diagnostics = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(crypto.subtle, 'importKey').mockRejectedValue(new Error('PRIVATE_SIGNING_FAILURE'))
    const response = await handleGuestOrderReceiptRequest(
      createReceiptRequest(),
      { ...environment, ORDER_REQUEST_LIMITER: limiter as unknown as RateLimit },
      fetcher as unknown as typeof fetch,
    )

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: { code: 'ORDER_INTAKE_UNAVAILABLE' } })
    const event = expectReceiptDiagnostic(diagnostics.mock.calls, 'signing')
    expect(response.headers.get('x-request-id')).toBe(event.requestId)
    const logged = JSON.stringify(diagnostics.mock.calls)
    expect(logged).not.toContain('PRIVATE_SIGNING_FAILURE')
    expect(logged).not.toContain(environment.ORDER_INTAKE_SIGNING_SECRET)
    expect(logged).not.toContain('demo.supabase.co')
    expect(logged).not.toContain('8b96aecb-8c34-4c46-879f-292369aa961d')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('logs a fetch category without leaking the thrown upstream error', async () => {
    const diagnostics = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    fetcher.mockRejectedValueOnce(new Error('https://private.invalid/?token=FETCH_SECRET'))
    const response = await handleGuestOrderReceiptRequest(
      createReceiptRequest(),
      { ...environment, ORDER_REQUEST_LIMITER: limiter as unknown as RateLimit },
      fetcher as unknown as typeof fetch,
    )

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: { code: 'ORDER_INTAKE_UNAVAILABLE' } })
    const event = expectReceiptDiagnostic(diagnostics.mock.calls, 'fetch')
    expect(response.headers.get('x-request-id')).toBe(event.requestId)
    expect(JSON.stringify(diagnostics.mock.calls)).not.toContain('FETCH_SECRET')
    expect(JSON.stringify(diagnostics.mock.calls)).not.toContain('private.invalid')
  })

  it('logs only upstream status for a non-success Edge response', async () => {
    const diagnostics = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    fetcher.mockResolvedValueOnce(Response.json({ error: { code: 'UNAUTHORIZED', details: 'EDGE_PRIVATE' } }, { status: 401 }))
    const response = await handleGuestOrderReceiptRequest(
      createReceiptRequest(),
      { ...environment, ORDER_REQUEST_LIMITER: limiter as unknown as RateLimit },
      fetcher as unknown as typeof fetch,
    )

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: { code: 'ORDER_INTAKE_UNAVAILABLE' } })
    const event = expectReceiptDiagnostic(diagnostics.mock.calls, 'edge_status', 401)
    expect(response.headers.get('x-request-id')).toBe(event.requestId)
    expect(JSON.stringify(diagnostics.mock.calls)).not.toContain('UNAUTHORIZED')
    expect(JSON.stringify(diagnostics.mock.calls)).not.toContain('EDGE_PRIVATE')
  })

  it('logs a decode category without exposing an invalid upstream body', async () => {
    const diagnostics = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    fetcher.mockResolvedValueOnce(new Response('PRIVATE_INVALID_JSON', { status: 200 }))
    const response = await handleGuestOrderReceiptRequest(
      createReceiptRequest(),
      { ...environment, ORDER_REQUEST_LIMITER: limiter as unknown as RateLimit },
      fetcher as unknown as typeof fetch,
    )

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: { code: 'ORDER_INTAKE_UNAVAILABLE' } })
    const event = expectReceiptDiagnostic(diagnostics.mock.calls, 'decode', 200)
    expect(response.headers.get('x-request-id')).toBe(event.requestId)
    expect(JSON.stringify(diagnostics.mock.calls)).not.toContain('PRIVATE_INVALID_JSON')
  })

  it('logs a decode category when an upstream receipt has an invalid shape', async () => {
    const diagnostics = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    fetcher.mockResolvedValueOnce(Response.json({ data: { order_number: 'PRIVATE_INVALID_RECEIPT' } }, { status: 200 }))
    const response = await handleGuestOrderReceiptRequest(
      createReceiptRequest(),
      { ...environment, ORDER_REQUEST_LIMITER: limiter as unknown as RateLimit },
      fetcher as unknown as typeof fetch,
    )

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: { code: 'ORDER_INTAKE_UNAVAILABLE' } })
    const event = expectReceiptDiagnostic(diagnostics.mock.calls, 'decode', 200)
    expect(response.headers.get('x-request-id')).toBe(event.requestId)
    expect(JSON.stringify(diagnostics.mock.calls)).not.toContain('PRIVATE_INVALID_RECEIPT')
  })

  it('rejects a successful upstream response that omits the receipt envelope', async () => {
    const diagnostics = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    fetcher.mockResolvedValueOnce(Response.json({ private: 'PRIVATE_MALFORMED_RESPONSE' }, { status: 200 }))
    const response = await handleGuestOrderReceiptRequest(
      createReceiptRequest(),
      { ...environment, ORDER_REQUEST_LIMITER: limiter as unknown as RateLimit },
      fetcher as unknown as typeof fetch,
    )

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: { code: 'ORDER_INTAKE_UNAVAILABLE' } })
    expectReceiptDiagnostic(diagnostics.mock.calls, 'decode', 200)
    expect(JSON.stringify(diagnostics.mock.calls)).not.toContain('PRIVATE_MALFORMED_RESPONSE')
  })

  it('rejects a successful upstream response with a non-object receipt envelope', async () => {
    const diagnostics = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    fetcher.mockResolvedValueOnce(Response.json(null, { status: 200 }))
    const response = await handleGuestOrderReceiptRequest(
      createReceiptRequest(),
      { ...environment, ORDER_REQUEST_LIMITER: limiter as unknown as RateLimit },
      fetcher as unknown as typeof fetch,
    )

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: { code: 'ORDER_INTAKE_UNAVAILABLE' } })
    expectReceiptDiagnostic(diagnostics.mock.calls, 'decode', 200)
  })

  it('keeps order submission generic and logs only the correlated fetch category', async () => {
    const diagnostics = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    fetcher
      .mockResolvedValueOnce(Response.json({ data: null }, { status: 200 }))
      .mockRejectedValueOnce(new Error('CUSTOMER_BODY_SECRET'))
    const response = await handleGuestOrderRequest(
      createRequest(),
      { ...environment, ORDER_REQUEST_LIMITER: limiter as unknown as RateLimit },
      fetcher as unknown as typeof fetch,
    )

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: { code: 'ORDER_INTAKE_UNAVAILABLE' } })
    expect(diagnostics.mock.calls).toHaveLength(1)
    expect(diagnostics.mock.calls[0]?.[0]).toBe('PUBLIC_ORDER_INTAKE_DIAGNOSTIC')
    const event = JSON.parse(String(diagnostics.mock.calls[0]?.[1]))
    expect(event).toEqual({
      requestId: response.headers.get('x-request-id'),
      operation: 'submit',
      stage: 'fetch',
    })
    expect(JSON.stringify(diagnostics.mock.calls)).not.toContain('CUSTOMER_BODY_SECRET')
    expect(JSON.stringify(diagnostics.mock.calls)).not.toContain(JSON.stringify(validBody))
  })
  it('keeps intake diagnostics out of public response headers', async () => {
    const diagnostics = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    fetcher.mockResolvedValueOnce(Response.json({ private: 'DO_NOT_EXPOSE' }, { status: 401 }))
    const response = await handleGuestOrderReceiptRequest(
      createReceiptRequest(),
      { ...environment, ORDER_REQUEST_LIMITER: limiter as unknown as RateLimit },
      fetcher as unknown as typeof fetch,
    )
    expect(response.status).toBe(503)
    expect(response.headers.get('x-dpg-intake-stage')).toBeNull()
    expect(response.headers.get('x-dpg-intake-upstream-status')).toBeNull()
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(await response.json()).toEqual({ error: { code: 'ORDER_INTAKE_UNAVAILABLE' } })
    expectReceiptDiagnostic(diagnostics.mock.calls, 'edge_status', 401)
  })

  it('keeps limiter exceptions fail-closed without attempting an upstream fetch', async () => {
    const diagnostics = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    limiter.limit.mockRejectedValueOnce(new Error('PRIVATE_LIMITER_ERROR'))
    const response = await handleGuestOrderReceiptRequest(
      createReceiptRequest(),
      { ...environment, ORDER_REQUEST_LIMITER: limiter as unknown as RateLimit },
      fetcher as unknown as typeof fetch,
    )
    expect(response.status).toBe(503)
    expect(response.headers.get('x-dpg-intake-stage')).toBeNull()
    expect(response.headers.get('x-dpg-intake-upstream-status')).toBeNull()
    expectReceiptDiagnostic(diagnostics.mock.calls, 'limiter')
    expect(fetcher).not.toHaveBeenCalled()
    expect(JSON.stringify(diagnostics.mock.calls)).not.toContain('PRIVATE_LIMITER_ERROR')
  })

})
