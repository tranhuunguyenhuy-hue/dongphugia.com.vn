import vinextHandler from 'vinext/server/fetch-handler'
import {exceptionCategory} from '../../scripts/catalogue-direct/preview-diagnostic-safety.mjs'
import { publicSnapshotCheckpoint } from './src/runtime/public-snapshot-mode'
import {servePrerenderedCatalogue} from './src/runtime/prerendered-catalogue'
import {readBoundedPublicAssetText} from './src/runtime/bounded-public-asset'

import {
  assertPublicRuntime,
  classifyPublicApiRequest,
  createCacheKey,
  isAnonymousCacheCandidate,
  isCacheableResponse,
  isForbiddenInternalControlRequest,
  PRIVATE_CACHE_CONTROL,
  PUBLIC_BROWSER_CACHE_CONTROL,
  PUBLIC_EDGE_CACHE_CONTROL,
  publicRuntimeRejectionDiagnostics,
  robotsHeader,
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
    const robotValue = robotsHeader(request, environment)
    const robotHeaders: Record<string, string> = robotValue ? { 'X-Robots-Tag': robotValue } : {}
    try {
    try {
      assertPublicRuntime(request, environment)
    } catch (error) {
      console.error(JSON.stringify({
        event: 'PUBLIC_RUNTIME_CONFIGURATION_REJECTED',
        ...publicRuntimeRejectionDiagnostics(request, environment, error),
      }))
      return new Response('Public configuration rejected.', {
        status: 503,
        headers: {
          'Cache-Control': PRIVATE_CACHE_CONTROL,
          ...robotHeaders,
        },
      })
    }

    if (environment.APP_ENV === 'production' && new URL(request.url).hostname === 'dongphugia.vn') {
      const destination = new URL(request.url)
      destination.protocol = 'https:'
      destination.hostname = 'www.dongphugia.vn'
      return Response.redirect(destination, 301)
    }

    if (isForbiddenInternalControlRequest(request)) {
      return new Response('Not found.', {
        status: 404,
        headers: {
          'Cache-Control': PRIVATE_CACHE_CONTROL,
          ...robotHeaders,
        },
      })
    }

    const publicApiDecision = classifyPublicApiRequest(request)
    if (publicApiDecision === 'not-found' || publicApiDecision === 'method-not-allowed') {
      return new Response(publicApiDecision === 'not-found' ? 'Not found.' : 'Method not allowed.', {
        status: publicApiDecision === 'not-found' ? 404 : 405,
        headers: {
          'Cache-Control': PRIVATE_CACHE_CONTROL,
          ...robotHeaders,
          ...(publicApiDecision === 'method-not-allowed' ? { Allow: 'GET, HEAD' } : {}),
          ...sourceIdentityHeader,
        },
      })
    }

    const databaseMode = environment.PUBLIC_CATALOGUE_SOURCE === 'postgresql'
    if (databaseMode && !environment.PUBLIC_DB) {
      return new Response('Database temporarily unavailable.', {status:503,headers:{
        'Cache-Control':PRIVATE_CACHE_CONTROL,...robotHeaders,...sourceIdentityHeader,
      }})
    }
    if (!databaseMode) {
      const prerendered=await servePrerenderedCatalogue(request,environment,__DPG_BUILD_SOURCE_SHA__)
      if(prerendered)return prerendered
    }
    const pathname = new URL(request.url).pathname
    const catalogueRequest = pathname === '/' || ['thiet-bi-ve-sinh','thiet-bi-bep','vat-lieu-nuoc','gach-op-lat'].some(root => pathname === `/${root}` || pathname.startsWith(`/${root}/`))
    if (!databaseMode && publicSnapshotCheckpoint() && catalogueRequest) {
      const assets = environment.ASSETS as { fetch?: (url: string) => Promise<Response> } | undefined
      let ready = false
      try {
        const response = await assets?.fetch?.('https://catalogue-assets.invalid/__catalogue/v1/manifest.json')
        if (response?.ok) {
          const manifest = JSON.parse(await readBoundedPublicAssetText(response)) as { contract?: string; checkpoint?: string }
          ready = manifest.contract === 'dpg:public-catalogue-snapshot:v1' && manifest.checkpoint === publicSnapshotCheckpoint()
        }
      } catch { /* No raw asset/error response is disclosed. */ }
      if (!ready) return new Response('Catalogue temporarily unavailable.', {status:503,headers:{
        'Cache-Control':PRIVATE_CACHE_CONTROL,...robotHeaders,...sourceIdentityHeader,
      }})
    }
    // Production keeps its existing anonymous HTML cache. Preview and Staging
    // always reflect the current published catalogue and never persist page
    // responses in the local/deployment Worker Cache API.
    const cacheCandidate = environment.APP_ENV === 'production' && isAnonymousCacheCandidate(request)
    const cacheKey = cacheCandidate ? createCacheKey(request, __DPG_BUILD_SOURCE_SHA__, publicSnapshotCheckpoint()) : null
    const workerCache = cacheKey ? await caches.open('dongphugia-public-v1') : null

    if (cacheKey && workerCache) {
      const cached = await workerCache.match(cacheKey)
      if (cached) {
        return withHeaders(cached, {
          ...sourceIdentityHeader,
          'Cache-Control': PUBLIC_BROWSER_CACHE_CONTROL,
          'CDN-Cache-Control': PUBLIC_EDGE_CACHE_CONTROL,
          'X-DPG-Cache': 'HIT',
          ...robotHeaders,
        })
      }
    }

    const rendered = await vinextHandler.fetch(request, environment, context)
    if (!cacheKey || !isCacheableResponse(rendered)) {
      return withHeaders(rendered, {
        ...sourceIdentityHeader,
        'Cache-Control': PRIVATE_CACHE_CONTROL,
        'X-DPG-Cache': 'BYPASS',
        ...robotHeaders,
      })
    }

    const stored = withHeaders(rendered.clone(), {
      ...sourceIdentityHeader,
      'Cache-Control': PUBLIC_EDGE_CACHE_CONTROL,
      'X-DPG-Cache': 'STORED',
      ...robotHeaders,
    })
    context.waitUntil(workerCache!.put(cacheKey, stored))

    return withHeaders(rendered, {
      ...sourceIdentityHeader,
      'Cache-Control': PUBLIC_BROWSER_CACHE_CONTROL,
      'CDN-Cache-Control': PUBLIC_EDGE_CACHE_CONTROL,
      'X-DPG-Cache': 'MISS',
      ...robotHeaders,
    })
    } catch(error:unknown) {
      let category='UNCLASSIFIED_EXCEPTION'
      try {if(error&&typeof error==='object'&&'message' in error)category=String(exceptionCategory(error.message))}catch{/* no introspection failure is disclosed */}
      console.error(JSON.stringify({event:'PUBLIC_RENDER_FAILURE',category}))
      return new Response('Catalogue temporarily unavailable.',{status:503,headers:{
        ...sourceIdentityHeader,'Cache-Control':PRIVATE_CACHE_CONTROL,...robotHeaders,
        'X-DPG-Render-Failure':category,
      }})
    }
  },
}
