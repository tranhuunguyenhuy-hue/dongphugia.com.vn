import { describe, expect, it, vi } from 'vitest'

import { createEnvironmentWorker, hasAdminPath } from './dispatch.mjs'

const sourceSha = 'f8ad30f148a80f1e976a6516efe0371e9184a7c2'
const origin = 'https://dpg-preview.tranhuunguyenhuy.workers.dev'
const environment = {
  APP_ENV: 'preview',
  APP_ORIGIN: origin,
  PREVIEW_NOINDEX: 'true',
  BUILD_SOURCE_SHA: sourceSha,
  NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.invalid',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic',
  ASSETS: { fetch: vi.fn(async () => new Response(null, { status: 404 })) },
}

describe('combined environment Worker dispatch', () => {
  it('routes only the /admin segment and descendants to Admin', () => {
    expect(hasAdminPath('/admin')).toBe(true)
    expect(hasAdminPath('/admin/login')).toBe(true)
    expect(hasAdminPath('/administrator')).toBe(false)
    expect(hasAdminPath('/')).toBe(false)
  })

  it('sends Admin and Public separate, allowlisted runtime bindings', async () => {
    const publicFetch = vi.fn(async () => new Response('public'))
    const adminFetch = vi.fn(async () => new Response('admin', { headers: { 'Cache-Control': 'private, no-store' } }))
    const worker = createEnvironmentWorker({
      publicWorker: { fetch: publicFetch },
      adminWorker: { fetch: adminFetch },
    })

    const publicResponse = await worker.fetch(new Request(`${origin}/`), environment, {})
    const adminResponse = await worker.fetch(new Request(`${origin}/admin/login`), environment, {})

    expect(await publicResponse.text()).toBe('public')
    expect(await adminResponse.text()).toBe('admin')
    expect(publicFetch).toHaveBeenCalledOnce()
    expect(publicFetch.mock.calls[0][1]).toMatchObject({ APP_BUILD_TARGET: 'public', APP_ENV: 'preview' })
    expect(publicFetch.mock.calls[0][1]).not.toHaveProperty('NEXT_PUBLIC_SUPABASE_URL')
    expect(adminFetch.mock.calls[0][1]).toMatchObject({
      APP_BUILD_TARGET: 'admin',
      ADMIN_BASE_PATH: '/admin',
      NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.invalid',
    })
    expect(adminFetch.mock.calls[0][1]).not.toHaveProperty('SUPABASE_SECRET_KEY')
    expect(publicResponse.headers.get('x-dpg-source-sha')).toBe(sourceSha)
    expect(publicResponse.headers.get('x-robots-tag')).toContain('noindex')
    expect(adminResponse.headers.get('x-dpg-app')).toBe('admin')
    expect(adminResponse.headers.get('cache-control')).toBe('private, no-store')
  })

  it('fails closed if identity is wrong or a privileged binding is present', async () => {
    const publicFetch = vi.fn(async () => new Response('public'))
    const adminFetch = vi.fn(async () => new Response('admin'))
    const worker = createEnvironmentWorker({
      publicWorker: { fetch: publicFetch },
      adminWorker: { fetch: adminFetch },
    })

    const wrongOrigin = await worker.fetch(new Request('https://www.dongphugia.vn/'), environment, {})
    const withSecret = await worker.fetch(new Request(`${origin}/`), {
      ...environment,
      SUPABASE_SECRET_KEY: 'synthetic-must-not-be-bound',
    }, {})

    expect(wrongOrigin.status).toBe(503)
    expect(withSecret.status).toBe(503)
    expect(publicFetch).not.toHaveBeenCalled()
    expect(adminFetch).not.toHaveBeenCalled()
  })

  it('serves Public and Admin static assets from their same-origin mounts', async () => {
    const assetFetch = vi.fn(async (request: Request) =>
      request.url.includes('/missing')
        ? new Response(null, { status: 404 })
        : new Response('asset', { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } }))
    const publicFetch = vi.fn(async () => new Response('public route'))
    const adminFetch = vi.fn(async () => new Response('admin route'))
    const worker = createEnvironmentWorker({
      publicWorker: { fetch: publicFetch },
      adminWorker: { fetch: adminFetch },
    })
    const assetsEnvironment = { ...environment, ASSETS: { fetch: assetFetch } }

    const publicAsset = await worker.fetch(new Request(`${origin}/_next/static/site.js`), assetsEnvironment, {})
    const adminAsset = await worker.fetch(new Request(`${origin}/admin/_next/static/admin.css`), assetsEnvironment, {})
    const missing = await worker.fetch(new Request(`${origin}/missing`), assetsEnvironment, {})

    expect(await publicAsset.text()).toBe('asset')
    expect(publicAsset.headers.get('x-dpg-app')).toBe('public')
    expect(await adminAsset.text()).toBe('asset')
    expect(adminAsset.headers.get('x-dpg-app')).toBe('admin')
    expect(adminAsset.headers.get('cache-control')).toContain('immutable')
    expect(publicFetch).toHaveBeenCalledOnce()
    expect(adminFetch).not.toHaveBeenCalled()
    const adminPost = await worker.fetch(new Request(`${origin}/admin/auth/logout`, { method: 'POST' }), assetsEnvironment, {})
    expect(await adminPost.text()).toBe('admin route')
    expect(adminFetch).toHaveBeenCalledOnce()
    expect(assetFetch).toHaveBeenCalledTimes(3)
    expect(await missing.text()).toBe('public route')
  })
})
