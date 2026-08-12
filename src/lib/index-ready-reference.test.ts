import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

const helperSection = (contents: string, helperName: string) => {
    const start = Math.max(
        contents.indexOf(`export const ${helperName}`),
        contents.indexOf(`export async function ${helperName}`),
    )
    const end = contents.indexOf('\nexport ', start + 1)
    return contents.slice(start, end === -1 ? undefined : end)
}

describe('index-ready public references', () => {
    it('does not generate internal links through redirects or nonexistent tag routes', () => {
        const customerNavigation = [
            'src/config/site.ts',
            'src/components/home/mega-menu.tsx',
            'src/app/(public)/blog/page.tsx',
        ].map(source).join('\n')

        expect(customerNavigation).not.toContain('"/tin-tuc"')
        expect(customerNavigation).not.toContain('?sub=')
        expect(customerNavigation).not.toContain('/blog/tag/')
    })

    it('gives every indexable policy and service page an explicit canonical', () => {
        const canonicalPages = [
            'chinh-sach-bao-mat',
            'dieu-kien-giao-dich',
            'dieu-kien-kinh-doanh',
            'van-chuyen-giao-nhan',
            'thong-tin-hang-hoa',
            'thong-tin-gia',
            'dich-vu-lap-dat',
        ]

        for (const slug of canonicalPages) {
            expect(source(`src/app/(public)/${slug}/page.tsx`), slug).toContain(
                `alternates: { canonical: '/${slug}' }`,
            )
        }
    })


    it('binds every public listing, filter, home-card and sibling helper to the shared visibility predicates', () => {
        const publicProducts = source('src/lib/public-api-products.ts')
        const homepage = source('src/app/(public)/page.tsx')

        expect(helperSection(publicProducts, 'getAvailableFilters')).toContain('const categoryProductWhere: Prisma.productsWhereInput = {')
        expect(helperSection(publicProducts, 'getAvailableFiltersBySubcategory')).toContain('...buildPublicListingVisibilityWhere(),')
        expect(helperSection(publicProducts, 'getProductTypeFiltersBySubcategory')).toContain('products: { some: PUBLIC_LISTING_PRODUCT_WHERE }')
        expect(helperSection(publicProducts, 'getVariantSiblings')).toContain('...buildPublicPdpVisibilityWhere(),')
        expect(helperSection(publicProducts, 'getVariantSelectionData')).toContain("and p.publication_status = 'public'")
        expect(helperSection(publicProducts, 'getVariantSelectionData')).toContain("and p.pdp_visibility = 'public'")
        for (const helperName of [
            'getFeaturedProductsByCategorySlug',
            'getTopProductsPerBrand',
            'getNewArrivals',
            'getHomeFeaturedProducts',
        ]) {
            expect(helperSection(publicProducts, helperName), helperName).toContain('buildPublicListingVisibilityWhere()')
        }
        expect(homepage).toContain('const publicTbvsProducts = {')
        expect(homepage).toContain('const publicKitchenProducts = {')
        expect(homepage).toContain('products: { some: publicTbvsProducts }')
        expect(homepage).toContain('products: { some: publicKitchenProducts }')
    })

    it('keeps customer-facing metadata and sitemap modules free of legacy/staging hosts', () => {
        const customerFacingModules = [
            'src/app/layout.tsx',
            'src/app/robots.txt/route.ts',
            'src/app/sitemap.xml/route.ts',
            'src/app/sitemap_static.xml/route.ts',
            'src/app/api/sitemap/[id]/route.ts',
            'src/lib/seo/schema.ts',
            'src/config/site.ts',
        ]

        for (const path of customerFacingModules) {
            const contents = source(path)
            expect(contents, path).not.toMatch(/(?:^|[^\w.])(?:www\.)?dongphugia\.com\.vn/i)
            expect(contents, path).not.toMatch(/sslip\.io/i)
        }
    })
})
