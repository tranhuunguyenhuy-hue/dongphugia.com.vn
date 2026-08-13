import type {
    PublishingAuthContext,
    PublishingCapability,
} from './auth'
import { authenticatePublishingRequest } from './auth'
import { getPublishingRuntimeConfig, requirePublishingHttps } from './config'
import type { PublishingRateBucket } from './rate-limit'
import { consumePublishingRateLimit } from './rate-limit'
import { withPublishingRoute } from './http'
import { requireWritesAllowed } from '@/lib/write-freeze'

export async function withAuthenticatedPublishingRoute(
    request: Request,
    options: {
        requiredCapabilities: readonly PublishingCapability[]
        bucket: PublishingRateBucket
        mutation?: boolean
    },
    handler: (input: {
        requestId: string
        auth: PublishingAuthContext
        config: ReturnType<typeof getPublishingRuntimeConfig>
    }) => Promise<Response>,
): Promise<Response> {
    return withPublishingRoute(request, async ({ requestId }) => {
        const config = getPublishingRuntimeConfig()
        requirePublishingHttps(request, config)
        const auth = await authenticatePublishingRequest(
            request,
            options.requiredCapabilities,
            {
                environment: config.environment,
                trustedClientIpHeader: config.trustedClientIpHeader,
            },
        )
        if (options.mutation) {
            requireWritesAllowed('publishing.api.mutation')
        }
        await consumePublishingRateLimit(auth.identity.id, options.bucket, config)
        return handler({ requestId, auth, config })
    })
}
