import prisma from '@/lib/prisma'

import type { PublishingRuntimeConfig } from './config'
import { PublishingApiError } from './errors'

export type PublishingRateBucket = 'json' | 'media'

export async function consumePublishingRateLimit(
    identityId: string,
    bucket: PublishingRateBucket,
    config: PublishingRuntimeConfig,
    now = new Date(),
): Promise<void> {
    const limit =
        bucket === 'media' ? config.mediaRateLimit : config.jsonRateLimit
    const windowMilliseconds = config.rateLimitWindowSeconds * 1000
    const windowStart = new Date(
        Math.floor(now.getTime() / windowMilliseconds) * windowMilliseconds,
    )

    const window = await prisma.publishing_rate_limit_windows.upsert({
        where: {
            identity_id_bucket_window_start: {
                identity_id: identityId,
                bucket,
                window_start: windowStart,
            },
        },
        create: {
            identity_id: identityId,
            bucket,
            window_start: windowStart,
            request_count: 1,
            updated_at: now,
        },
        update: {
            request_count: { increment: 1 },
            updated_at: now,
        },
        select: { request_count: true },
    })

    if (window.request_count > limit) {
        const retryAfterSeconds = Math.max(
            1,
            Math.ceil(
                (windowStart.getTime() + windowMilliseconds - now.getTime())
                    / 1000,
            ),
        )
        throw new PublishingApiError(
            429,
            'RATE_LIMIT_EXCEEDED',
            'Publishing API rate limit exceeded',
            [{ field: 'bucket', code: bucket.toUpperCase() }],
            retryAfterSeconds,
        )
    }
}
