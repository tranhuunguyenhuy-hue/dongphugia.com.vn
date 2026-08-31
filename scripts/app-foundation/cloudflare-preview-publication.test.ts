import { describe, expect, it } from 'vitest'

import {
  assertRemoteResourceAbsent,
  inspectPublishedResource,
  parseWranglerUpload,
  validatePreviewConfig,
} from './cloudflare-preview-publication.mjs'

function validConfig() {
  return {
    name: 'dongphugia-v1-public-preview',
    compatibility_date: '2026-08-31',
    compatibility_flags: ['nodejs_compat'],
    main: 'worker/index.js',
    workers_dev: false,
    preview_urls: true,
    assets: { directory: 'assets', not_found_handling: 'none', binding: 'ASSETS' },
    vars: {
      APP_ENV: 'preview',
      APP_BUILD_TARGET: 'public',
      APP_ORIGIN: 'https://public-preview.invalid',
      PREVIEW_NOINDEX: 'true',
    },
    no_bundle: true,
    rules: [{ type: 'ESModule', globs: ['**/*.js', '**/*.mjs'] }],
    limits: { cpu_ms: 10, subrequests: 50 },
  }
}

describe('LEO-563 Cloudflare Preview publication gate', () => {
  it('accepts only the isolated Free-plan Preview contract', () => {
    expect(validatePreviewConfig(validConfig())).toMatchObject({
      workerName: 'dongphugia-v1-public-preview',
      previewAlias: 'pr-138',
      workersDev: false,
      previewUrls: true,
      routes: [],
      customDomains: [],
      limits: { cpuMs: 10, subrequests: 50 },
    })
  })

  it.each([
    ['route', { routes: [{ pattern: 'dongphugia.vn/*' }] }],
    ['custom domain', { custom_domains: ['www.dongphugia.vn'] }],
    ['secret binding', { vars: { ...validConfig().vars, DATABASE_URL: 'forbidden' } }],
    ['workers.dev production endpoint', { workers_dev: true }],
    ['paid-limit assumption', { limits: { cpu_ms: 11, subrequests: 51 } }],
  ])('rejects %s configuration', (_label, change) => {
    expect(() => validatePreviewConfig({ ...validConfig(), ...change })).toThrow(/LEO563_PREVIEW_/)
  })

  it('records only the immutable version and aliased workers.dev URLs', () => {
    const parsed = parseWranglerUpload(`
      Worker Version ID: 11111111-2222-3333-4444-555555555555
      Version Preview URL: https://abc123-dongphugia-v1-public-preview.example.workers.dev
      Alias URL: https://pr-138-dongphugia-v1-public-preview.example.workers.dev
    `)
    expect(parsed).toEqual({
      workerVersionId: '11111111-2222-3333-4444-555555555555',
      previewAlias: 'pr-138',
      previewUrl: 'https://pr-138-dongphugia-v1-public-preview.example.workers.dev',
      versionPreviewUrl: 'https://abc123-dongphugia-v1-public-preview.example.workers.dev',
    })
  })

  it('fails closed when Wrangler does not return the exact alias URL', () => {
    expect(() => parseWranglerUpload(`
      Worker Version ID: 11111111-2222-3333-4444-555555555555
      Version Preview URL: https://abc123-other-worker.example.workers.dev
    `)).toThrow('LEO563_PREVIEW_ALIAS_URL_MISSING')
  })

  it('uses only GET calls and records sanitized isolated-resource evidence', async () => {
    const requests: Array<{ url: string, method: string }> = []
    const versionId = '11111111-2222-3333-4444-555555555555'
    const fetchImpl = async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = String(input)
      requests.push({ url, method: init?.method ?? 'GET' })
      let result: unknown
      if (url.endsWith('/settings')) result = { bindings: [
        { name: 'ASSETS', type: 'assets' },
        { name: 'APP_ENV', type: 'plain_text', text: 'preview' },
        { name: 'APP_BUILD_TARGET', type: 'plain_text', text: 'public' },
        { name: 'APP_ORIGIN', type: 'plain_text', text: 'https://public-preview.invalid' },
        { name: 'PREVIEW_NOINDEX', type: 'plain_text', text: 'true' },
      ] }
      else if (url.endsWith('/subdomain')) result = { enabled: false, previews_enabled: true }
      else if (url.includes('/workers/domains?')) result = []
      else result = { id: versionId }
      return Response.json({ success: true, result })
    }

    const proof = await inspectPublishedResource({ accountId: 'synthetic-account', apiToken: 'synthetic-token', versionId, fetchImpl })
    expect(proof).toMatchObject({ workersDev: false, previewUrls: true, customDomains: [], workerRoutes: [], productionAssociation: false })
    expect(requests).toHaveLength(4)
    expect(requests.every(({ method }) => method === 'GET')).toBe(true)
  })

  it('requires the exact Worker and its custom-domain set to be absent before creation', async () => {
    const requests: string[] = []
    const fetchImpl = async (input: URL | RequestInfo, init?: RequestInit) => {
      expect(init?.method).toBe('GET')
      requests.push(String(input))
      return Response.json({ success: true, result: [] })
    }
    await expect(assertRemoteResourceAbsent({ accountId: 'synthetic-account', apiToken: 'synthetic-token', fetchImpl })).resolves.toMatchObject({
      workerName: 'dongphugia-v1-public-preview',
      workerAbsent: true,
      customDomains: [],
    })
    expect(requests).toHaveLength(2)
  })
})
