import { Prisma } from '@prisma/client'

export function buildPublicSitemapVisibilityWhere(): Prisma.productsWhereInput {
    return {
        publication_status: 'public',
        pdp_visibility: 'public',
        sitemap_include: true,
        seo_indexing: { not: 'noindex' },
    }
}

export function buildPublicSearchVisibilityWhere(): Prisma.productsWhereInput {
    return {
        publication_status: 'public',
        pdp_visibility: 'public',
        search_visibility: 'visible',
    }
}

export const buildPublicProductVisibilityWhere = buildPublicSitemapVisibilityWhere
