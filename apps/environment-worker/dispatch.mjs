const ADMIN_BASE_PATH = '/admin'
const PRIVILEGED_BINDING = /(CLOUDFLARE_API_TOKEN|SERVICE_ROLE|AUTH_ADMIN|SECRET|PASSWORD|DATABASE_URL|DIRECT_URL|PRIVATE_KEY|BUNNY_API_KEY)/i
const SOURCE_SHA = /^[0-9a-f]{40}$/
const ADMIN_UNAVAILABLE_HTML = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Admin không khả dụng</title></head>
<body style="margin:0;background:#f8fafc;color:#172033;font:16px/1.6 system-ui,sans-serif">
<main style="box-sizing:border-box;max-width:38rem;margin:12vh auto;padding:2rem;background:#fff;border:1px solid #dbe2ea;border-radius:1rem">
<h1 style="margin-top:0;font-size:1.5rem">Admin không khả dụng trong môi trường này</h1>
<p>Không bật xác thực Production và không cung cấp dữ liệu riêng tư của nhân viên hoặc khách hàng ở đây.</p>
<p>Môi trường này chỉ cho phép đọc catalogue công khai. Đăng nhập, khôi phục tài khoản và mọi thao tác ghi đều bị tắt.</p>
</main></body></html>`

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
    const requestUrl = new URL(request.url)
    const localRequest = ['localhost', '127.0.0.1'].includes(requestUrl.hostname)
    if (environment.APP_ENV === 'preview') {
      return origin.protocol === 'http:' && ['localhost','127.0.0.1'].includes(origin.hostname)
        && localRequest
    }
    return origin.protocol === 'https:' && origin.hostname === 'dpg-staging.tranhuunguyenhuy.workers.dev'
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
    PUBLIC_CATALOGUE_SOURCE: 'production-published-snapshot',
  }
}

export function createEnvironmentWorker({ publicWorker }) {
  if (!publicWorker || typeof publicWorker.fetch !== 'function') {
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

      if (request.method !== 'GET' && request.method !== 'HEAD') {
        const isAdminRequest = hasAdminPath(new URL(request.url).pathname)
        return new Response('This environment allows read-only requests.', {
          status: 405,
          headers: {
            ...identity,
            'Cache-Control': 'private, no-store',
            Allow: 'GET, HEAD',
            'X-DPG-App': isAdminRequest ? 'admin' : 'public',
            ...(isAdminRequest ? { 'X-DPG-Private-Data': 'unavailable' } : {}),
          },
        })
      }

      if (hasAdminPath(new URL(request.url).pathname)) {
        return new Response(request.method === 'HEAD' ? null : ADMIN_UNAVAILABLE_HTML, {
          status: 503,
          headers: {
            ...identity,
            'Cache-Control': 'private, no-store',
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'X-Content-Type-Options': 'nosniff',
            'X-DPG-App': 'admin',
            'X-DPG-Authentication': 'disabled',
            'X-DPG-Private-Data': 'unavailable',
          },
        })
      }

      // Both frameworks emit static files outside their rendered HTML. Since
      // Worker-first routing sends these requests through this dispatcher,
      // resolve Public static files before handing app routes to SSR. Admin
      // assets and its SSR handler are deliberately unavailable here.
      if (request.method === 'GET' || request.method === 'HEAD') {
        const assetResponse = await environment.ASSETS.fetch(request)
        if (assetResponse.status !== 404) {
          return addHeaders(assetResponse, {
            ...identity,
            'Cache-Control': assetResponse.headers.get('Cache-Control') || 'public, max-age=31536000, immutable',
            'X-DPG-App': 'public',
          })
        }
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
