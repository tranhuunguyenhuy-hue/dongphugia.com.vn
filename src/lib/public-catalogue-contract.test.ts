import { describe, expect, it } from 'vitest'

import {
  isPublicCatalogueFilters,
  isPublicCataloguePrice,
  isPublicCatalogueSearchQuery,
  normalizePublicCataloguePagination,
  PUBLIC_CATALOGUE_LIMITS,
  PUBLIC_CATALOGUE_VISIBILITY_POLICY,
  type PublicCatalogueProduct,
  type PublicCatalogueReadResult,
} from '@dpg/app-contracts'
import { resolveProductCommerce } from './product-commerce'
import {
  buildPublicListingVisibilityWhere,
  buildPublicPdpVisibilityWhere,
  buildPublicSearchVisibilityWhere,
  buildPublicSitemapVisibilityWhere,
  resolveProductVisibility,
} from './public-product-visibility'
import { getCanonicalProductPath } from './taxonomy-paths'

describe('public catalogue read contract', () => {
  it('bounds pagination and search before a read request is sent', () => {
    expect(normalizePublicCataloguePagination()).toEqual({ page: 1, pageSize: 24 })
    expect(normalizePublicCataloguePagination({ page: 1000, pageSize: 24 })).toEqual({
      page: 1000,
      pageSize: 24,
    })
    expect(normalizePublicCataloguePagination({ page: 0 })).toBeNull()
    expect(normalizePublicCataloguePagination({ page: null })).toBeNull()
    expect(normalizePublicCataloguePagination({ page: 1001 })).toBeNull()
    expect(normalizePublicCataloguePagination({ pageSize: 25 })).toBeNull()
    expect(normalizePublicCataloguePagination({ page: 1.5 })).toBeNull()
    expect(PUBLIC_CATALOGUE_LIMITS.maximumPageSize).toBe(24)

    expect(isPublicCatalogueSearchQuery('bồn cầu')).toBe(true)
    expect(isPublicCatalogueSearchQuery('   ')).toBe(false)
    expect(isPublicCatalogueSearchQuery('x'.repeat(121))).toBe(false)
  })

  it('accepts only the bounded listing and search filter allowlist', () => {
    const allowedFilters = {
      brandSlugs: ['toto'],
      colorSlugs: ['trang'],
      materialSlugs: ['su'],
      originSlugs: ['viet-nam'],
      featureSlugs: ['tiet-kiem-nuoc'],
      productTypeSlugs: ['ban-cau'],
      productSubTypeSlugs: ['mot-khoi'],
      priceRange: { min: 100_000, max: 5_000_000 },
      isFeatured: true,
      isPromotion: false,
      specificationValues: [{ name: 'Kiểu thoát', value: 'Thoát sàn' }],
    }

    expect(isPublicCatalogueFilters(allowedFilters)).toBe(true)
    expect(isPublicCatalogueFilters({ ...allowedFilters, sql: 'not-allowed' })).toBe(false)
    expect(isPublicCatalogueFilters({ brandSlugs: Array(21).fill('toto') })).toBe(false)
    expect(isPublicCatalogueFilters({
      specificationValues: Array(13).fill({ name: 'Loại nắp', value: 'Đóng êm' }),
    })).toBe(false)
    expect(isPublicCatalogueFilters({ priceRange: { min: 2_000_000, max: 1_000_000 } })).toBe(false)
    expect(isPublicCatalogueFilters({ brandSlugs: ['TOTO'] })).toBe(false)
  })

  it('allows only a positive canonical public price in VND', () => {
    expect(isPublicCataloguePrice({ amount: 1, currency: 'VND' })).toBe(true)
    expect(isPublicCataloguePrice({ amount: 0, currency: 'VND' })).toBe(false)
    expect(isPublicCataloguePrice({ amount: -1, currency: 'VND' })).toBe(false)
    expect(isPublicCataloguePrice({ amount: 1, currency: 'USD' })).toBe(false)
    expect(isPublicCataloguePrice({ amount: 1, currency: 'VND', legacyPrice: 2 })).toBe(false)
  })

  it('preserves the canonical shared and per-surface visibility gates', () => {
    const base = PUBLIC_CATALOGUE_VISIBILITY_POLICY.base

    expect(buildPublicPdpVisibilityWhere()).toMatchObject({
      is_active: base.active,
      stock_status: { not: base.excludedStockStatus },
      sellable_status: base.sellableStatus,
      publication_status: base.publicationStatus,
      pdp_visibility: base.pdpVisibility,
    })
    expect(buildPublicListingVisibilityWhere()).toMatchObject({
      ...buildPublicPdpVisibilityWhere(),
      listing_visibility: { in: PUBLIC_CATALOGUE_VISIBILITY_POLICY.listing.listingVisibility },
    })
    expect(buildPublicSearchVisibilityWhere()).toMatchObject({
      ...buildPublicPdpVisibilityWhere(),
      search_visibility: PUBLIC_CATALOGUE_VISIBILITY_POLICY.search.searchVisibility,
    })
    expect(buildPublicSitemapVisibilityWhere()).toMatchObject({
      ...buildPublicPdpVisibilityWhere(),
      sitemap_include: PUBLIC_CATALOGUE_VISIBILITY_POLICY.sitemap.sitemapInclude,
      seo_indexing: {
        not: PUBLIC_CATALOGUE_VISIBILITY_POLICY.sitemap.excludedSeoIndexing,
      },
    })

    const eligible = {
      is_active: true,
      stock_status: 'in_stock',
      sellable_status: 'sellable',
      publication_status: 'public',
      pdp_visibility: 'public',
      listing_visibility: 'default',
      search_visibility: 'visible',
      seo_indexing: 'index',
      sitemap_include: true,
    }
    expect(resolveProductVisibility(eligible)).toMatchObject({
      pdp: true,
      listing: true,
      search: true,
      sitemap: true,
    })
  })

  it('requires canonical public price and mapped availability for commerce display', () => {
    expect(resolveProductCommerce({
      listPrice: 2_500_000,
      stockStatus: 'contact',
    })).toMatchObject({
      priceMode: 'PUBLIC_PRICE',
      displayPrice: 2_500_000,
      availability: 'QuoteOnly',
    })
    expect(resolveProductCommerce({
      compatibilityPrice: 2_500_000,
      stockStatus: 'in_stock',
    })).toMatchObject({
      priceMode: 'CONTACT_FOR_QUOTE',
      displayPrice: null,
    })
    expect(resolveProductCommerce({
      listPrice: 2_500_000,
      stockStatus: 'out_of_stock',
    })).toMatchObject({
      availability: null,
      displayPrice: null,
    })
  })

  it('uses the active primary taxonomy leaf for the canonical Product path', () => {
    const path = getCanonicalProductPath({
      slug: 'ban-cau-mot-khoi',
      categories: { slug: 'legacy-category', name: 'Legacy category' },
      subcategories: { slug: 'legacy-leaf', name: 'Legacy leaf' },
      product_taxon_assignments: [{
        is_primary: true,
        catalog_taxons: {
          slug: 'ban-cau',
          name: 'Bàn cầu',
          canonical_path: 'thiet-bi-ve-sinh/ban-cau',
          parent_id: 1,
          is_active: true,
          is_listing_enabled: true,
        },
      }],
    })

    expect(path.usedTaxonomyPrimary).toBe(true)
    expect(path.urlPath).toBe('/thiet-bi-ve-sinh/ban-cau/ban-cau-mot-khoi')
  })

  it('keeps serialized Product fields bounded and excludes internal identifiers', () => {
    const product = {
      slug: 'ban-cau-mot-khoi',
      sku: 'DPG-1001',
      name: 'Bàn cầu một khối',
      price: { amount: 2_500_000, currency: 'VND' },
      availability: 'InStock',
      brand: { slug: 'toto', name: 'TOTO' },
      mainImage: { url: 'https://images.example/product.webp', alt: 'Bàn cầu một khối' },
      canonicalPath: '/thiet-bi-ve-sinh/ban-cau/ban-cau-mot-khoi',
      description: null,
      images: [],
      specifications: [{ name: 'Kiểu thoát', value: 'Thoát sàn' }],
      seo: {
        title: 'Bàn cầu một khối',
        description: null,
        canonicalPath: '/thiet-bi-ve-sinh/ban-cau/ban-cau-mot-khoi',
        robots: 'index,follow',
      },
    } satisfies PublicCatalogueProduct

    expect(Object.keys(product).sort()).toEqual([
      'availability',
      'brand',
      'canonicalPath',
      'description',
      'images',
      'mainImage',
      'name',
      'price',
      'seo',
      'sku',
      'slug',
      'specifications',
    ])
    // @ts-expect-error Public DTOs do not expose database primary keys.
    const withInternalId: PublicCatalogueProduct = { ...product, id: 123 }
    void withInternalId
    // @ts-expect-error Public DTOs cannot mark synthetic fixture data as live.
    const withFixtureMarker: PublicCatalogueProduct = { ...product, fixtureOnly: true }
    void withFixtureMarker
  })

  it('represents missing and unavailable data distinctly, with no fixture fallback state', () => {
    const missing: PublicCatalogueReadResult = { kind: 'not_found' }
    const unavailable: PublicCatalogueReadResult = { kind: 'unavailable' }

    expect(missing.kind).toBe('not_found')
    expect(unavailable.kind).toBe('unavailable')
    // @ts-expect-error An unavailable read cannot be represented as fixture data.
    const fallback: PublicCatalogueReadResult = { kind: 'fixture_fallback' }
    void fallback
  })
})
