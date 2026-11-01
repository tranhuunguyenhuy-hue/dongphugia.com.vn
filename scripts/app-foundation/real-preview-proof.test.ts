import { describe, expect, it } from 'vitest'

import { validatePreviewUrl, verifyRealPreview } from './real-preview-proof.mjs'

const sourceSha = 'a'.repeat(40)
const baseUrl = 'https://pr-138-dongphugia-v1-public-preview.example.workers.dev'

function response(body: BodyInit, headers: Record<string, string>, status = 200) {
  return new Response(body, { status, headers: { 'X-DPG-Source-SHA': sourceSha, ...headers } })
}

describe('LEO-563 real Public Preview proof', () => {
  it('accepts only the exact workers.dev alias URL', () => {
    expect(validatePreviewUrl(baseUrl).hostname).toContain('pr-138-dongphugia-v1-public-preview')
    expect(() => validatePreviewUrl('https://dongphugia.vn')).toThrow('LEO563_REAL_PREVIEW_URL_INVALID')
    expect(() => validatePreviewUrl('https://other-worker.example.workers.dev')).toThrow('LEO563_REAL_PREVIEW_URL_INVALID')
  })

  it('accepts the provider workers.dev noindex header with full HTML and robots controls', async () => {
    const fetchImpl = async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = new URL(String(input))
      if (url.pathname === '/api/health') {
        return response(JSON.stringify({ application: 'public', status: 'ok' }), {
          'Content-Type': 'application/json',
          'Cache-Control': 'private, no-store',
          'X-DPG-Cache': 'BYPASS',
          'X-Robots-Tag': 'noindex',
        })
      }
      if (url.pathname === '/robots.txt') {
        return response('User-agent: *\nDisallow: /\n', {
          'Cache-Control': 'private, no-store',
          'X-DPG-Cache': 'BYPASS',
          'X-Robots-Tag': 'noindex',
        })
      }
      if (url.search || new Headers(init?.headers).has('cookie')) {
        return response('<html></html>', {
          'Cache-Control': 'private, no-store',
          'X-Robots-Tag': 'noindex',
        }, url.search ? 400 : 200)
      }
      return response('<html><head><title>Đông Phú Gia - Vật liệu xây dựng cao cấp tại Đà Lạt</title><meta name="robots" content="noindex,nofollow"></head></html>', {
        'Content-Type': 'text/html',
        'Cache-Control': 'private, no-store',
        'X-Robots-Tag': 'noindex',
      })
    }

    const proof = await verifyRealPreview({ baseUrl, sourceSha, fetchImpl })
    expect(proof.contract).toBe('dongphugia:real-public-preview-proof:v2')
    expect(proof.observations.cache).toMatchObject({
      first: 'PRIVATE_NO_STORE',
      subsequent: 'PRIVATE_NO_STORE',
      query: 'REJECTED_PRIVATE_NO_STORE',
      cookie: 'PRIVATE_NO_STORE',
      api: 'BYPASS_PRIVATE_NO_STORE',
      edgeMaxAgeSeconds: 0,
      staleServing: false,
    })
    expect(proof.observations.limits).toEqual({
      cpuMsPlanMaximum: 10,
      subrequestsPlanMaximum: 50,
      testedRequestsCompletedWithinPlanLimits: true,
    })
    expect(proof.observations.cpuObservability.status).toBe('PROVIDER_LIMITATION')
  })

  it('rejects a required Preview response that loses the noindex directive', async () => {
    const fetchImpl = async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = new URL(String(input))
      if (url.pathname === '/api/health') {
        return response(JSON.stringify({ application: 'public', status: 'ok' }), {
          'Cache-Control': 'private, no-store',
          'X-DPG-Cache': 'BYPASS',
          'X-Robots-Tag': 'nofollow',
        })
      }
      if (url.pathname === '/robots.txt') {
        return response('User-agent: *\nDisallow: /\n', {
          'Cache-Control': 'private, no-store',
          'X-DPG-Cache': 'BYPASS',
          'X-Robots-Tag': 'noindex, nofollow',
        })
      }
      if (url.search || new Headers(init?.headers).has('cookie')) {
        return response('<html></html>', {
          'Cache-Control': 'private, no-store',
          'X-Robots-Tag': 'noindex, nofollow',
        }, url.search ? 400 : 200)
      }
      return response('<html><head><title>Đông Phú Gia - Vật liệu xây dựng cao cấp tại Đà Lạt</title><meta name="robots" content="noindex,nofollow"></head></html>', {
        'Content-Type': 'text/html',
        'Cache-Control': 'private, no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      })
    }

    await expect(verifyRealPreview({ baseUrl, sourceSha, fetchImpl })).rejects.toThrow(
      'LEO563_REAL_PREVIEW_X_ROBOTS_FAILED',
    )
  })

  it('rejects public caching or an unexpected cache marker on the prerendered root', async () => {
    for (const unsafe of [
      { 'Cache-Control': 'public, max-age=300', 'X-Robots-Tag': 'noindex' },
      { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex', 'X-DPG-Cache': 'HIT' },
    ]) {
      const fetchImpl = async () => response('<html></html>', unsafe)
      await expect(verifyRealPreview({ baseUrl, sourceSha, fetchImpl })).rejects.toThrow(
        'LEO563_REAL_PREVIEW_PRERENDER_CACHE_FAILED',
      )
    }
  })
})
