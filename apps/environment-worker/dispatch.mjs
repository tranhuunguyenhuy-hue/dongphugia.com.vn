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

function validIdentity(request, environment) {
  if (!['preview', 'staging'].includes(environment.APP_ENV)) return false
  if (environment.PREVIEW_NOINDEX !== 'true') return false
  if (!SOURCE_SHA.test(environment.BUILD_SOURCE_SHA || '')) return false

  try {
    const origin = new URL(environment.APP_ORIGIN)
    const expectedHost = environment.APP_ENV === 'preview'
      ? 'dpg-preview.tranhuunguyenhuy.workers.dev'
      : 'dpg-staging.tranhuunguyenhuy.workers.dev'
    const requestUrl = new URL(request.url)
    const localRequest = ['localhost', '127.0.0.1'].includes(requestUrl.hostname)
    return origin.protocol === 'https:' && origin.hostname === expectedHost
      && (localRequest || origin.origin === requestUrl.origin)
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

      // Both frameworks emit static files outside their rendered HTML. Since
      // Worker-first routing sends these requests through this dispatcher,
      // resolve existing asset files here before handing app routes to SSR.
      if (request.method === 'GET' || request.method === 'HEAD') {
        const assetResponse = await environment.ASSETS.fetch(request)
        if (assetResponse.status !== 404) {
          const isAdminAsset = hasAdminPath(new URL(request.url).pathname)
          return addHeaders(assetResponse, {
            ...identity,
            'Cache-Control': assetResponse.headers.get('Cache-Control') || 'public, max-age=31536000, immutable',
            'X-DPG-App': isAdminAsset ? 'admin' : 'public',
          })
        }
      }

      if (hasAdminPath(new URL(request.url).pathname)) {
        const adminEnvironment = {
          ...common,
          APP_BUILD_TARGET: 'admin',
          ADMIN_BASE_PATH,
          NEXT_PUBLIC_SUPABASE_URL: environment.NEXT_PUBLIC_SUPABASE_URL,
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        }
        const response = await adminWorker.fetch(request, adminEnvironment, context)
        return addHeaders(response, {
          ...identity,
          'Cache-Control': response.headers.get('Cache-Control') || 'private, no-store',
          'X-DPG-App': 'admin',
        })
      }

      const publicEnvironment = { ...common, APP_BUILD_TARGET: 'public' }
      const response = await publicWorker.fetch(request, publicEnvironment, context)
      return addHeaders(response, {
        'X-DPG-Source-SHA': environment.BUILD_SOURCE_SHA,
        'X-Robots-Tag': 'noindex, nofollow',
        'X-DPG-App': 'public',
      })
    },
  }
}

export { hasAdminPath }
