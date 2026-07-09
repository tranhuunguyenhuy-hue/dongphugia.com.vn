import { Prisma } from '@prisma/client'

export function buildPublicPdpVisibilityWhere(): Prisma.productsWhereInput {
    return {
        publication_status: 'public',
        pdp_visibility: 'public',
    }
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
