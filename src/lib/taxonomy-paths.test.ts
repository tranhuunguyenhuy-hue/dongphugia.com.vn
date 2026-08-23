import { describe, expect, it } from 'vitest'
import {
    getCanonicalProductPath,
    getTaxonomyPreferredCategoryFilter,
    getTaxonomyPreferredLeafFilter,
} from './taxonomy-paths'

const legacyProduct = {
    slug: 'san-pham-legacy',
    categories: { slug: 'thiet-bi-ve-sinh', name: 'Thiết bị vệ sinh' },
    subcategories: { slug: 'bon-cau', name: 'Bồn cầu' },
}

const activeTaxon = {
    slug: 'bon-cau',
    name: 'Bồn cầu',
    canonical_path: 'thiet-bi-ve-sinh/bon-cau',
    parent_id: 1,
    is_active: true,
    is_listing_enabled: true,
}

describe('taxonomy authority and URL disposition', () => {
    it('uses one valid primary taxon as the canonical path', () => {
        expect(getCanonicalProductPath({
            ...legacyProduct,
            product_taxon_assignments: [{ is_primary: true, catalog_taxons: activeTaxon }],
        })).toMatchObject({
            usedTaxonomyPrimary: true,
            taxonomyDisposition: 'normalized_primary',
            taxonomyException: null,
            urlPath: '/thiet-bi-ve-sinh/bon-cau/san-pham-legacy',
        })
    })

    it('keeps legacy URL identity when no primary taxon exists', () => {
        expect(getCanonicalProductPath(legacyProduct)).toMatchObject({
            usedTaxonomyPrimary: false,
            taxonomyDisposition: 'legacy_fallback',
            taxonomyException: null,
            urlPath: '/thiet-bi-ve-sinh/bon-cau/san-pham-legacy',
        })
    })

    it.each([
        ['multiple_primary_assignments', [
            { is_primary: true, catalog_taxons: activeTaxon },
            { is_primary: true, catalog_taxons: { ...activeTaxon, slug: 'lavabo', canonical_path: 'thiet-bi-ve-sinh/lavabo' } },
        ]],
        ['inactive_primary_taxon', [{ is_primary: true, catalog_taxons: { ...activeTaxon, is_active: false } }]],
        ['invalid_canonical_path', [{ is_primary: true, catalog_taxons: { ...activeTaxon, canonical_path: 'thiet-bi-ve-sinh' } }]],
    ] as const)('marks %s for manual review and falls back to legacy path', (exception, assignments) => {
        expect(getCanonicalProductPath({
            ...legacyProduct,
            product_taxon_assignments: assignments,
        })).toMatchObject({
            usedTaxonomyPrimary: false,
            taxonomyDisposition: 'manual_review',
            taxonomyException: exception,
            urlPath: '/thiet-bi-ve-sinh/bon-cau/san-pham-legacy',
        })
    })

    it('prefers normalized taxonomy and only falls back to legacy when no active primary exists', () => {
        const categoryFilter = getTaxonomyPreferredCategoryFilter('thiet-bi-ve-sinh')
        const leafFilter = getTaxonomyPreferredLeafFilter(['bon-cau'], {
            subcategories: { slug: 'bon-cau' },
        })

        expect(categoryFilter).toMatchObject({ OR: expect.any(Array) })
        expect(leafFilter).toMatchObject({ OR: expect.any(Array) })
        expect(JSON.stringify(categoryFilter)).toContain('is_active')
        expect(JSON.stringify(leafFilter)).toContain('is_listing_enabled')
        expect(JSON.stringify(leafFilter)).toContain('none')
    })
})
