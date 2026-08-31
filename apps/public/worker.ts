import vinextHandler from 'vinext/server/fetch-handler'

import {
  assertPreviewRuntime,
  createCacheKey,
  isAnonymousCacheCandidate,
  isCacheableResponse,
  isForbiddenInternalControlRequest,
  PRIVATE_CACHE_CONTROL,
  PUBLIC_BROWSER_CACHE_CONTROL,
  PUBLIC_EDGE_CACHE_CONTROL,
  PUBLIC_PREVIEW_ROBOTS_HEADER,
  type PublicWorkerEnvironment,
  withHeaders,
} from './src/worker-policy'

declare const __DPG_BUILD_SOURCE_SHA__: string

const sourceIdentityHeader = { 'X-DPG-Source-SHA': __DPG_BUILD_SOURCE_SHA__ }

export default {
  async fetch(
    request: Request,
    environment: PublicWorkerEnvironment,
    context: ExecutionContext,
  ) {
    try {
      assertPreviewRuntime(request, environment)
    } catch {
      return new Response('Preview configuration rejected.', {
        status: 503,
        headers: {
          'Cache-Control': PRIVATE_CACHE_CONTROL,
          'X-Robots-Tag': PUBLIC_PREVIEW_ROBOTS_HEADER,
        },
      })
    }

    if (isForbiddenInternalControlRequest(request)) {
      return new Response('Not found.', {
        status: 404,
        headers: {
          'Cache-Control': PRIVATE_CACHE_CONTROL,
          'X-Robots-Tag': PUBLIC_PREVIEW_ROBOTS_HEADER,
        },
      })
    }

    const cacheCandidate = isAnonymousCacheCandidate(request)
    const cacheKey = cacheCandidate ? createCacheKey(request, __DPG_BUILD_SOURCE_SHA__) : null
    const workerCache = cacheKey ? await caches.open('dongphugia-public-v1') : null

    if (cacheKey && workerCache) {
      const cached = await workerCache.match(cacheKey)
      if (cached) {
        return withHeaders(cached, {
          ...sourceIdentityHeader,
          'Cache-Control': PUBLIC_BROWSER_CACHE_CONTROL,
          'CDN-Cache-Control': PUBLIC_EDGE_CACHE_CONTROL,
          'X-DPG-Cache': 'HIT',
          'X-Robots-Tag': PUBLIC_PREVIEW_ROBOTS_HEADER,
        })
      }
    }

    const rendered = await vinextHandler.fetch(request, environment, context)
    if (!cacheKey || !isCacheableResponse(rendered)) {
      return withHeaders(rendered, {
        ...sourceIdentityHeader,
        'Cache-Control': PRIVATE_CACHE_CONTROL,
        'X-DPG-Cache': 'BYPASS',
        'X-Robots-Tag': PUBLIC_PREVIEW_ROBOTS_HEADER,
      })
    }

    const stored = withHeaders(rendered.clone(), {
      ...sourceIdentityHeader,
      'Cache-Control': PUBLIC_EDGE_CACHE_CONTROL,
      'X-DPG-Cache': 'STORED',
      'X-Robots-Tag': PUBLIC_PREVIEW_ROBOTS_HEADER,
    })
    context.waitUntil(workerCache!.put(cacheKey, stored))

    return withHeaders(rendered, {
      ...sourceIdentityHeader,
      'Cache-Control': PUBLIC_BROWSER_CACHE_CONTROL,
      'CDN-Cache-Control': PUBLIC_EDGE_CACHE_CONTROL,
      'X-DPG-Cache': 'MISS',
      'X-Robots-Tag': PUBLIC_PREVIEW_ROBOTS_HEADER,
    })
  },
}
