import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { requireActiveStaff, getAdminProductCatalogue, createAdminServerClient, rpc, redirect, revalidatePath } = vi.hoisted(() => ({
  requireActiveStaff: vi.fn(), getAdminProductCatalogue: vi.fn(), createAdminServerClient: vi.fn(),
  rpc: vi.fn(), redirect: vi.fn(), revalidatePath: vi.fn(),
}))

vi.mock('../../src/auth/require-staff', () => ({ requireActiveStaff }))
vi.mock('../../src/catalogue/queries', () => ({ getAdminProductCatalogue }))
vi.mock('../../src/supabase/server', () => ({ createAdminServerClient }))
vi.mock('next/navigation', () => ({ redirect }))
vi.mock('next/cache', () => ({ revalidatePath }))

import { updateAdminProduct } from './actions'

const product = {
  id: 10, sku: 'DPG-SYNTHETIC-1', name: 'Synthetic product', display_name: 'Synthetic display', slug: 'synthetic-product', description: null,
  price: 123000, original_price: null, list_price: null, sale_price: null, online_discount_amount: null,
  price_state: 'unknown', price_confidence: 'low', publication_status: 'draft', is_active: false,
  pdp_visibility: 'hidden', listing_visibility: 'hidden', search_visibility: 'hidden', seo_indexing: 'noindex',
  sitemap_include: false, image_main_url: null, variant_group: null, variant_group_id: null, variant_type: null,
  variant_label: null, variant_options: [], variant_axes: [], variant_options_editable: false,
  version: 3, updated_at: '2026-11-06T10:00:00Z',
}

function formData() {
  const data = new FormData()
  data.set('productId', '10'); data.set('version', '3'); data.set('idempotencyKey', '01234567-89ab-4cde-8f01-234567890abc')
  data.set('displayName', 'Synthetic display'); data.set('description', '')
  data.set('price', '100000'); data.set('salePrice', ''); data.set('onlineDiscountAmount', '')
  data.set('publicationStatus', 'draft'); data.set('pdpVisibility', 'hidden'); data.set('listingVisibility', 'hidden')
  data.set('searchVisibility', 'hidden'); data.set('seoIndexing', 'noindex')
  return data
}

describe('Admin Product update action', () => {
  beforeEach(() => {
    requireActiveStaff.mockReset()
    getAdminProductCatalogue.mockReset().mockResolvedValue({ products: [product], total: 1 })
    rpc.mockReset().mockResolvedValue({ error: null })
    createAdminServerClient.mockReset().mockResolvedValue({ schema: () => ({ rpc }) })
    revalidatePath.mockReset()
    redirect.mockReset().mockImplementation((path: string) => { throw new Error(`REDIRECT:${path}`) })
  })

  it('denies staff without Product write capability before reading or updating', async () => {
    requireActiveStaff.mockResolvedValue({ capabilities: [] })
    await expect(updateAdminProduct(formData())).rejects.toThrow('REDIRECT:/products?error=forbidden')
    expect(getAdminProductCatalogue).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('sends only changed fields through the audited versioned RPC', async () => {
    requireActiveStaff.mockResolvedValue({ capabilities: ['products:write', 'commerce:write'] })
    await expect(updateAdminProduct(formData())).rejects.toThrow('REDIRECT:/products/10?saved=1')
    expect(rpc).toHaveBeenCalledWith('phase2_admin_product_update', expect.objectContaining({
      p_product_id: 10, p_expected_version: 3, p_input: { price: 100000 },
    }))
    expect(revalidatePath).toHaveBeenCalledWith('/products')
  })
})
