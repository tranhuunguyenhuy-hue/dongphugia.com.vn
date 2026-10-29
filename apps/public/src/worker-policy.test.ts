import { describe, expect, it } from 'vitest'

import {
  assertPreviewRuntime,
  classifyPublicApiRequest,
  createCacheKey,
  isAnonymousCacheCandidate,
  isCacheableResponse,
  isForbiddenInternalControlRequest,
  PUBLIC_EDGE_CACHE_CONTROL,
  PUBLIC_PREVIEW_ROBOTS_HEADER,
} from './worker-policy'

const sourceCommit = '8b96aecb8c34cc46079f292369aa961d9e5c2020'
const previewEnvironment = {
  APP_ENV: 'preview',
  APP_BUILD_TARGET: 'public',
  APP_ORIGIN: 'https://public-preview.invalid',
  PREVIEW_NOINDEX: 'true',
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

  it('allows only owned public GET/HEAD APIs and blocks arbitrary or mutating routes', () => {
    expect(classifyPublicApiRequest(new Request('https://preview.invalid/api/health'))).toBe('allow')
    expect(classifyPublicApiRequest(new Request('https://preview.invalid/api/catalogue/listings/thiet-bi-bep/voi-rua-chen'))).toBe('allow')
    expect(classifyPublicApiRequest(new Request('https://preview.invalid/api/catalogue/listings/gach-op-lat/gach-van-da-marble', { method: 'HEAD' }))).toBe('allow')
    expect(classifyPublicApiRequest(new Request('https://preview.invalid/api/catalogue/listings/not-a-family/voi-rua-chen'))).toBe('not-found')
    expect(classifyPublicApiRequest(new Request('https://preview.invalid/api/catalogue/listings/thiet-bi-bep/%2fprivate'))).toBe('not-found')
    expect(classifyPublicApiRequest(new Request('https://preview.invalid/api/catalogue/listings/thiet-bi-bep/voi-rua-chen', { method: 'POST' }))).toBe('method-not-allowed')
    expect(classifyPublicApiRequest(new Request('https://preview.invalid/api/catalogue/listings/thiet-bi-bep/voi-rua-chen', { method: 'DELETE' }))).toBe('method-not-allowed')
    expect(classifyPublicApiRequest(new Request('https://preview.invalid/api/admin/export'))).toBe('not-found')
    expect(classifyPublicApiRequest(new Request('https://preview.invalid/thiet-bi-bep/voi-rua-chen'))).toBe('not-api')
  })
})
