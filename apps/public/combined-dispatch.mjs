const ADMIN_BASE_PATH = '/admin'
const ADMIN_SESSION_COOKIE = 'dpg-admin-session'
const PUBLIC_HOSTS = new Set([
  'dongphugia.vn',
  'www.dongphugia.vn',
  'dongphugia-v1-public-production.tranhuunguyenhuy.workers.dev',
])
const ADMIN_NOINDEX = 'noindex, nofollow'
const PRIVATE_CACHE_CONTROL = 'private, no-store'
const STATIC_PATHS = [
  '/_next/static/',
  '/admin/_next/static/',
  '/_vinext/',
  '/images/',
  '/fonts/',
  '/__catalogue/v1/',
]
const STATIC_FILE = /\.(?:css|js|mjs|map|png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|otf|wasm|json|txt)$/i

function fail(status, message, sourceSha) {
  const headers = new Headers({ 'Cache-Control': PRIVATE_CACHE_CONTROL })
  if (sourceSha) headers.set('X-DPG-Source-SHA', sourceSha)
  return new Response(message, { status, headers })
}

function withHeaders(response, additions) {
  const headers = new Headers(response.headers)
  for (const [name, value] of Object.entries(additions)) headers.set(name, value)
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

function isAdminPath(pathname) {
  return pathname === ADMIN_BASE_PATH || pathname.startsWith(`${ADMIN_BASE_PATH}/`)
}

function isStaticAssetPath(pathname) {
  return STATIC_PATHS.some((prefix) => pathname.startsWith(prefix))
    || pathname === '/favicon.ico'
    || pathname === '/robots.txt'
    || STATIC_FILE.test(pathname)
}

function stripAdminSessionCookie(request) {
  const cookie = request.headers.get('cookie')
  if (!cookie) return request
  const remaining = cookie.split(';').map((part) => part.trim()).filter((part) =>
    part && part.split('=', 1)[0]?.trim() !== ADMIN_SESSION_COOKIE,
  )
  const headers = new Headers(request.headers)
  if (remaining.length) headers.set('cookie', remaining.join('; '))
  else headers.delete('cookie')
  return new Request(request, { headers })
}

function assetRequestWithoutCredentials(request) {
  const headers = new Headers(request.headers)
  headers.delete('cookie')
  headers.delete('authorization')
  return new Request(request, { headers })
}

function publicEnvironment(environment) {
  return {
    APP_ENV: environment.APP_ENV,
    APP_BUILD_TARGET: 'public',
    APP_ORIGIN: environment.APP_ORIGIN,
    PREVIEW_NOINDEX: environment.PREVIEW_NOINDEX ?? 'false',
    BUILD_SOURCE_SHA: environment.BUILD_SOURCE_SHA,
    PUBLIC_CATALOGUE_SOURCE: environment.PUBLIC_CATALOGUE_SOURCE,
    PUBLIC_CATALOGUE_CHECKPOINT: environment.PUBLIC_CATALOGUE_CHECKPOINT,
    ASSETS: environment.ASSETS,
  }
}

function adminEnvironment(environment) {
  return {
    APP_ENV: environment.APP_ENV,
    PREVIEW_NOINDEX: environment.PREVIEW_NOINDEX ?? 'false',
    RUNTIME_ROLE: 'production',
    WRITE_FREEZE_MODE: 'false',
    PRISMA_REQUEST_SCOPE_REQUIRED: 'true',
    HYPERDRIVE_ADMIN_NO_CACHE: environment.HYPERDRIVE_ADMIN_NO_CACHE,
    ASSETS: environment.ASSETS,
  }
}

export function createCombinedProductionWorker({ publicWorker, adminWorker }) {
  if (!publicWorker || typeof publicWorker.fetch !== 'function'
    || !adminWorker || typeof adminWorker.fetch !== 'function') {
    throw new Error('COMBINED_WORKER_HANDLERS_REQUIRED')
  }

  return {
    async fetch(request, environment, context) {
      const { pathname, hostname } = new URL(request.url)
      const sourceSha = typeof environment.BUILD_SOURCE_SHA === 'string' ? environment.BUILD_SOURCE_SHA : undefined
      const adminPath = isAdminPath(pathname)

      const localHost = ['localhost', '127.0.0.1'].includes(hostname)
      if (!PUBLIC_HOSTS.has(hostname) && !localHost) {
        return fail(404, 'Not found.', sourceSha)
      }
      if (!environment.ASSETS || typeof environment.ASSETS.fetch !== 'function') {
        return fail(503, 'Worker assets binding is unavailable.', sourceSha)
      }

      if ((request.method === 'GET' || request.method === 'HEAD')
        && isStaticAssetPath(pathname)
        && environment.ASSETS && typeof environment.ASSETS.fetch === 'function') {
        const asset = await environment.ASSETS.fetch(assetRequestWithoutCredentials(request))
        if (asset.status !== 404) {
          return withHeaders(asset, {
            ...(sourceSha ? { 'X-DPG-Source-SHA': sourceSha } : {}),
            ...(adminPath || pathname.startsWith('/admin/_next/') ? { 'X-Robots-Tag': ADMIN_NOINDEX } : {}),
            'Cache-Control': asset.headers.get('Cache-Control') || 'public, max-age=31536000, immutable',
          })
        }
      }

      if (adminPath) {
        if (!environment.HYPERDRIVE_ADMIN_NO_CACHE
          || typeof environment.HYPERDRIVE_ADMIN_NO_CACHE.connectionString !== 'string'
          || !environment.HYPERDRIVE_ADMIN_NO_CACHE.connectionString) {
          return fail(503, 'Admin database binding is unavailable.', sourceSha)
        }
        const response = await adminWorker.fetch(request, adminEnvironment(environment), context)
        return withHeaders(response, {
          ...(sourceSha ? { 'X-DPG-Source-SHA': sourceSha } : {}),
          'X-Robots-Tag': ADMIN_NOINDEX,
          'Cache-Control': PRIVATE_CACHE_CONTROL,
        })
      }

      // Public is an anonymous, read-only projection. Never pass the Admin
      // session cookie, database binding, role, or mutation controls to it.
      const publicRequest = stripAdminSessionCookie(request)
      const response = await publicWorker.fetch(publicRequest, publicEnvironment(environment), context)
      return response
    },
  }
}

export { isAdminPath, publicEnvironment }
