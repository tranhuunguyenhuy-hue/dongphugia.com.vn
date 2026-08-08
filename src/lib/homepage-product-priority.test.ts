import { describe, expect, it } from 'vitest'
import {
    buildHomepageNonAccessoryWhere,
    isHomepageAccessoryCandidate,
    rankHomepageSanitaryProducts,
} from './homepage-product-priority'

const createdAt = '2026-08-01T00:00:00.000Z'

function product(overrides: Record<string, unknown>) {
    return {
        id: 1,
        is_featured: false,
        sort_order: 0,
        created_at: createdAt,
        subcategories: { slug: 'bon-cau' },
        ...overrides,
    }
}

describe('homepage sanitary product ranking', () => {
    it('uses one representative per family and ranks active public family size first', () => {
        const ranked = rankHomepageSanitaryProducts([
            product({ id: 1, variant_group: 'small-family', sort_order: 20 }),
            product({ id: 2, variant_group: 'small-family', sort_order: 10 }),
            product({ id: 3, variant_group: 'large-family', sort_order: 1 }),
            product({ id: 4, variant_group: 'large-family', sort_order: 5 }),
            product({ id: 5, variant_group: 'large-family', is_featured: true }),
            product({ id: 6, sort_order: 999 }),
        ])

        expect(ranked.map((item) => item.id)).toEqual([5, 1, 6])
    })

    it('exhausts the four priority leaves before the public fallback', () => {
        const ranked = rankHomepageSanitaryProducts([
            product({ id: 1, subcategories: { slug: 'lavabo' }, variant_group: 'priority-family' }),
            product({ id: 2, subcategories: { slug: 'bon-cau' }, sort_order: 1 }),
            product({ id: 3, subcategories: { slug: 'chau-rua' }, variant_group: 'fallback-family' }),
            product({ id: 4, subcategories: { slug: 'chau-rua' }, sort_order: 999 }),
        ])

        expect(ranked.map((item) => item.id)).toEqual([1, 2, 3, 4])
    })

    it('excludes accessory taxonomy, subcategory, and product-type records without using names', () => {
        expect(isHomepageAccessoryCandidate(product({
            id: 1,
            product_types: { slug: 'bo-xa-bon-cau' },
        }))).toBe(true)
        expect(isHomepageAccessoryCandidate(product({
            id: 2,
            subcategories: { slug: 'phu-kien-phong-tam' },
        }))).toBe(true)
        expect(isHomepageAccessoryCandidate(product({
            id: 3,
            product_taxon_assignments: [{
                catalog_taxons: { slug: 'tay-sen', canonical_path: 'thiet-bi-ve-sinh/sen-tam/tay-sen' },
            }],
        }))).toBe(true)

        const ranked = rankHomepageSanitaryProducts([
            product({ id: 4, product_type: 'linh-kien' }),
            product({ id: 5, variant_group: 'toilet-family' }),
        ])
        expect(ranked.map((item) => item.id)).toEqual([5])
    })

    it('matches accessory catalog slug and taxonomy-path boundaries, not arbitrary substrings', () => {
        expect(isHomepageAccessoryCandidate(product({
            id: 1,
            product_sub_type: 'bon-cau-phu-kien',
        }))).toBe(true)
        expect(isHomepageAccessoryCandidate(product({
            id: 2,
            secondary_subcategories: [{ subcategories: { slug: 'phu-kien-phong-tam' } }],
        }))).toBe(true)
        expect(isHomepageAccessoryCandidate(product({
            id: 3,
            product_taxon_assignments: [{
                catalog_taxons: { slug: 'van-xa', canonical_path: 'thiet-bi-ve-sinh/bon-cau/van-xa' },
            }],
        }))).toBe(true)
        expect(isHomepageAccessoryCandidate(product({
            id: 4,
            product_type: 'van-xao-cao-cap',
        }))).toBe(false)
    })

    it('builds database filtering for direct, secondary, product-type, subtype, and taxonomy accessory fields', () => {
        const where = buildHomepageNonAccessoryWhere()
        const serialized = JSON.stringify(where)

        expect(serialized).toContain('product_type')
        expect(serialized).toContain('product_sub_type')
        expect(serialized).toContain('product_types')
        expect(serialized).toContain('product_sub_types')
        expect(serialized).toContain('secondary_subcategories')
        expect(serialized).toContain('product_taxon_assignments')
        expect(serialized).toContain('canonical_path')
        expect(serialized).toContain('-phu-kien-')
        expect(serialized).toContain('"not":null')
    })

    it('uses deterministic featured, sort order, created-at, then id tie-breakers', () => {
        const ranked = rankHomepageSanitaryProducts([
            product({ id: 4, sort_order: 5, created_at: '2026-08-01T00:00:00.000Z' }),
            product({ id: 2, sort_order: 5, created_at: '2026-08-01T00:00:00.000Z' }),
            product({ id: 3, sort_order: 5, created_at: '2026-08-02T00:00:00.000Z' }),
            product({ id: 1, is_featured: true, sort_order: 0 }),
        ])

        expect(ranked.map((item) => item.id)).toEqual([1, 3, 2, 4])
    })
})
