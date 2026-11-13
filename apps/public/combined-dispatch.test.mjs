import { expect, it } from 'vitest'
import { createCombinedProductionWorker } from './combined-dispatch.mjs'

function fixture() {
  const calls = { public: [], admin: [], assets: [] }
  const assets = {
    async fetch(request) {
      calls.assets.push({ path: new URL(request.url).pathname, cookie: request.headers.get('cookie') })
      if (new URL(request.url).pathname === '/admin/_next/static/admin.js') {
        return new Response('admin asset', { headers: { 'Content-Type': 'text/javascript' } })
      }
      if (new URL(request.url).pathname === '/_next/static/public.js') {
        return new Response('public asset', { headers: { 'Content-Type': 'text/javascript' } })
      }
      return new Response('not found', { status: 404 })
    },
  }
  const publicWorker = {
    async fetch(request, environment) {
      calls.public.push({
        path: new URL(request.url).pathname,
        cookie: request.headers.get('cookie'),
        authorization: request.headers.get('authorization'),
        environmentKeys: Object.keys(environment),
      })
      return new Response('public')
    },
  }
  const adminWorker = {
    async fetch(request, environment) {
      calls.admin.push({
        path: new URL(request.url).pathname,
        cookie: request.headers.get('cookie'),
        hyperdrive: environment.HYPERDRIVE_ADMIN_NO_CACHE,
        role: environment.RUNTIME_ROLE,
      })
      return new Response('admin', { headers: { 'Set-Cookie': 'dpg-admin-session=test; Path=/admin; HttpOnly; Secure' } })
    },
  }
  return {
    calls,
    worker: createCombinedProductionWorker({ publicWorker, adminWorker }),
    environment: {
      APP_ENV: 'production',
      APP_ORIGIN: 'https://www.dongphugia.vn',
      PREVIEW_NOINDEX: 'false',
      BUILD_SOURCE_SHA: 'a'.repeat(40),
      RUNTIME_ROLE: 'production',
      WRITE_FREEZE_MODE: 'false',
      PRISMA_REQUEST_SCOPE_REQUIRED: 'true',
      HYPERDRIVE_ADMIN_NO_CACHE: { connectionString: 'synthetic-local-only' },
      ASSETS: assets,
    },
  }
}

it('routes same-origin Admin paths only to Admin and filters its session and database from Public', async () => {
  const { worker, environment, calls } = fixture()
  const context = { waitUntil() {} }
  const adminResponse = await worker.fetch(new Request('https://www.dongphugia.vn/admin/login', {
    headers: { cookie: 'dpg-admin-session=private-token' },
  }), environment, context)
  const publicResponse = await worker.fetch(new Request('https://www.dongphugia.vn/', {
    headers: {
      cookie: 'dpg-admin-session=private-token; theme=light',
      authorization: 'Bearer public-request-token',
    },
  }), environment, context)

  expect(adminResponse.status).toBe(200)
  expect(adminResponse.headers.get('cache-control')).toBe('private, no-store')
  expect(adminResponse.headers.get('x-robots-tag')).toBe('noindex, nofollow')
  expect(adminResponse.headers.get('set-cookie')).toContain('Path=/admin')
  expect(publicResponse.status).toBe(200)
  expect(calls.admin).toEqual([{
    path: '/admin/login',
    cookie: 'dpg-admin-session=private-token',
    hyperdrive: environment.HYPERDRIVE_ADMIN_NO_CACHE,
    role: 'production',
  }])
  expect(calls.public).toHaveLength(1)
  expect(calls.public[0].cookie).toBe('theme=light')
  expect(calls.public[0].authorization).toBe('Bearer public-request-token')
  expect(calls.public[0].environmentKeys).not.toContain('HYPERDRIVE_ADMIN_NO_CACHE')
  expect(calls.public[0].environmentKeys).not.toContain('RUNTIME_ROLE')
  expect(calls.public[0].environmentKeys).not.toContain('WRITE_FREEZE_MODE')
})

it('serves separate Admin and Public framework asset paths without forwarding cookies', async () => {
  const { worker, environment, calls } = fixture()
  const context = { waitUntil() {} }
  const adminAsset = await worker.fetch(new Request('https://www.dongphugia.vn/admin/_next/static/admin.js', {
    headers: { cookie: 'dpg-admin-session=private-token', authorization: 'Bearer private-token' },
  }), environment, context)
  const publicAsset = await worker.fetch(new Request('https://www.dongphugia.vn/_next/static/public.js'), environment, context)

  expect(await adminAsset.text()).toBe('admin asset')
  expect(adminAsset.headers.get('x-robots-tag')).toBe('noindex, nofollow')
  expect(await publicAsset.text()).toBe('public asset')
  expect(calls.assets).toEqual([
    { path: '/admin/_next/static/admin.js', cookie: null },
    { path: '/_next/static/public.js', cookie: null },
  ])
  expect(calls.admin).toHaveLength(0)
  expect(calls.public).toHaveLength(0)
})

it('fails closed for Admin without Hyperdrive and does not route the old subdomain', async () => {
  const { worker, environment, calls } = fixture()
  const context = { waitUntil() {} }
  const noDatabase = await worker.fetch(new Request('https://www.dongphugia.vn/admin/login'), {
    ...environment,
    HYPERDRIVE_ADMIN_NO_CACHE: undefined,
  }, context)
  const oldHost = await worker.fetch(new Request('https://admin.dongphugia.vn/admin/login'), environment, context)

  expect(noDatabase.status).toBe(503)
  expect(oldHost.status).toBe(404)
  expect(calls.admin).toHaveLength(0)
  expect(calls.public).toHaveLength(0)
})
