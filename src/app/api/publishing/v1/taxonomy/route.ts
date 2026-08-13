import { publishingJson } from '@/lib/publishing/http'
import prisma from '@/lib/publishing/database'
import { withAuthenticatedPublishingRoute } from '@/lib/publishing/route'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    return withAuthenticatedPublishingRoute(
        request,
        { requiredCapabilities: [], bucket: 'json' },
        async () => {
            const [categories, tags] = await Promise.all([
                prisma.blog_categories.findMany({
                    where: { is_active: true },
                    select: { name: true, slug: true, description: true },
                    orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
                }),
                prisma.blog_tags.findMany({
                    where: { is_active: true },
                    select: { name: true, slug: true, description: true },
                    orderBy: { name: 'asc' },
                }),
            ])
            return publishingJson({ categories, tags })
        },
    )
}
