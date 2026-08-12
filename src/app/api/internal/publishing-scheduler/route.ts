import { getPublishingRuntimeConfig, requirePublishingSchedulerToken } from '@/lib/publishing/config'
import { publishingJson, withPublishingRoute } from '@/lib/publishing/http'
import { runPublishingScheduler } from '@/lib/publishing/scheduler'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Internal invocation endpoint for the repository-owned one-shot scheduler.
 * It intentionally accepts a scheduler token, not a Publishing Agent Bearer
 * credential, so scheduled work remains authorized after credential rotation.
 */
export async function POST(request: Request) {
    return withPublishingRoute(request, async () => {
        requirePublishingSchedulerToken(request)
        const result = await runPublishingScheduler({
            config: getPublishingRuntimeConfig(),
        })
        return publishingJson(result)
    })
}
