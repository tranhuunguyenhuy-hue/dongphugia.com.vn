import { revalidatePublishingPublicSurfaces } from '@/lib/publishing/revalidation'
import { requirePublishingSchedulerToken } from '@/lib/publishing/config'
import { publishingJson, withPublishingRoute } from '@/lib/publishing/http'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RevalidationPost = { categorySlug: string; postSlug: string }

export async function POST(request: Request) {
    return withPublishingRoute(request, async () => {
        requirePublishingSchedulerToken(request)
        const body = await request.json().catch(() => null) as { posts?: RevalidationPost[] } | null
        const posts = body?.posts ?? []
        if (!Array.isArray(posts) || posts.length > 100 || posts.some((post) =>
            !post || typeof post.categorySlug !== 'string' || typeof post.postSlug !== 'string'
            || !/^[a-z0-9-]{1,300}$/.test(post.categorySlug)
            || !/^[a-z0-9-]{1,300}$/.test(post.postSlug),
        )) {
            return publishingJson({ error: 'INVALID_REVALIDATION_REQUEST' }, { status: 422 })
        }
        for (const post of posts) revalidatePublishingPublicSurfaces(post)
        return publishingJson({ revalidated: posts.length })
    })
}
