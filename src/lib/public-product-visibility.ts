import { Prisma } from '@prisma/client'

export function buildPublicProductVisibilityWhere(): Prisma.productsWhereInput {
    return {
        publication_status: 'public',
        pdp_visibility: 'public',
        sitemap_include: true,
        seo_indexing: { not: 'noindex' },
    }
}
