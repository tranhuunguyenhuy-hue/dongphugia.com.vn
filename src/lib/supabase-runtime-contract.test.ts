import { describe, expect, it, vi } from 'vitest'
import {
  SUPABASE_RUNTIME_CONTRACT_VERSION,
  SUPABASE_RUNTIME_ENDPOINTS,
  SupabaseRuntimeApiError,
  createSupabaseRuntimeClient,
} from './supabase-runtime-contract'

describe('Supabase runtime client contract', () => {
  it('uses authenticated Edge Function endpoints and idempotency headers', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: { order_id: 7 } }), { status: 201 }))
    const client = createSupabaseRuntimeClient({ baseUrl: 'https://runtime.example/', getAccessToken: () => 'jwt-token', fetchImpl })

    const result = await client.orders.create({
      customer_name: 'Synthetic Owner', customer_phone: '+84123456789',
      items: [{ productId: 1, quantity: 1, installOption: 'none' }],
    }, 'order-replay-1')

    expect(result.order_id).toBe(7)
    expect(fetchImpl).toHaveBeenCalledWith(
      `https://runtime.example/functions/v1/${SUPABASE_RUNTIME_ENDPOINTS.orders}`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.any(Headers),
      }),
    )
    const request = fetchImpl.mock.calls[0]?.[1]
    const headers = request?.headers as Headers
    expect(headers.get('Authorization')).toBe('Bearer jwt-token')
    expect(headers.get('Idempotency-Key')).toBe('order-replay-1')
    expect(client.contractVersion).toBe(SUPABASE_RUNTIME_CONTRACT_VERSION)
  })

  it('does not accept an absent access token or leak opaque response text', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
    const client = createSupabaseRuntimeClient({ baseUrl: 'https://runtime.example', getAccessToken: () => '', fetchImpl })
    await expect(client.quotes.create({ name: 'Owner', phone: '123456789', products: [{ product_id: 1, quantity: 1 }] }, 'quote-replay-1'))
      .rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' })
    expect(fetchImpl).not.toHaveBeenCalled()

    const errorFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response('secret database details', { status: 500 }))
    const errorClient = createSupabaseRuntimeClient({ baseUrl: 'https://runtime.example', getAccessToken: () => 'jwt-token', fetchImpl: errorFetch })
    await expect(errorClient.quotes.get(1)).rejects.toEqual(expect.objectContaining({ code: 'RUNTIME_OPERATION_FAILED' }))
    try { await errorClient.quotes.get(1) } catch (error) {
      expect(error).toBeInstanceOf(SupabaseRuntimeApiError)
      expect(String(error)).not.toContain('secret database details')
    }
  })
})
