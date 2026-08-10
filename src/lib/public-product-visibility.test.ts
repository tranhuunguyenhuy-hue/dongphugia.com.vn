import { describe, expect, it } from 'vitest'
import {
    buildPublicListingVisibilityWhere,
    buildPublicPdpVisibilityWhere,
    buildPublicSearchVisibilityWhere,
    buildPublicSitemapVisibilityWhere,
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
})
