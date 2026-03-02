import { unstable_cache } from 'next/cache'
import prisma from '@/lib/prisma'

// Lookup data — changes rarely, cache aggressively
export const getProductCategories = unstable_cache(
    async () => prisma.product_categories.findMany({
        where: { is_active: true },
        orderBy: { sort_order: 'asc' },
    }),
    ['product_categories'],
    { revalidate: 3600, tags: ['product_categories'] }
)

export const getPatternTypes = unstable_cache(
    async () => prisma.pattern_types.findMany({
        where: { is_active: true },
        orderBy: { sort_order: 'asc' },
        select: { id: true, name: true, slug: true, thumbnail_url: true },
    }),
    ['pattern_types'],
    { revalidate: 3600, tags: ['pattern_types'] }
)

export const getColors = unstable_cache(
    async () => prisma.colors.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, slug: true, hex_code: true } }),
    ['colors'],
    { revalidate: 86400, tags: ['colors'] }
)

export const getSurfaces = unstable_cache(
    async () => prisma.surfaces.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, slug: true } }),
    ['surfaces'],
    { revalidate: 86400, tags: ['surfaces'] }
)

export const getSizes = unstable_cache(
    async () => prisma.sizes.findMany({ orderBy: { label: 'asc' }, select: { id: true, label: true, slug: true } }),
    ['sizes'],
    { revalidate: 86400, tags: ['sizes'] }
)
