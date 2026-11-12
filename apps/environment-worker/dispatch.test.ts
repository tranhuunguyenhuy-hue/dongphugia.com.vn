import { describe, expect, it, vi } from 'vitest'

import { createEnvironmentWorker, hasAdminPath } from './dispatch.mjs'

const sourceSha = 'f8ad30f148a80f1e976a6516efe0371e9184a7c2'
const origin = 'http://127.0.0.1:8787'
const environment = {
  APP_ENV: 'preview',
  APP_ORIGIN: origin,
  PREVIEW_NOINDEX: 'true',
  BUILD_SOURCE_SHA: sourceSha,
  PUBLIC_CATALOGUE_SOURCE: 'production-published-snapshot',
  NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.invalid',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic',
  ASSETS: { fetch: vi.fn(async () => new Response(null, { status: 404 })) },
}

describe('local Preview and Staging Worker dispatch', () => {
  it('routes only the /admin segment and descendants to Admin', () => {
    expect(hasAdminPath('/admin')).toBe(true)
    expect(hasAdminPath('/admin/login')).toBe(true)
    expect(hasAdminPath('/administrator')).toBe(false)
    expect(hasAdminPath('/')).toBe(false)
  })

  it('keeps Public and the rendered Admin shell on one local origin', async () => {
    const publicFetch = vi.fn(async (_request: Request, _environment: Record<string, unknown>, _context: unknown) => new Response('public'))
    const adminFetch = vi.fn(async (_request: Request, _environment: Record<string, unknown>, _context: unknown) => new Response('<main>Admin sign-in shell</main>'))
    const worker = createEnvironmentWorker({ publicWorker: { fetch: publicFetch }, adminWorker: { fetch: adminFetch } })

    const publicResponse = await worker.fetch(new Request(`${origin}/`), environment, {})
    const adminResponse = await worker.fetch(new Request(`${origin}/admin/login`), environment, {})

    expect(await publicResponse.text()).toBe('public')
    expect(await adminResponse.text()).toContain('Admin sign-in shell')
    expect(adminResponse.status).toBe(200)
    expect(publicFetch).toHaveBeenCalledOnce()
    expect(adminFetch).toHaveBeenCalledOnce()
    expect(publicFetch.mock.calls[0][1]).toMatchObject({
      APP_BUILD_TARGET: 'public', APP_ENV: 'preview',
      PUBLIC_CATALOGUE_SOURCE: 'production-published-snapshot',
    })
    expect(publicFetch.mock.calls[0][1]).not.toHaveProperty('NEXT_PUBLIC_SUPABASE_URL')
    expect(adminFetch.mock.calls[0][1]).toMatchObject({
      APP_BUILD_TARGET: 'admin', APP_ENV: 'preview', ADMIN_AUTH_ENABLED: 'false',
      NEXT_PUBLIC_ADMIN_AUTH_ENABLED: 'false',
    })
    expect(adminFetch.mock.calls[0][1]).not.toHaveProperty('NEXT_PUBLIC_SUPABASE_URL')
    expect(adminFetch.mock.calls[0][1]).not.toHaveProperty('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
    expect(publicResponse.headers.get('x-dpg-source-sha')).toBe(sourceSha)
    expect(publicResponse.headers.get('x-robots-tag')).toContain('noindex')
    expect(adminResponse.headers.get('x-dpg-app')).toBe('admin')
    expect(adminResponse.headers.get('cache-control')).toBe('private, no-store')
    expect(adminResponse.headers.get('x-dpg-authentication')).toBe('disabled')
    expect(adminResponse.headers.get('x-dpg-private-data')).toBe('unavailable')
  })

  it('keeps Public SSR stable through Admin-first, Public-first, and concurrent routing', async () => {
    const routedTargets: string[] = []
    const publicFetch = vi.fn(async () => { routedTargets.push('public'); return new Response('public') })
    const adminFetch = vi.fn(async () => { routedTargets.push('admin'); return new Response('admin') })
    const worker = createEnvironmentWorker({ publicWorker: { fetch: publicFetch }, adminWorker: { fetch: adminFetch } })
    const request = (path: string) => worker.fetch(new Request(`${origin}${path}`), environment, {})

    const adminFirst = await request('/admin/login')
    const publicAfterAdmin = await request('/')
    const publicFirst = await request('/thiet-bi-bep')
    const adminAfterPublic = await request('/admin/forgot-password')
    const concurrent = await Promise.all([request('/'), request('/admin/login')])

    expect([adminFirst.status, publicAfterAdmin.status, publicFirst.status, adminAfterPublic.status])
      .toEqual([200, 200, 200, 200])
    expect(concurrent.map((response) => response.status)).toEqual([200, 200])
    expect(routedTargets).toEqual(['admin', 'public', 'public', 'admin', 'public', 'admin'])
    expect(publicFetch).toHaveBeenCalledTimes(3)
    expect(adminFetch).toHaveBeenCalledTimes(3)
    for (const response of [publicAfterAdmin, publicFirst, ...concurrent.filter((_, index) => index === 0)]) {
      expect(response.headers.get('x-dpg-app')).toBe('public')
      expect(response.headers.get('x-dpg-source-sha')).toBe(sourceSha)
    }
  })

  it('keeps app-relative Admin redirects inside the /admin mount', async () => {
    const publicFetch = vi.fn(async () => new Response('public'))
    const adminFetch = vi.fn(async () => Response.redirect(`${origin}/login?error=auth_unavailable`, 307))
    const worker = createEnvironmentWorker({ publicWorker: { fetch: publicFetch }, adminWorker: { fetch: adminFetch } })

    const response = await worker.fetch(new Request(`${origin}/admin/orders`), environment, {})

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('/admin/login?error=auth_unavailable')
    expect(response.headers.get('x-dpg-app')).toBe('admin')
    expect(response.headers.get('x-dpg-private-data')).toBe('unavailable')
    expect(publicFetch).not.toHaveBeenCalled()
  })

  it('rejects every non-read request before assets or either app handler', async () => {
    const assetFetch = vi.fn(async () => new Response('asset'))
    const publicFetch = vi.fn(async () => new Response('public'))
    const adminFetch = vi.fn(async () => new Response('admin'))
    const worker = createEnvironmentWorker({ publicWorker: { fetch: publicFetch }, adminWorker: { fetch: adminFetch } })
    const assetsEnvironment = { ...environment, ASSETS: { fetch: assetFetch } }

    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
      for (const pathname of ['/admin/auth/login', '/admin/api/orders', '/admin/api/cms', '/admin/api/media/upload', '/api/orders']) {
        const response = await worker.fetch(new Request(`${origin}${pathname}`, { method }), assetsEnvironment, {})
        expect(response.status).toBe(405)
        expect(response.headers.get('allow')).toBe('GET, HEAD')
        if (pathname.startsWith('/admin/')) {
          expect(response.headers.get('x-dpg-authentication')).toBe('disabled')
          expect(response.headers.get('x-dpg-private-data')).toBe('unavailable')
        }
      }
    }
    expect(assetFetch).not.toHaveBeenCalled()
    expect(publicFetch).not.toHaveBeenCalled()
    expect(adminFetch).not.toHaveBeenCalled()
  })

  it('serves Public and Admin static assets on their same-origin paths', async () => {
    const assetFetch = vi.fn(async (request: Request) =>
      request.url.includes('/missing')
        ? new Response(null, { status: 404 })
        : new Response('asset', { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } }))
    const publicFetch = vi.fn(async () => new Response('public route'))
    const adminFetch = vi.fn(async () => new Response('admin route'))
    const worker = createEnvironmentWorker({ publicWorker: { fetch: publicFetch }, adminWorker: { fetch: adminFetch } })
    const assetsEnvironment = { ...environment, ASSETS: { fetch: assetFetch } }

    const publicAsset = await worker.fetch(new Request(`${origin}/_next/static/site.js`), assetsEnvironment, {})
    const adminAsset = await worker.fetch(new Request(`${origin}/admin/_next/static/admin.css`), assetsEnvironment, {})
    const missing = await worker.fetch(new Request(`${origin}/missing`), assetsEnvironment, {})

    expect(await publicAsset.text()).toBe('asset')
    expect(publicAsset.headers.get('x-dpg-app')).toBe('public')
    expect(await adminAsset.text()).toBe('asset')
    expect(adminAsset.headers.get('x-dpg-app')).toBe('admin')
    expect(adminAsset.headers.get('x-dpg-private-data')).toBe('unavailable')
    expect(adminAsset.headers.get('x-dpg-authentication')).toBe('disabled')
    expect(publicFetch).toHaveBeenCalledOnce()
    expect(adminFetch).not.toHaveBeenCalled()
    expect(await missing.text()).toBe('public route')
    expect(assetFetch).toHaveBeenCalledTimes(3)
  })

  it('accepts the exact local origin and Staging local simulation only', async () => {
    const publicFetch = vi.fn(async () => new Response('public'))
    const adminFetch = vi.fn(async () => new Response('admin'))
    const worker = createEnvironmentWorker({ publicWorker: { fetch: publicFetch }, adminWorker: { fetch: adminFetch } })
    const wrongOrigin = await worker.fetch(new Request('http://localhost:8787/'), environment, {})
    const wrongHost = await worker.fetch(new Request('https://www.dongphugia.vn/'), environment, {})
    const stagingLocal = await worker.fetch(new Request(`${origin}/`), {
      ...environment,
      APP_ENV: 'staging',
      APP_ORIGIN: 'https://dpg-staging.tranhuunguyenhuy.workers.dev',
    }, {})
    const withSecret = await worker.fetch(new Request(`${origin}/`), {
      ...environment,
      SUPABASE_SERVICE_ROLE_KEY: 'synthetic-must-not-be-bound',
    }, {})

    expect(wrongOrigin.status).toBe(503)
    expect(wrongHost.status).toBe(503)
    expect(stagingLocal.status).toBe(200)
    expect(withSecret.status).toBe(503)
    expect(publicFetch).toHaveBeenCalledTimes(1)
  })
})
