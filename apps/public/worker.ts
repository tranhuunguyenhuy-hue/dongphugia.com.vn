import vinextHandler from 'vinext/server/fetch-handler'

import {
  assertPublicRuntime,
  createCacheKey,
  isAnonymousCacheCandidate,
  isCacheableResponse,
  isForbiddenInternalControlRequest,
  isTemporarilyUnavailablePublicPath,
  PRIVATE_CACHE_CONTROL,
  PUBLIC_BROWSER_CACHE_CONTROL,
  PUBLIC_EDGE_CACHE_CONTROL,
  PUBLIC_PREVIEW_ROBOTS_HEADER,
  temporaryUnavailablePublicResponse,
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
    let mode: 'preview' | 'production'
    try {
      mode = assertPublicRuntime(request, environment)
    } catch {
      return new Response('Preview configuration rejected.', {
        status: 503,
        headers: {
          'Cache-Control': PRIVATE_CACHE_CONTROL,
          ...(environment.APP_ENV === 'preview' &&
          !['dongphugia.vn', 'www.dongphugia.vn'].includes(new URL(request.url).hostname.toLowerCase())
            ? { 'X-Robots-Tag': PUBLIC_PREVIEW_ROBOTS_HEADER }
            : {}),
        },
      })
    }

    const robotsHeader: Record<string, string> = mode === 'preview'
      ? { 'X-Robots-Tag': PUBLIC_PREVIEW_ROBOTS_HEADER }
      : {}

    if (isForbiddenInternalControlRequest(request)) {
      return new Response('Not found.', {
        status: 404,
        headers: {
          'Cache-Control': PRIVATE_CACHE_CONTROL,
          ...robotsHeader,
        },
      })
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed.', {
        status: 405,
        headers: { 'Cache-Control': PRIVATE_CACHE_CONTROL, Allow: 'GET, HEAD', ...robotsHeader },
      })
    }

    // Preserve the browser's conventional favicon URL through the existing
    // immutable SVG asset. No second media copy or unverified asset is added.
    if (new URL(request.url).pathname === '/favicon.ico') {
      if (!environment.ASSETS) return new Response('Asset unavailable.', {
        status: 503,
        headers: { 'Cache-Control': PRIVATE_CACHE_CONTROL, ...robotsHeader },
      })
      const iconUrl = new URL('/images/logo-icon.svg', request.url)
      const icon = await environment.ASSETS.fetch(new Request(iconUrl, request))
      return withHeaders(icon, { ...sourceIdentityHeader, ...robotsHeader })
    }

    if (isTemporarilyUnavailablePublicPath(request)) {
      return temporaryUnavailablePublicResponse(request, mode === 'preview')
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
          ...robotsHeader,
        })
      }
    }

    const rendered = await vinextHandler.fetch(request, environment, context)
    if (!cacheKey || !isCacheableResponse(rendered)) {
      return withHeaders(rendered, {
        ...sourceIdentityHeader,
        'Cache-Control': PRIVATE_CACHE_CONTROL,
        'X-DPG-Cache': 'BYPASS',
        ...robotsHeader,
      })
    }

    const stored = withHeaders(rendered.clone(), {
      ...sourceIdentityHeader,
      'Cache-Control': PUBLIC_EDGE_CACHE_CONTROL,
      'X-DPG-Cache': 'STORED',
      ...robotsHeader,
    })
    context.waitUntil(workerCache!.put(cacheKey, stored))

    return withHeaders(rendered, {
      ...sourceIdentityHeader,
      'Cache-Control': PUBLIC_BROWSER_CACHE_CONTROL,
      'CDN-Cache-Control': PUBLIC_EDGE_CACHE_CONTROL,
      'X-DPG-Cache': 'MISS',
      ...robotsHeader,
    })
  },
}
