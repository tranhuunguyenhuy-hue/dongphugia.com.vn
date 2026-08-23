import { Prisma } from '@prisma/client'

export type ProductVisibilityInput = {
    is_active?: boolean | null
    stock_status?: string | null
    sellable_status?: string | null
    publication_status?: string | null
    pdp_visibility?: string | null
    listing_visibility?: string | null
    search_visibility?: string | null
    seo_indexing?: string | null
    sitemap_include?: boolean | null
}

export type ProductVisibilitySurface = 'pdp' | 'listing' | 'search' | 'sitemap'

export type ProductVisibilityReason =
    | 'inactive'
    | 'discontinued'
    | 'sellable_status_not_sellable'
    | 'publication_not_public'
    | 'pdp_hidden'
    | 'listing_hidden'
    | 'search_hidden'
    | 'sitemap_excluded'
    | 'seo_noindex'

export type ProductVisibilityProjection = {
    baseEligible: boolean
    pdp: boolean
    listing: boolean
    search: boolean
    sitemap: boolean
    reasons: Record<ProductVisibilitySurface, ProductVisibilityReason[]>
}

/** Resolve existing visibility fields into one explainable public projection. */
export function resolveProductVisibility(input: ProductVisibilityInput): ProductVisibilityProjection {
    const baseReasons: ProductVisibilityReason[] = []

    if (input.is_active !== true) baseReasons.push('inactive')
    if (input.stock_status === 'discontinued' || input.sellable_status === 'discontinued') {
        baseReasons.push('discontinued')
    }
    if (input.sellable_status !== 'sellable') baseReasons.push('sellable_status_not_sellable')
    if (input.publication_status !== 'public') baseReasons.push('publication_not_public')
    if (input.pdp_visibility !== 'public') baseReasons.push('pdp_hidden')

    const pdp = baseReasons.length === 0
    const listingReasons = [...baseReasons]
    const searchReasons = [...baseReasons]
    const sitemapReasons = [...baseReasons]

    if (pdp && !['default', 'low_priority'].includes(input.listing_visibility ?? '')) {
        listingReasons.push('listing_hidden')
    }
    if (pdp && input.search_visibility !== 'visible') searchReasons.push('search_hidden')
    if (pdp && input.sitemap_include !== true) sitemapReasons.push('sitemap_excluded')
    if (pdp && input.seo_indexing === 'noindex') sitemapReasons.push('seo_noindex')

    return {
        baseEligible: pdp,
        pdp,
        listing: listingReasons.length === 0,
        search: searchReasons.length === 0,
        sitemap: sitemapReasons.length === 0,
        reasons: {
            pdp: [...baseReasons],
            listing: listingReasons,
            search: searchReasons,
            sitemap: sitemapReasons,
        },
    }
}

const PUBLIC_PDP_WHERE: Prisma.productsWhereInput = {
    is_active: true,
    stock_status: { not: 'discontinued' },
    sellable_status: 'sellable',
    publication_status: 'public',
    pdp_visibility: 'public',
}

export function buildPublicPdpVisibilityWhere(): Prisma.productsWhereInput {
    return { ...PUBLIC_PDP_WHERE }
}

export function buildPublicListingVisibilityWhere(): Prisma.productsWhereInput {
    return {
        ...buildPublicPdpVisibilityWhere(),
        listing_visibility: { in: ['default', 'low_priority'] },
    }
}

export function buildPublicSitemapVisibilityWhere(): Prisma.productsWhereInput {
    return {
        ...buildPublicPdpVisibilityWhere(),
        sitemap_include: true,
        seo_indexing: { not: 'noindex' },
    }
}

export function buildPublicSearchVisibilityWhere(): Prisma.productsWhereInput {
    return {
        ...buildPublicPdpVisibilityWhere(),
        search_visibility: 'visible',
    }
}

export const buildPublicProductVisibilityWhere = buildPublicSitemapVisibilityWhere
