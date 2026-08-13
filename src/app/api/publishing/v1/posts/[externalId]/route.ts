import {
    parseExternalPostId,
    parsePostMutation,
} from '@/lib/publishing/contracts'
import {
    parseRequiredIfMatch,
    publishingJson,
    readPublishingJson,
    requireCreatePrecondition,
    requireIdempotencyKey,
} from '@/lib/publishing/http'
import { PublishingApiError } from '@/lib/publishing/errors'
import {
    getPublishingPost,
    mutatePublishingPost,
} from '@/lib/publishing/posts'
import { revalidatePublishingPublicSurfaces } from '@/lib/publishing/revalidation'
import { withAuthenticatedPublishingRoute } from '@/lib/publishing/route'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ externalId: string }> }

export async function GET(request: Request, context: RouteContext) {
    return withAuthenticatedPublishingRoute(
        request,
        { requiredCapabilities: ['posts:write'], bucket: 'json' },
        async ({ auth }) => {
            const { externalId: rawExternalId } = await context.params
            const post = await getPublishingPost(
                auth.identity.id,
                parseExternalPostId(rawExternalId),
            )
            return publishingJson(post, { version: post.version })
        },
    )
}

export async function PUT(request: Request, context: RouteContext) {
    return withAuthenticatedPublishingRoute(
        request,
        { requiredCapabilities: ['posts:write'], bucket: 'json', mutation: true },
        async ({ auth, config, requestId }) => {
            const { externalId: rawExternalId } = await context.params
            const externalId = parseExternalPostId(rawExternalId)
            const creating = request.headers.has('if-none-match')
            if (creating) {
                requireCreatePrecondition(request.headers)
                if (request.headers.has('if-match')) {
                    throw new PublishingApiError(
                        422,
                        'PRECONDITION_CONFLICT',
                        'If-Match and If-None-Match cannot be used together',
                    )
                }
            }
            const mutation = parsePostMutation(await readPublishingJson(request))
            const idempotencyKey = requireIdempotencyKey(request.headers)
            const result = await mutatePublishingPost({
                auth,
                externalId,
                mutation,
                idempotencyKey,
                requestId,
                create: creating,
                ...(creating
                    ? {}
                    : { expectedVersion: parseRequiredIfMatch(request.headers) }),
                config,
            })

            if (result.body.status === 'published') {
                const post = await getPublishingPost(auth.identity.id, externalId)
                revalidatePublishingPublicSurfaces({
                    categorySlug: post.category.slug,
                    postSlug: post.slug,
                })
            }
            // Idempotency retains this safe summary rather than raw HTML. A GET
            // returns the canonical sanitized content when the Agent needs it.
            return publishingJson(result.body, {
                status: result.status,
                version: result.body.version,
            })
        },
    )
}
