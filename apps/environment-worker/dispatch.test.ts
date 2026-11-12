import { describe, expect, it, vi } from 'vitest'

import { createEnvironmentWorker, hasAdminPath } from './dispatch.mjs'

const sourceSha = 'f8ad30f148a80f1e976a6516efe0371e9184a7c2'
const origin = 'http://127.0.0.1:8787'
const environment = {
  APP_ENV: 'preview',
  APP_ORIGIN: origin,
  PREVIEW_NOINDEX: 'true',
  BUILD_SOURCE_SHA: sourceSha,
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

  it('keeps Admin unavailable and serves Public on the same origin', async () => {
    const publicFetch = vi.fn(async (_request: Request, _environment: Record<string, unknown>, _context: unknown) => new Response('public'))
    const worker = createEnvironmentWorker({ publicWorker: { fetch: publicFetch } })

    const publicResponse = await worker.fetch(new Request(`${origin}/`), environment, {})
    const adminResponse = await worker.fetch(new Request(`${origin}/admin/login`), environment, {})
    const adminHtml = await adminResponse.text()

    expect(await publicResponse.text()).toBe('public')
    expect(adminResponse.status).toBe(503)
    expect(adminHtml).toContain('Admin không khả dụng trong môi trường này')
    expect(adminHtml).toContain('Không bật xác thực Production')
    expect(adminHtml).not.toMatch(/<form|<script/i)
    expect(publicFetch).toHaveBeenCalledOnce()
    expect(publicFetch.mock.calls[0][1]).toMatchObject({ APP_BUILD_TARGET: 'public', APP_ENV: 'preview' })
    expect(publicFetch.mock.calls[0][1]).not.toHaveProperty('NEXT_PUBLIC_SUPABASE_URL')
    expect(publicFetch.mock.calls[0][1]).not.toHaveProperty('NEXT_PUBLIC_ADMIN_AUTH_ENABLED')
    expect(publicFetch.mock.calls[0][1]).not.toHaveProperty('ADMIN_AUTH_ENABLED')
    expect(publicResponse.headers.get('x-dpg-source-sha')).toBe(sourceSha)
    expect(publicResponse.headers.get('x-robots-tag')).toContain('noindex')
    expect(adminResponse.headers.get('x-dpg-app')).toBe('admin')
    expect(adminResponse.headers.get('cache-control')).toBe('private, no-store')
    expect(adminResponse.headers.get('x-dpg-authentication')).toBe('disabled')
    expect(adminResponse.headers.get('x-dpg-private-data')).toBe('unavailable')
    expect(adminResponse.headers.get('content-security-policy')).toContain("form-action 'none'")
  })

  it('does not let Admin requests enter or disturb Public SSR', async () => {
    const publicFetch = vi.fn(async () => new Response('public'))
    const worker = createEnvironmentWorker({ publicWorker: { fetch: publicFetch } })

    for (const path of ['/admin', '/admin/login', '/admin/forgot-password', '/admin/reset-password', '/admin/api/health']) {
      const response = await worker.fetch(new Request(`${origin}${path}`), environment, {})
      expect(response.status).toBe(503)
      expect(response.headers.get('x-dpg-private-data')).toBe('unavailable')
    }
    const publicAfterAdmin = await worker.fetch(new Request(`${origin}/`), environment, {})

    expect(publicAfterAdmin.status).toBe(200)
    expect(publicFetch).toHaveBeenCalledOnce()
  })

  it('fails closed if identity is wrong or a privileged binding is present', async () => {
    const publicFetch = vi.fn(async (_request: Request, _environment: Record<string, unknown>, _context: unknown) => new Response('public'))
    const worker = createEnvironmentWorker({ publicWorker: { fetch: publicFetch } })

    const wrongOrigin = await worker.fetch(new Request('https://www.dongphugia.vn/'), environment, {})
    const withSecret = await worker.fetch(new Request(`${origin}/`), {
      ...environment,
      SUPABASE_SECRET_KEY: 'synthetic-must-not-be-bound',
    }, {})

    expect(wrongOrigin.status).toBe(503)
    expect(withSecret.status).toBe(503)
    expect(publicFetch).not.toHaveBeenCalled()
  })

  it('serves Public and Admin static assets from their same-origin mounts', async () => {
    const assetFetch = vi.fn(async (request: Request) =>
      request.url.includes('/missing')
        ? new Response(null, { status: 404 })
        : new Response('asset', { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } }))
    const publicFetch = vi.fn(async (_request: Request, _environment: Record<string, unknown>, _context: unknown) => new Response('public route'))
    const worker = createEnvironmentWorker({ publicWorker: { fetch: publicFetch } })
    const assetsEnvironment = { ...environment, ASSETS: { fetch: assetFetch } }

    const publicAsset = await worker.fetch(new Request(`${origin}/_next/static/site.js`), assetsEnvironment, {})
    const adminAsset = await worker.fetch(new Request(`${origin}/admin/_next/static/admin.css`), assetsEnvironment, {})
    const missing = await worker.fetch(new Request(`${origin}/missing`), assetsEnvironment, {})

    expect(await publicAsset.text()).toBe('asset')
    expect(publicAsset.headers.get('x-dpg-app')).toBe('public')
    expect(adminAsset.status).toBe(503)
    expect(await adminAsset.text()).toContain('Admin không khả dụng')
    expect(adminAsset.headers.get('x-dpg-app')).toBe('admin')
    expect(adminAsset.headers.get('x-dpg-private-data')).toBe('unavailable')
    expect(publicFetch).toHaveBeenCalledOnce()
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const adminWrite = await worker.fetch(new Request(`${origin}/admin/auth/logout`, { method }), assetsEnvironment, {})
      expect(await adminWrite.text()).toContain('read-only')
      expect(adminWrite.status).toBe(405)
      expect(adminWrite.headers.get('x-dpg-app')).toBe('admin')
      expect(adminWrite.headers.get('x-dpg-private-data')).toBe('unavailable')
    }
    expect(assetFetch).toHaveBeenCalledTimes(2)
    expect(await missing.text()).toBe('public route')
  })
})
