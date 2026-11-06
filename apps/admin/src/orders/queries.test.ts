import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { rpc, createAdminServerClient } = vi.hoisted(() => ({
  rpc: vi.fn(),
  createAdminServerClient: vi.fn(),
}))

vi.mock('../supabase/server', () => ({ createAdminServerClient }))

import { getOrderInbox } from './queries'

describe('Admin order inbox query', () => {
  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ data: { orders: [], total: 0 }, error: null })
    createAdminServerClient.mockReset().mockResolvedValue({ schema: () => ({ rpc }) })
  })

  it('uses the bounded server search RPC with status, query, and pagination', async () => {
    await expect(getOrderInbox({ status: 'pending', search: 'DPG-261106', limit: 25, offset: 50 })).resolves.toEqual({ orders: [], total: 0 })
    expect(rpc).toHaveBeenCalledWith('phase2_admin_order_search', {
      p_status: 'pending', p_search: 'DPG-261106', p_limit: 25, p_offset: 50,
    })
  })

  it('fails closed when the authenticated RPC rejects the request', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'FORBIDDEN' } })
    await expect(getOrderInbox({ status: null, search: '', limit: 25, offset: 0 })).resolves.toBeNull()
  })
})
