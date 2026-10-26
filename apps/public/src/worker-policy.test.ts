import { describe, expect, it } from 'vitest'

import {
  assertPublicRuntime,
  assertPreviewRuntime,
  createCacheKey,
  isAnonymousCacheCandidate,
  isCacheableResponse,
  isForbiddenInternalControlRequest,
  isTemporarilyUnavailablePublicPath,
  PUBLIC_EDGE_CACHE_CONTROL,
  PUBLIC_PREVIEW_ROBOTS_HEADER,
  temporaryUnavailablePublicResponse,
} from './worker-policy'

const sourceCommit = '8b96aecb8c34cc46079f292369aa961d9e5c2020'
const previewEnvironment = {
  APP_ENV: 'preview',
  APP_BUILD_TARGET: 'public',
  APP_ORIGIN: 'https://public-preview.invalid',
  PREVIEW_NOINDEX: 'true',
}
const productionEnvironment = {
  APP_ENV: 'production',
  APP_BUILD_TARGET: 'public',
  APP_ORIGIN: 'https://www.dongphugia.vn',
  PREVIEW_NOINDEX: 'false',
}

describe('Public Worker fail-closed policy', () => {
  it('requires the exact Preview robots response header contract', () => {
    expect(PUBLIC_PREVIEW_ROBOTS_HEADER).toBe('noindex, nofollow')
  })

  it('rejects Production hosts and invalid Preview posture', () => {
    expect(() => assertPreviewRuntime(new Request('https://www.dongphugia.vn/'), previewEnvironment)).toThrow('PUBLIC_WORKER_PREVIEW_PRODUCTION_HOST_FORBIDDEN')
    expect(() => assertPreviewRuntime(new Request('https://preview.invalid/'), { ...previewEnvironment, PREVIEW_NOINDEX: 'false' })).toThrow('PUBLIC_WORKER_PREVIEW_CONFIGURATION_REQUIRED')
    expect(() => assertPreviewRuntime(new Request('https://preview.invalid/'), { ...previewEnvironment, APP_ORIGIN: 'https://admin.dongphugia.vn' })).toThrow('PUBLIC_WORKER_PREVIEW_ORIGIN_INVALID')
    expect(() => assertPreviewRuntime(new Request('https://preview.invalid/'), { ...previewEnvironment, SUPABASE_SERVICE_ROLE_KEY: 'synthetic' })).toThrow('PUBLIC_WORKER_PRIVILEGED_BINDING_FORBIDDEN')
  })

  it('accepts only the exact public Production posture without privileged bindings', () => {
    expect(assertPublicRuntime(new Request('https://www.dongphugia.vn/'), productionEnvironment)).toBe('production')
    expect(assertPublicRuntime(new Request('https://dongphugia.vn/'), productionEnvironment)).toBe('production')
    expect(() => assertPublicRuntime(new Request('https://unknown.invalid/'), productionEnvironment)).toThrow('PUBLIC_WORKER_PRODUCTION_CONFIGURATION_INVALID')
    expect(() => assertPublicRuntime(new Request('http://www.dongphugia.vn/'), productionEnvironment)).toThrow('PUBLIC_WORKER_PRODUCTION_CONFIGURATION_INVALID')
    expect(() => assertPublicRuntime(new Request('https://www.dongphugia.vn/'), { ...productionEnvironment, PREVIEW_NOINDEX: 'true' })).toThrow('PUBLIC_WORKER_PRODUCTION_CONFIGURATION_INVALID')
    expect(() => assertPublicRuntime(new Request('https://www.dongphugia.vn/'), { ...productionEnvironment, DATABASE_URL: 'synthetic' })).toThrow('PUBLIC_WORKER_PRIVILEGED_BINDING_FORBIDDEN')
  })

  it('serves only the truthful shell routes and temporarily holds legacy content URLs', async () => {
    for (const path of ['/', '/lien-he', '/thiet-bi-ve-sinh', '/thiet-bi-bep', '/vat-lieu-nuoc', '/gach-op-lat', '/robots.txt', '/sitemap.xml', '/api/health', '/images/Logo.png', '/banners/banner-toto.jpg', '/google82c633aea2548883.html', '/_next/static/chunk.js']) {
      expect(isTemporarilyUnavailablePublicPath(new Request(`https://www.dongphugia.vn${path}`))).toBe(false)
    }
    for (const path of ['/ve-chung-toi', '/thiet-bi-ve-sinh/ban-cau', '/thiet-bi-ve-sinh/ban-cau/legacy-product', '/gach-op-lat/unknown-product', '/blog/old-story', '/gach-1000-x-1000-mm.html']) {
      expect(isTemporarilyUnavailablePublicPath(new Request(`https://www.dongphugia.vn${path}`))).toBe(true)
    }

    const unavailable = temporaryUnavailablePublicResponse(new Request('https://www.dongphugia.vn/thiet-bi-ve-sinh/ban-cau/legacy-product'), false)
    expect(unavailable.status).toBe(503)
    expect(unavailable.headers.get('retry-after')).toBe('300')
    expect(unavailable.headers.get('cache-control')).toBe('private, no-store')
    expect(unavailable.headers.has('x-robots-tag')).toBe(false)
    expect(await unavailable.text()).toMatch(/Thông tin đang được cập nhật/)

    const preview = temporaryUnavailablePublicResponse(new Request('https://public-preview.invalid/old-product'), true)
    expect(preview.headers.get('x-robots-tag')).toBe(PUBLIC_PREVIEW_ROBOTS_HEADER)
    const head = temporaryUnavailablePublicResponse(new Request('https://www.dongphugia.vn/old-product', { method: 'HEAD' }), false)
    expect(await head.text()).toBe('')
  })

  it('caches only anonymous root responses and keys by host, path, and source SHA', () => {
    expect(isAnonymousCacheCandidate(new Request('https://preview.invalid/'))).toBe(true)
    expect(isAnonymousCacheCandidate(new Request('https://preview.invalid/', { headers: { cookie: 'staff=synthetic' } }))).toBe(false)
    expect(isAnonymousCacheCandidate(new Request('https://preview.invalid/?q=synthetic'))).toBe(false)
    expect(isAnonymousCacheCandidate(new Request('https://preview.invalid/api/health'))).toBe(false)
    const key = new URL(createCacheKey(new Request('https://preview.invalid/'), sourceCommit).url)
    expect(key.hostname).toBe('preview.invalid')
    expect(key.pathname).toBe('/')
    expect(key.searchParams.get('__dpg_source')).toBe(sourceCommit)
    expect(PUBLIC_EDGE_CACHE_CONTROL).toBe('public, max-age=300, must-revalidate')
  })

  it('will not cache responses with cookies or non-HTML payloads', () => {
    expect(isCacheableResponse(new Response('<html/>', { headers: { 'content-type': 'text/html' } }))).toBe(true)
    expect(isCacheableResponse(new Response('<html/>', { headers: { 'content-type': 'text/html', 'set-cookie': 'staff=synthetic' } }))).toBe(false)
    expect(isCacheableResponse(Response.json({ ok: true }))).toBe(false)
  })

  it('blocks externally supplied vinext prerender and revalidation controls', () => {
    expect(isForbiddenInternalControlRequest(new Request('https://preview.invalid/__vinext/prerender/page'))).toBe(true)
    expect(isForbiddenInternalControlRequest(new Request('https://preview.invalid/', { headers: { 'x-prerender-revalidate': 'synthetic' } }))).toBe(true)
    expect(isForbiddenInternalControlRequest(new Request('https://preview.invalid/', { headers: { cookie: '__prerender_bypass=synthetic' } }))).toBe(true)
    expect(isForbiddenInternalControlRequest(new Request('https://preview.invalid/'))).toBe(false)
  })
})
