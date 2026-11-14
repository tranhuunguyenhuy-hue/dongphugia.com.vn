import { describe, expect, it } from 'vitest'
import {
  buildSmokeNetworkFailureEvidence,
  buildSmokeResponseEvidence,
  classifySmokeBody,
  classifySmokeLocation,
} from './public-postgres-smoke-diagnostics.mjs'

const sourceSha = 'a'.repeat(40)
const base = new URL('https://www.dongphugia.vn')

describe('bounded Public PostgreSQL smoke evidence', () => {
  it('identifies the failed HTTP predicate while keeping response body text allowlisted', () => {
    const response = new Response('<html><head><title>Internal Server Error</title></head><body>private details</body></html>', {
      status: 500,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'x-dpg-source-sha': sourceSha,
      },
    })
    const evidence = buildSmokeResponseEvidence({
      route: 'plp', slug: 'bon-cau', response, expectedSha: sourceSha,
      expectedType: 'text/html', base, elapsedMs: 5_333,
      body: '<html><head><title>Internal Server Error</title></head><body>private details</body></html>',
    })

    expect(evidence).toEqual({
      route: 'plp', slug: 'bon-cau', status: 500, contentType: 'text/html',
      sourceShaMatches: true, hasSetCookie: false, redirectLocation: 'missing',
      elapsedMs: 5_333, failedChecks: ['status'], bodyClass: 'html_error_page',
      safeBodyExcerpt: 'internal_server_error',
    })
    expect(JSON.stringify(evidence)).not.toContain('private details')
  })

  it('retains strict source, cookie, and content-type gates as separate failures', () => {
    const response = new Response('not html', {
      status: 200,
      headers: {
        'content-type': 'text/plain',
        'x-dpg-source-sha': 'b'.repeat(40),
        'set-cookie': 'session=private',
      },
    })
    const evidence = buildSmokeResponseEvidence({
      route: 'plp', slug: 'bon-cau', response, expectedSha: sourceSha,
      expectedType: 'text/html', base, elapsedMs: 12,
    })

    expect(evidence.failedChecks).toEqual(['source_sha', 'set_cookie', 'content_type'])
    expect(evidence.sourceShaMatches).toBe(false)
    expect(evidence.hasSetCookie).toBe(true)
    expect(evidence.contentType).toBe('text/plain')
  })

  it('classifies redirect targets without disclosing their raw location', () => {
    expect(classifySmokeLocation('https://www.dongphugia.vn/thiet-bi-ve-sinh/bon-cau', new URL('http://127.0.0.1:8793')))
      .toBe('canonical_origin')
    expect(classifySmokeLocation('https://evil.example/path?token=private', base)).toBe('other_origin')
    expect(classifySmokeLocation('https://evil.example/path?token=private', base)).not.toContain('private')
  })

  it('does not emit arbitrary response text or JSON error messages', () => {
    expect(classifySmokeBody('text/plain', 'private query and row contents')).toEqual({ bodyClass: 'other_error_body' })
    expect(classifySmokeBody('application/json', JSON.stringify({ error: 'private customer data' })))
      .toEqual({ bodyClass: 'json_error' })
    expect(buildSmokeNetworkFailureEvidence({ route: 'plp', slug: 'bon-cau', error: new Error('private'), elapsedMs: 3 }))
      .toMatchObject({ route: 'plp', slug: 'bon-cau', status: null, errorClass: 'network_error' })
  })
})
