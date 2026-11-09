import { describe, expect, it } from 'vitest'

import { parseAdminProductCatalogue, parseAdminProductSearch } from './contracts'

const product = {
  id: 10, sku: 'DPG-SYNTHETIC-1', name: 'Synthetic product', display_name: 'Synthetic display', slug: 'synthetic-product', description: null,
  price: 123000, original_price: null, list_price: null, sale_price: null, online_discount_amount: null,
  price_state: 'unknown', price_confidence: 'low', publication_status: 'draft', is_active: false,
  pdp_visibility: 'hidden', listing_visibility: 'hidden', search_visibility: 'hidden', seo_indexing: 'noindex',
  sitemap_include: false, image_main_url: null, variant_group: 'verified-1', variant_group_id: 1,
  variant_type: 'size', variant_label: 'Size 1', variant_options: [{ axis: 'size', value: '1', label: 'Size 1' }],
  variant_axes: [{ key: 'size', label: 'Kích thước' }], variant_options_editable: true,
  version: 3, updated_at: '2026-11-06T10:00:00Z',
}

describe('Admin Product catalogue contracts', () => {
  it('accepts a bounded safe Product DTO with price provenance state and verified options', () => {
    expect(parseAdminProductCatalogue({ products: [product], total: 1 })).toMatchObject({
      total: 1,
      products: [{ id: 10, sku: 'DPG-SYNTHETIC-1', price_state: 'unknown', variant_options_editable: true }],
    })
  })

  it('fails closed when prices, variants, or versions are malformed', () => {
    expect(parseAdminProductCatalogue({ products: [{ ...product, price: -1 }], total: 1 })).toBeNull()
    expect(parseAdminProductCatalogue({ products: [{ ...product, variant_options: [{ axis: 'color', value: 'red', label: 'Đỏ' }] }], total: 1 })).toBeNull()
    expect(parseAdminProductCatalogue({ products: [{ ...product, version: 0 }], total: 1 })).toBeNull()
  })

  it('normalizes bounded search terms and rejects control characters', () => {
    expect(parseAdminProductSearch('  DPG-SYNTHETIC-1  ')).toEqual({ value: 'DPG-SYNTHETIC-1', error: null })
    expect(parseAdminProductSearch('SKU\n2')).toEqual({ value: '', error: 'Từ khóa có ký tự không hợp lệ.' })
    expect(parseAdminProductSearch('x'.repeat(101)).error).toBe('Từ khóa tối đa 100 ký tự.')
  })
})
