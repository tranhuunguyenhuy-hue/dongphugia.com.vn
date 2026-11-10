import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./public-snapshot-catalogue', () => ({
  usesPublicSnapshot: () => false,
  PUBLIC_SNAPSHOT_NOTICE: 'snapshot-only',
  getSnapshotCategories: async () => [],
  getSnapshotProducts: async () => ({ products: [], totalCount: 0, page: 1 }),
  getSnapshotProduct: async () => null,
  getSnapshotVariantSiblings: async () => [],
  getSnapshotVariantSelectionData: async () => ({ axes: [], currentVariantOptions: [], siblings: [] }),
  resolveSnapshotRoute: async () => ({ kind: 'not-found' }),
}))

vi.mock('../config/env', () => ({
  getPublicAppEnvironment: () => ({ environment: 'preview' }),
}))

import {
  getPreviewCatalogueCategories,
  getPreviewCatalogueProduct,
  getPreviewCatalogueProducts,
  getPreviewVariantSelectionData,
} from './preview-public-catalogue'

describe('synthetic Public Preview catalogue', () => {
  beforeEach(() => {
    vi.stubEnv('APP_ENV', 'preview')
  })

  it('exposes only the database-backed synthetic option SKUs in the test listing', async () => {
    expect((await getPreviewCatalogueCategories()).map(category => category.slug)).toContain('preview-synthetic')
    const products = await getPreviewCatalogueProducts('preview-synthetic', 'sku-options')
    expect(products).toHaveLength(2)
    expect(products.map(product => [product.id, product.sku, product.price])).toEqual([
      [1, 'DPG-290-SYN-A', 100000],
      [2, 'DPG-290-SYN-B', 120000],
    ])
    expect(products.every(product => 'fixtureOnly' in product && product.fixtureOnly && product.brands?.slug === 'preview-synthetic')).toBe(true)
    expect(await getPreviewCatalogueProducts('thiet-bi-ve-sinh', 'ban-cau')).toEqual([])
  })

  it('keeps each PDP bound to its exact SKU, synthetic price, noindex state, and sibling', async () => {
    const product = await getPreviewCatalogueProduct('preview-synthetic', 'sku-options', 'preview-option-a')
    expect(product).toMatchObject({
      id: 1,
      sku: 'DPG-290-SYN-A',
      price: 100000,
      stock_status: 'in_stock',
      seo_indexing: 'noindex',
      variant_group: 'public-290',
      variant_options: [{ axis: 'seat_type', value: 'a', label: 'Option A' }],
    })

    const selection = getPreviewVariantSelectionData('public-290', 1)
    expect(selection.axes).toEqual([{ key: 'seat_type', label: 'Tùy chọn SKU' }])
    expect(selection.currentVariantOptions).toEqual([{ axis: 'seat_type', value: 'a', label: 'Option A' }])
    expect(selection.siblings).toHaveLength(1)
    expect(selection.siblings[0]).toMatchObject({ id: 2, sku: 'DPG-290-SYN-B', price: 120000 })
  })

  it('rejects unrelated and malformed variant groups', () => {
    expect(getPreviewVariantSelectionData('public-290', 99)).toMatchObject({ axes: [], siblings: [] })
    expect(getPreviewVariantSelectionData('public-291', 1)).toMatchObject({ axes: [], siblings: [] })
  })
})
