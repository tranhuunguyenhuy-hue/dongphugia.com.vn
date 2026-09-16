import { unstable_cache } from 'next/cache'
import prisma from '@/lib/prisma'
import { withRuntimeQueryDiagnostic } from '@/lib/runtime-query-diagnostics'

export const getHomepageBanners = unstable_cache(
    async () => withRuntimeQueryDiagnostic('homepage_banners', () =>
        prisma.banners.findMany({
            where: { is_active: true },
            orderBy: { sort_order: 'asc' },
            take: 5,
        }),
    ),
    ['homepage-banners-v1'],
    { revalidate: 3600, tags: ['homepage'] },
)
