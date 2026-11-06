import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { rpc, createAdminServerClient } = vi.hoisted(() => ({
  rpc: vi.fn(),
  createAdminServerClient: vi.fn(),
}))

vi.mock('../supabase/server', () => ({ createAdminServerClient }))

import { getAdminProductCatalogue } from './queries'

describe('Admin Product catalogue query', () => {
  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ data: { products: [], total: 0 }, error: null })
    createAdminServerClient.mockReset().mockResolvedValue({ schema: () => ({ rpc }) })
  })

  it('uses the authenticated Product catalogue RPC with bounded filters', async () => {
    await expect(getAdminProductCatalogue({ search: 'SKU-1', publicationStatus: 'draft', limit: 25, offset: 0 })).resolves.toEqual({ products: [], total: 0 })
    expect(rpc).toHaveBeenCalledWith('phase2_admin_product_catalogue', {
      p_product_id: null, p_search: 'SKU-1', p_publication_status: 'draft', p_limit: 25, p_offset: 0,
    })
  })

  it('does not return payloads on denied or unavailable reads', async () => {
    rpc.mockResolvedValue({ data: { products: [], total: 0 }, error: { message: 'FORBIDDEN' } })
    await expect(getAdminProductCatalogue({ productId: 7 })).resolves.toBeNull()
  })
})
