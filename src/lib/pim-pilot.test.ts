import { describe, expect, it } from 'vitest'
import { buildPimPilotParityReport, classifyPimPilotProduct, type PimPilotProduct } from './pim-pilot'

const baseProduct: PimPilotProduct = {
  id: 1,
  sku: 'PILOT-1',
  slug: 'pilot-1',
  brand_id: 10,
  product_type_id: 20,
  product_sub_type_id: 21,
  document_count: 1,
  normalized_spec_count: 2,
  product_type: 'legacy-type',
  product_taxon_assignments: [{
    is_primary: true,
    catalog_taxons: {
      slug: 'bon-cau',
      name: 'Bồn cầu',
      canonical_path: 'thiet-bi-ve-sinh/bon-cau',
      parent_id: 1,
      is_active: true,
      is_listing_enabled: true,
    },
  }],
  listPrice: 1000000,
  salePrice: null,
  originalPrice: null,
  compatibilityPrice: null,
  stockStatus: 'in_stock',
  is_active: true,
  sellable_status: 'sellable',
  publication_status: 'public',
  pdp_visibility: 'public',
  listing_visibility: 'default',
  search_visibility: 'visible',
  seo_indexing: 'index',
  sitemap_include: true,
}

describe('PIM pilot parity', () => {
  it('marks a complete normalized Product ready', () => {
    expect(classifyPimPilotProduct(baseProduct)).toEqual({ id: 1, disposition: 'ready', reasons: [] })
  })

  it('keeps incomplete Products in manual review with deterministic reasons', () => {
    const result = classifyPimPilotProduct({ ...baseProduct, brand_id: null, document_count: 0, normalized_spec_count: 0, product_taxon_assignments: [] })
    expect(result.disposition).toBe('manual_review')
    expect(result.reasons).toEqual(['missing_brand', 'missing_primary_taxon', 'missing_normalized_specs', 'missing_documents'])
  })

  it('returns aggregate counts without exposing Product data', () => {
    const report = buildPimPilotParityReport([baseProduct, { ...baseProduct, id: 2, brand_id: null }])
    expect(report.total).toBe(2)
    expect(report.ready).toBe(1)
    expect(report.manualReview).toBe(1)
    expect(report.reasonCounts.missing_brand).toBe(1)
    expect(report.results.map((result) => result.id)).toEqual([1, 2])
  })
})
