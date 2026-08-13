import { parsePostListQuery } from '@/lib/publishing/contracts'
import { publishingJson } from '@/lib/publishing/http'
import { listPublishingPosts } from '@/lib/publishing/posts'
import { withAuthenticatedPublishingRoute } from '@/lib/publishing/route'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    return withAuthenticatedPublishingRoute(
        request,
        { requiredCapabilities: ['posts:write'], bucket: 'json' },
        async ({ auth }) => {
            const query = parsePostListQuery(new URL(request.url))
            const result = await listPublishingPosts({
                identityId: auth.identity.id,
                ...query,
            })
            return publishingJson(result)
        },
    )
}
