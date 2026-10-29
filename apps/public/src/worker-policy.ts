// next.config.ts loads this module while Next compiles the config itself, before
// TypeScript path aliases are available. Keep this boundary runtime-resolvable
// without changing the public app's package alias contract elsewhere.
import { PUBLIC_EDGE_CACHE_SECONDS, PUBLIC_ROUTE_OWNERSHIP } from '../../../packages/app-contracts/src/index'

export type PublicWorkerEnvironment = Readonly<{
  APP_ENV: string
  APP_BUILD_TARGET: string
  APP_ORIGIN: string
  PREVIEW_NOINDEX: string
  [name: string]: unknown
}>

const PRODUCTION_HOSTS = new Set(['dongphugia.vn', 'www.dongphugia.vn'])
const CACHEABLE_METHODS = new Set(['GET', 'HEAD'])
const CACHEABLE_PATHS = new Set(['/'])
const FORBIDDEN_INTERNAL_HEADERS = [
  'x-prerender-revalidate',
  'x-prerender-revalidate-if-generated',
  'x-vinext-prerender-secret',
  'x-vinext-prerender-route-params',
  'x-vinext-prerender-speculative',
  'x-vinext-revalidate',
] as const
const PRIVILEGED_RUNTIME_BINDING_PATTERN =
  /(SERVICE_ROLE|AUTH_ADMIN|ADMIN_SESSION|SECRET|PASSWORD|DATABASE_URL|DIRECT_URL|PRIVATE_KEY|CREDENTIAL|CLOUDFLARE_API_TOKEN|BUNNY_API_KEY)/i
const LISTING_API_FAMILIES = new Set(['thiet-bi-ve-sinh', 'thiet-bi-bep', 'vat-lieu-nuoc', 'gach-op-lat'])
const LISTING_API_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const PRIVATE_CACHE_CONTROL = 'private, no-store'
export const PUBLIC_BROWSER_CACHE_CONTROL = 'public, max-age=0, must-revalidate'
export const PUBLIC_EDGE_CACHE_CONTROL = `public, max-age=${PUBLIC_EDGE_CACHE_SECONDS}, must-revalidate`
export const PUBLIC_PREVIEW_ROBOTS_HEADER = 'noindex, nofollow'

export function assertPreviewRuntime(request: Request, environment: PublicWorkerEnvironment) {
  const hostname = new URL(request.url).hostname.toLowerCase()
  let configuredOrigin: URL
  try {
    configuredOrigin = new URL(environment.APP_ORIGIN)
  } catch {
    throw new Error('PUBLIC_WORKER_PREVIEW_ORIGIN_INVALID')
  }
  if (
    environment.APP_ENV !== 'preview' ||
    environment.APP_BUILD_TARGET !== 'public' ||
    environment.PREVIEW_NOINDEX !== 'true'
  ) throw new Error('PUBLIC_WORKER_PREVIEW_CONFIGURATION_REQUIRED')
  if (
    configuredOrigin.protocol !== 'https:' ||
    configuredOrigin.username ||
    configuredOrigin.password ||
    configuredOrigin.pathname !== '/' ||
    configuredOrigin.search ||
    configuredOrigin.hash ||
    configuredOrigin.hostname === 'dongphugia.vn' ||
    configuredOrigin.hostname.endsWith('.dongphugia.vn')
  ) throw new Error('PUBLIC_WORKER_PREVIEW_ORIGIN_INVALID')
  for (const name of Object.keys(environment)) {
    if (PRIVILEGED_RUNTIME_BINDING_PATTERN.test(name)) {
      throw new Error(`PUBLIC_WORKER_PRIVILEGED_BINDING_FORBIDDEN:${name}`)
    }
  }
  if (PRODUCTION_HOSTS.has(hostname) || hostname.endsWith('.dongphugia.vn')) {
    throw new Error('PUBLIC_WORKER_PREVIEW_PRODUCTION_HOST_FORBIDDEN')
  }
}

export function isAnonymousCacheCandidate(request: Request) {
  const url = new URL(request.url)
  return (
    CACHEABLE_METHODS.has(request.method) &&
    CACHEABLE_PATHS.has(url.pathname) &&
    url.search === '' &&
    !request.headers.has('authorization') &&
    !request.headers.has('cookie')
  )
}

export function isForbiddenInternalControlRequest(request: Request) {
  const pathname = new URL(request.url).pathname
  const cookie = request.headers.get('cookie') || ''
  return (
    pathname.startsWith('/__vinext/prerender/') ||
    FORBIDDEN_INTERNAL_HEADERS.some((name) => request.headers.has(name)) ||
    /(?:^|;\s*)(?:__prerender_bypass|__next_preview_data)=/i.test(cookie)
  )
}

export type PublicApiRequestDecision = 'not-api' | 'allow' | 'not-found' | 'method-not-allowed'

export function classifyPublicApiRequest(request: Request): PublicApiRequestDecision {
  const { pathname } = new URL(request.url)
  if (!pathname.startsWith('/api/')) return 'not-api'

  const ownsHealth = PUBLIC_ROUTE_OWNERSHIP.some((route) =>
    route.owner === 'public' && route.path === '/api/health' && route.purpose === 'runtime-probe',
  ) && pathname === '/api/health'
  const ownsListingShardRoute = PUBLIC_ROUTE_OWNERSHIP.some((route) =>
    route.owner === 'public'
      && route.path === '/api/catalogue/listings/[categorySlug]/[listingSlug]'
      && route.purpose === 'catalogue-listing-snapshot-readonly',
  ) && /^\/api\/catalogue\/listings\/([^/]+)\/([^/]+)$/.test(pathname)

  const listingMatch = pathname.match(/^\/api\/catalogue\/listings\/([^/]+)\/([^/]+)$/)
  const validListingRoute = ownsListingShardRoute
    && listingMatch !== null
    && LISTING_API_FAMILIES.has(listingMatch[1])
    && LISTING_API_SLUG.test(listingMatch[2])
  if (!ownsHealth && !validListingRoute) return 'not-found'
  if (request.method !== 'GET' && request.method !== 'HEAD') return 'method-not-allowed'
  return 'allow'
}

export function createCacheKey(request: Request, sourceCommit: string, catalogueCheckpoint: string | null = null) {
  if (!/^[0-9a-f]{40}$/.test(sourceCommit)) throw new Error('PUBLIC_WORKER_CACHE_SOURCE_INVALID')
  const url = new URL(request.url)
  url.search = ''
  url.hash = ''
  url.searchParams.set('__dpg_source', sourceCommit)
  if (catalogueCheckpoint) {
    if (!/^[0-9a-f]{40}$/.test(catalogueCheckpoint)) throw new Error('PUBLIC_CATALOGUE_CHECKPOINT_INVALID')
    url.searchParams.set('__dpg_catalogue', catalogueCheckpoint)
  }
  return new Request(url.toString(), { method: 'GET' })
}

export function withHeaders(response: Response, headers: Record<string, string>) {
  const nextHeaders = new Headers(response.headers)
  for (const [name, value] of Object.entries(headers)) nextHeaders.set(name, value)
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: nextHeaders,
  })
}

export function isCacheableResponse(response: Response) {
  return (
    response.status === 200 &&
    response.headers.get('content-type')?.includes('text/html') === true &&
    !response.headers.has('set-cookie')
  )
}
