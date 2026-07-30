import { unstable_cache } from 'next/cache'
import prisma from '@/lib/prisma'

export const getHomepageBanners = unstable_cache(
    async () => prisma.banners.findMany({
        where: { is_active: true },
        orderBy: { sort_order: 'asc' },
        take: 5,
    }),
    ['homepage-banners-v1'],
    { revalidate: 3600, tags: ['homepage'] },
)
