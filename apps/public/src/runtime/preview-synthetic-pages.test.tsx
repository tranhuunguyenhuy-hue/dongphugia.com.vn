import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fixtures = vi.hoisted(() => ({
  products: [
    { id: 1, sku: 'DPG-290-SYN-A', name: 'PREVIEW ONLY — Synthetic option A', slug: 'preview-option-a', url: '/preview-synthetic/sku-options/preview-option-a' },
    { id: 2, sku: 'DPG-290-SYN-B', name: 'PREVIEW ONLY — Synthetic option B', slug: 'preview-option-b', url: '/preview-synthetic/sku-options/preview-option-b' },
  ],
  product: {
    id: 1,
    sku: 'DPG-290-SYN-A',
    name: 'PREVIEW ONLY — Synthetic option A',
    slug: 'preview-option-a',
    price: 100000,
    price_display: 'Giá kiểm thử 100.000 ₫',
    original_price: null,
    list_price: null,
    sale_price: null,
    online_discount_amount: null,
    image_main_url: null,
    product_images: [],
    stock_status: 'in_stock',
    is_active: true,
    variant_group: 'public-290',
    variant_type: 'seat_type',
    variant_label: 'Option A',
    categories: { slug: 'preview-synthetic' },
    subcategories: { slug: 'sku-options' },
    brands: { name: 'Preview synthetic' },
  },
  selection: {
    axes: [{ key: 'seat_type', label: 'Tùy chọn SKU' }],
    currentVariantOptions: [{ axis: 'seat_type', value: 'a', label: 'Option A' }],
    siblings: [{ id: 2, sku: 'DPG-290-SYN-B', name: 'PREVIEW ONLY — Synthetic option B', slug: 'preview-option-b' }],
  },
}))

vi.mock('next/navigation', () => ({
  notFound: () => { throw new Error('NEXT_HTTP_ERROR_FALLBACK;404') },
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => <a href={href} {...props}>{children}</a>,
}))

vi.mock('@/components/ui/product-card', () => ({
  ProductCard: ({ product, href }: { product: { sku: string; name: string }; href: string }) => (
    <a href={href} data-product-sku={product.sku}>{product.name}</a>
  ),
}))

vi.mock('@/components/product/product-purchase-panel', () => ({
  ProductPurchasePanel: ({ product, variantSiblings }: { product: { sku: string; list_price: number | null }; variantSiblings: Array<{ sku: string }> }) => (
    <div data-panel-sku={product.sku} data-list-price={product.list_price} data-sibling-skus={variantSiblings.map(({ sku }) => sku).join(',')} />
  ),
}))

vi.mock('./preview-public-catalogue', () => ({
  getPreviewCatalogueProducts: async () => fixtures.products,
}))

vi.mock('@/lib/public-api-products', () => ({
  getPublicProductBySlug: async () => fixtures.product,
  getVariantSelectionData: async () => fixtures.selection,
}))

import { PreviewSyntheticListingPage, PreviewSyntheticProductPage } from './preview-synthetic-pages'

describe('synthetic Preview route pages', () => {
  beforeEach(() => {
    vi.stubEnv('APP_ENV', 'preview')
    vi.stubEnv('APP_ORIGIN', 'https://dpg-preview.example.workers.dev')
    vi.stubEnv('PREVIEW_NOINDEX', 'true')
    vi.stubEnv('APP_BUILD_TARGET', 'public')
  })

  afterEach(() => vi.unstubAllEnvs())

  it('renders the existing A/B fixture listing and exact PDP links that previously returned 404', async () => {
    const listing = renderToStaticMarkup(await PreviewSyntheticListingPage())
    expect(listing).toContain('data-preview-synthetic-catalogue')
    expect(listing).toContain('data-product-sku="DPG-290-SYN-A"')
    expect(listing).toContain('href="/preview-synthetic/sku-options/preview-option-a"')
    expect(listing).toContain('data-product-sku="DPG-290-SYN-B"')
    expect(listing).toContain('href="/preview-synthetic/sku-options/preview-option-b"')

    const product = renderToStaticMarkup(await PreviewSyntheticProductPage({ productSlug: 'preview-option-a' }))
    expect(product).toContain('data-preview-synthetic-product')
    expect(product).toContain('data-testid="selected-sku">DPG-290-SYN-A</strong>')
    expect(product).toContain('data-panel-sku="DPG-290-SYN-A"')
    expect(product).toContain('data-list-price="100000"')
    expect(product).toContain('data-sibling-skus="DPG-290-SYN-B"')
    expect(product).toContain('Giá hiển thị là giá kiểm thử tổng hợp')
  })

  it('rejects the synthetic PDP in Production', async () => {
    vi.stubEnv('APP_ENV', 'production')
    vi.stubEnv('APP_ORIGIN', 'https://www.dongphugia.vn')
    vi.stubEnv('PREVIEW_NOINDEX', '')

    await expect(PreviewSyntheticProductPage({ productSlug: 'preview-option-a' }))
      .rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404')
  })
})
