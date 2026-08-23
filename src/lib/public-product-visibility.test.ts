import { describe, expect, it } from 'vitest'
import {
    buildPublicListingVisibilityWhere,
    buildPublicPdpVisibilityWhere,
    buildPublicSearchVisibilityWhere,
    buildPublicSitemapVisibilityWhere,
    resolveProductVisibility,
} from './public-product-visibility'

describe('public product visibility', () => {
    it.each([
        buildPublicPdpVisibilityWhere,
        buildPublicListingVisibilityWhere,
        buildPublicSearchVisibilityWhere,
        buildPublicSitemapVisibilityWhere,
    ])('excludes draft, hidden, inactive and discontinued products', (buildWhere) => {
        expect(buildWhere()).toMatchObject({
            is_active: true,
            stock_status: { not: 'discontinued' },
            sellable_status: 'sellable',
            publication_status: 'public',
            pdp_visibility: 'public',
        })
    })

    it('keeps each public surface-specific visibility gate', () => {
        expect(buildPublicListingVisibilityWhere()).toMatchObject({
            listing_visibility: { in: ['default', 'low_priority'] },
        })
        expect(buildPublicSearchVisibilityWhere()).toMatchObject({ search_visibility: 'visible' })
        expect(buildPublicSitemapVisibilityWhere()).toMatchObject({
            sitemap_include: true,
            seo_indexing: { not: 'noindex' },
        })
    })

    it('returns one consistent eligible projection for all public surfaces', () => {
        const projection = resolveProductVisibility({
            is_active: true,
            stock_status: 'in_stock',
            sellable_status: 'sellable',
            publication_status: 'public',
            pdp_visibility: 'public',
            listing_visibility: 'default',
            search_visibility: 'visible',
            seo_indexing: 'index',
            sitemap_include: true,
        })

        expect(projection).toMatchObject({
            baseEligible: true,
            pdp: true,
            listing: true,
            search: true,
            sitemap: true,
        })
        expect(projection.reasons).toEqual({ pdp: [], listing: [], search: [], sitemap: [] })
    })

    it('explains surface-specific withholding without hiding the PDP', () => {
        const projection = resolveProductVisibility({
            is_active: true,
            stock_status: 'in_stock',
            sellable_status: 'sellable',
            publication_status: 'public',
            pdp_visibility: 'public',
            listing_visibility: 'hidden',
            search_visibility: 'hidden',
            seo_indexing: 'noindex',
            sitemap_include: false,
        })

        expect(projection.pdp).toBe(true)
        expect(projection.listing).toBe(false)
        expect(projection.search).toBe(false)
        expect(projection.sitemap).toBe(false)
        expect(projection.reasons.listing).toContain('listing_hidden')
        expect(projection.reasons.search).toContain('search_hidden')
        expect(projection.reasons.sitemap).toEqual(['sitemap_excluded', 'seo_noindex'])
    })

    it('withholds inactive, discontinued, and non-sellable products consistently', () => {
        const projection = resolveProductVisibility({
            is_active: false,
            stock_status: 'discontinued',
            sellable_status: 'not_sellable',
            publication_status: 'draft',
            pdp_visibility: 'hidden',
        })

        expect(projection.pdp).toBe(false)
        expect(projection.listing).toBe(false)
        expect(projection.search).toBe(false)
        expect(projection.sitemap).toBe(false)
        expect(projection.reasons.pdp).toEqual([
            'inactive',
            'discontinued',
            'sellable_status_not_sellable',
            'publication_not_public',
            'pdp_hidden',
        ])
    })
})
