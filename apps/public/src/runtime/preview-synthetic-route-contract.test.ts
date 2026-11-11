import { describe, expect, it } from 'vitest'

import {
  expectedPreviewSyntheticSku,
  isPreviewSyntheticCategoryRoute,
  isPreviewSyntheticListingRoute,
  isPreviewSyntheticProductRoute,
} from './preview-synthetic-route-contract'

describe('synthetic Preview catalogue routes', () => {
  it('allows only the existing A/B SKU fixture paths outside Production', () => {
    for (const environment of ['local', 'preview']) {
      expect(isPreviewSyntheticCategoryRoute(environment, 'preview-synthetic')).toBe(true)
      expect(isPreviewSyntheticListingRoute(environment, 'preview-synthetic', 'sku-options')).toBe(true)
      expect(isPreviewSyntheticProductRoute(environment, 'preview-synthetic', 'sku-options', 'preview-option-a')).toBe(true)
      expect(isPreviewSyntheticProductRoute(environment, 'preview-synthetic', 'sku-options', 'preview-option-b')).toBe(true)
    }

    expect(expectedPreviewSyntheticSku('preview-option-a')).toBe('DPG-290-SYN-A')
    expect(expectedPreviewSyntheticSku('preview-option-b')).toBe('DPG-290-SYN-B')
  })

  it('rejects the synthetic category, listing, and products in Production or on any other path', () => {
    expect(isPreviewSyntheticCategoryRoute('production', 'preview-synthetic')).toBe(false)
    expect(isPreviewSyntheticListingRoute('production', 'preview-synthetic', 'sku-options')).toBe(false)
    expect(isPreviewSyntheticProductRoute('production', 'preview-synthetic', 'sku-options', 'preview-option-a')).toBe(false)
    expect(isPreviewSyntheticListingRoute('preview', 'thiet-bi-ve-sinh', 'sku-options')).toBe(false)
    expect(isPreviewSyntheticListingRoute('preview', 'preview-synthetic', 'ban-cau')).toBe(false)
    expect(isPreviewSyntheticProductRoute('preview', 'preview-synthetic', 'sku-options', 'other-product')).toBe(false)
    expect(expectedPreviewSyntheticSku('other-product')).toBeNull()
  })
})
