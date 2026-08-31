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
    let rootCount = 0
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
          'X-DPG-Cache': 'BYPASS',
          'X-Robots-Tag': 'noindex',
        })
      }
      rootCount += 1
      return response('<html><head><title>Dong Phu Gia Public Application</title><meta name="robots" content="noindex,nofollow"></head></html>', {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'CDN-Cache-Control': 'public, max-age=300, must-revalidate',
        'X-DPG-Cache': rootCount === 1 ? 'MISS' : 'HIT',
        'X-Robots-Tag': 'noindex',
      })
    }

    const proof = await verifyRealPreview({ baseUrl, sourceSha, fetchImpl })
    expect(proof.contract).toBe('dongphugia:real-public-preview-proof:v2')
    expect(proof.observations.cache).toMatchObject({
      first: 'MISS',
      subsequent: 'HIT',
      query: 'BYPASS',
      cookie: 'BYPASS',
      api: 'BYPASS',
      edgeMaxAgeSeconds: 300,
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
    let rootCount = 0
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
          'X-DPG-Cache': 'BYPASS',
          'X-Robots-Tag': 'noindex, nofollow',
        })
      }
      rootCount += 1
      return response('<html><head><title>Dong Phu Gia Public Application</title><meta name="robots" content="noindex,nofollow"></head></html>', {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'CDN-Cache-Control': 'public, max-age=300, must-revalidate',
        'X-DPG-Cache': rootCount === 1 ? 'MISS' : 'HIT',
        'X-Robots-Tag': 'noindex, nofollow',
      })
    }

    await expect(verifyRealPreview({ baseUrl, sourceSha, fetchImpl, hitAttempts: 1 })).rejects.toThrow(
      'LEO563_REAL_PREVIEW_X_ROBOTS_FAILED',
    )
  })
})
