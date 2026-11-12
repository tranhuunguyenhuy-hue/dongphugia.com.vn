const ADMIN_BASE_PATH = '/admin'
const PRIVILEGED_BINDING = /(CLOUDFLARE_API_TOKEN|SERVICE_ROLE|AUTH_ADMIN|SECRET|PASSWORD|DATABASE_URL|DIRECT_URL|PRIVATE_KEY|BUNNY_API_KEY)/i
const SOURCE_SHA = /^[0-9a-f]{40}$/

function addHeaders(response, additions) {
  const headers = new Headers(response.headers)
  for (const [name, value] of Object.entries(additions)) headers.set(name, value)
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

function hasAdminPath(pathname) {
  return pathname === ADMIN_BASE_PATH || pathname.startsWith(`${ADMIN_BASE_PATH}/`)
}

function keepRedirectInsideAdmin(response, request) {
  if (![301, 302, 303, 307, 308].includes(response.status)) return response
  const location = response.headers.get('Location')
  if (!location) return response

  try {
    const requestUrl = new URL(request.url)
    const redirectUrl = new URL(location, requestUrl)
    if (redirectUrl.origin !== requestUrl.origin || hasAdminPath(redirectUrl.pathname)) return response
    redirectUrl.pathname = `${ADMIN_BASE_PATH}${redirectUrl.pathname === '/' ? '' : redirectUrl.pathname}`
    return addHeaders(response, { Location: `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}` })
  } catch {
    return response
  }
}

function validIdentity(request, environment) {
  if (!['preview', 'staging'].includes(environment.APP_ENV)) return false
  if (environment.PREVIEW_NOINDEX !== 'true') return false
  if (!SOURCE_SHA.test(environment.BUILD_SOURCE_SHA || '')) return false

  try {
    const origin = new URL(environment.APP_ORIGIN)
    const requestUrl = new URL(request.url)
    if (origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password) return false
    const localOrigin = environment.APP_ENV === 'preview'
      && origin.protocol === 'http:'
      && ['localhost', '127.0.0.1'].includes(origin.hostname)
    const stagingOrigin = environment.APP_ENV === 'staging'
      && origin.protocol === 'https:'
      && origin.hostname === 'dpg-staging.tranhuunguyenhuy.workers.dev'
    const localRequest = requestUrl.protocol === 'http:'
      && ['localhost', '127.0.0.1'].includes(requestUrl.hostname)
    return (localOrigin && origin.origin === requestUrl.origin)
      || (stagingOrigin && (origin.origin === requestUrl.origin || localRequest))
  } catch {
    return false
  }
}

function sharedEnvironment(environment) {
  for (const name of Object.keys(environment)) {
    if (PRIVILEGED_BINDING.test(name)) return null
  }
  return {
    APP_ENV: environment.APP_ENV,
    APP_ORIGIN: environment.APP_ORIGIN,
    PREVIEW_NOINDEX: 'true',
    BUILD_SOURCE_SHA: environment.BUILD_SOURCE_SHA,
    ASSETS: environment.ASSETS,
    PUBLIC_CATALOGUE_SOURCE: 'production-published-snapshot',
  }
}

export function createEnvironmentWorker({ publicWorker, adminWorker }) {
  if (!publicWorker || typeof publicWorker.fetch !== 'function'
    || !adminWorker || typeof adminWorker.fetch !== 'function') {
    throw new Error('ENVIRONMENT_WORKER_APPLICATION_HANDLER_REQUIRED')
  }

  return {
    async fetch(request, environment, context) {
      const identity = {
        'X-DPG-Source-SHA': environment.BUILD_SOURCE_SHA || 'unknown',
        'X-Robots-Tag': 'noindex, nofollow',
      }
      if (!validIdentity(request, environment)) {
        return new Response('Environment configuration rejected.', {
          status: 503,
          headers: { ...identity, 'Cache-Control': 'private, no-store' },
        })
      }

      if (!environment.ASSETS || typeof environment.ASSETS.fetch !== 'function') {
        return new Response('Environment configuration rejected.', {
          status: 503,
          headers: { ...identity, 'Cache-Control': 'private, no-store' },
        })
      }

      const common = sharedEnvironment(environment)
      if (!common) {
        return new Response('Environment configuration rejected.', {
          status: 503,
          headers: { ...identity, 'Cache-Control': 'private, no-store' },
        })
      }

      const isAdminRequest = hasAdminPath(new URL(request.url).pathname)
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('This environment allows read-only requests.', {
          status: 405,
          headers: {
            ...identity,
            'Cache-Control': 'private, no-store',
            Allow: 'GET, HEAD',
            'X-DPG-App': isAdminRequest ? 'admin' : 'public',
            ...(isAdminRequest ? {
              'X-DPG-Authentication': 'disabled',
              'X-DPG-Private-Data': 'unavailable',
            } : {}),
          },
        })
      }

      // Both frameworks emit static files outside their rendered HTML. Since
      // Worker-first routing sends these requests through this dispatcher,
      // resolve existing asset files here before handing app routes to SSR.
      if (request.method === 'GET' || request.method === 'HEAD') {
        const assetResponse = await environment.ASSETS.fetch(request)
        if (assetResponse.status !== 404) {
          return addHeaders(assetResponse, {
            ...identity,
            'Cache-Control': assetResponse.headers.get('Cache-Control') || 'public, max-age=31536000, immutable',
            'X-DPG-App': isAdminRequest ? 'admin' : 'public',
            ...(isAdminRequest ? {
              'X-DPG-Authentication': 'disabled',
              'X-DPG-Private-Data': 'unavailable',
            } : {}),
          })
        }
      }

      if (hasAdminPath(new URL(request.url).pathname)) {
        const adminEnvironment = {
          ...common,
          APP_BUILD_TARGET: 'admin',
          ADMIN_BASE_PATH,
          ADMIN_AUTH_ENABLED: 'false',
          NEXT_PUBLIC_ADMIN_AUTH_ENABLED: 'false',
        }
        const response = keepRedirectInsideAdmin(
          await adminWorker.fetch(request, adminEnvironment, context),
          request,
        )
        return addHeaders(response, {
          ...identity,
          'Cache-Control': response.headers.get('Cache-Control') || 'private, no-store',
          'X-DPG-App': 'admin',
          'X-DPG-Authentication': 'disabled',
          'X-DPG-Private-Data': 'unavailable',
        })
      }

      const publicEnvironment = { ...common, APP_BUILD_TARGET: 'public' }
      const response = await publicWorker.fetch(request, publicEnvironment, context)
      return addHeaders(response, {
        'X-DPG-Source-SHA': environment.BUILD_SOURCE_SHA,
        'X-Robots-Tag': 'noindex, nofollow',
        'X-DPG-App': 'public',
        'X-DPG-Data-Source': 'production-published-public-catalogue',
      })
    },
  }
}

export { hasAdminPath }
