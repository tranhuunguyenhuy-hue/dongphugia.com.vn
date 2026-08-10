import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const toiletListingPage = readFileSync(
    resolve(process.cwd(), 'src/app/(public)/thiet-bi-ve-sinh/[sub]/page.tsx'),
    'utf8',
)

describe('toilet listing image preload contract', () => {
    it('preloads only the prioritized card resources with matching responsive attributes', () => {
        expect(toiletListingPage).toContain(
            'for (const source of getAboveFoldListingImageSources(products))',
        )
        expect(toiletListingPage).toContain('preload(source, {')
        expect(toiletListingPage).toContain(
            'imageSrcSet: createResponsiveSrcSet(source, "product")',
        )
        expect(toiletListingPage).toContain(
            'imageSizes: LISTING_PRODUCT_IMAGE_SIZES',
        )
        expect(toiletListingPage).toContain('fetchPriority: "high"')
    })
})
