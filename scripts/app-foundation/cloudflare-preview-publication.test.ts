import { describe, expect, it } from 'vitest'

import {
  inspectRemoteResourceState,
  inspectPublishedResource,
  parseWranglerDeploy,
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
    })
  })

  it.each([
    ['route', { routes: [{ pattern: 'dongphugia.vn/*' }] }],
    ['custom domain', { custom_domains: ['www.dongphugia.vn'] }],
    ['secret binding', { vars: { ...validConfig().vars, DATABASE_URL: 'forbidden' } }],
    ['workers.dev production endpoint', { workers_dev: true }],
  ])('rejects %s configuration', (_label, change) => {
    expect(() => validatePreviewConfig({ ...validConfig(), ...change })).toThrow(/LEO563_PREVIEW_/)
  })

  it.each([
    ['null limits block', null],
    ['empty limits block', {}],
    ['provider-matching subrequest limit', { subrequests: 50 }],
    ['explicit CPU limit', { cpu_ms: 10 }],
  ])('rejects any explicit Free Preview limits block: %s', (_label, limits) => {
    expect(() => validatePreviewConfig({ ...validConfig(), limits })).toThrow('LEO563_PREVIEW_EXPLICIT_LIMITS_FORBIDDEN')
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

  it('records the bootstrap version needed to explain a later publication state', () => {
    expect(parseWranglerDeploy('No targets deployed for dongphugia-v1-public-preview\nCurrent Version ID: 11111111-2222-3333-4444-555555555555')).toEqual({
      bootstrapVersionId: '11111111-2222-3333-4444-555555555555',
    })
  })

  it('uses only GET calls and records sanitized isolated-resource evidence', async () => {
    const requests: Array<{ url: string, method: string }> = []
    const versionId = '11111111-2222-3333-4444-555555555555'
    const fetchImpl = async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = String(input)
      requests.push({ url, method: init?.method ?? 'GET' })
      let result: unknown
      if (url.endsWith('/scripts')) result = [{ id: 'dongphugia-v1-public-preview', routes: [] }]
      else if (url.endsWith('/settings')) result = { bindings: [
        { name: 'ASSETS', type: 'assets' },
        { name: 'APP_ENV', type: 'plain_text', text: 'preview' },
        { name: 'APP_BUILD_TARGET', type: 'plain_text', text: 'public' },
        { name: 'APP_ORIGIN', type: 'plain_text', text: 'https://public-preview.invalid' },
        { name: 'PREVIEW_NOINDEX', type: 'plain_text', text: 'true' },
      ] }
      else if (url.endsWith('/subdomain')) result = { enabled: false, previews_enabled: true }
      else if (url.includes('/workers/domains?')) result = []
      else if (url.endsWith('/versions')) result = { items: [{ id: versionId }] }
      else if (url.endsWith('/deployments')) result = { deployments: [] }
      else result = { id: versionId }
      return Response.json({ success: true, result })
    }

    const proof = await inspectPublishedResource({
      accountId: 'synthetic-account',
      apiToken: 'synthetic-token',
      versionId,
      beforeState: {
        workerName: 'dongphugia-v1-public-preview',
        state: 'INCOMPLETE',
        workerAbsent: false,
        bootstrapRequired: false,
        reconciliationAllowed: true,
        activeDeployment: false,
        versionCount: 0,
        versionIds: [],
        deployments: [],
        customDomains: [],
        workerRoutes: [],
        bindings: [],
      },
      fetchImpl,
    })
    expect(proof).toMatchObject({
      contract: 'dongphugia:cloudflare-preview-resource-proof:v2',
      workersDev: false,
      previewUrls: true,
      customDomains: [],
      workerRoutes: [],
      productionAssociation: false,
      versionIds: [versionId],
      deployments: [],
    })
    expect(requests).toHaveLength(7)
    expect(requests.every(({ method }) => method === 'GET')).toBe(true)
  })

  it('classifies an absent Worker as safe for first deployment', async () => {
    const requests: string[] = []
    const fetchImpl = async (input: URL | RequestInfo, init?: RequestInit) => {
      expect(init?.method).toBe('GET')
      requests.push(String(input))
      return Response.json({ success: true, result: [] })
    }
    await expect(inspectRemoteResourceState({ accountId: 'synthetic-account', apiToken: 'synthetic-token', fetchImpl })).resolves.toMatchObject({
      workerName: 'dongphugia-v1-public-preview',
      state: 'ABSENT',
      workerAbsent: true,
      bootstrapRequired: true,
      reconciliationAllowed: true,
      versionIds: [],
      deployments: [],
      customDomains: [],
    })
    expect(requests).toHaveLength(2)
  })

  it('classifies the known empty Worker as safe for immutable version reconciliation', async () => {
    const requests: string[] = []
    const fetchImpl = async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = String(input)
      requests.push(url)
      expect(init?.method).toBe('GET')
      const result = url.endsWith('/scripts')
        ? [{ id: 'dongphugia-v1-public-preview', routes: [] }]
        : url.includes('/workers/domains?')
          ? []
          : url.endsWith('/subdomain')
            ? { enabled: false, previews_enabled: false }
            : url.endsWith('/settings')
              ? { bindings: [] }
              : url.endsWith('/versions')
                ? { items: [] }
                : url.endsWith('/deployments')
                  ? { deployments: [] }
                  : null
      return Response.json({ success: true, result })
    }

    await expect(inspectRemoteResourceState({ accountId: 'synthetic-account', apiToken: 'synthetic-token', fetchImpl })).resolves.toMatchObject({
      workerName: 'dongphugia-v1-public-preview',
      state: 'INCOMPLETE',
      workerAbsent: false,
      bootstrapRequired: false,
      reconciliationAllowed: true,
      activeDeployment: false,
      versionCount: 0,
      versionIds: [],
      deployments: [],
      customDomains: [],
      workerRoutes: [],
      bindings: [],
    })
    expect(requests).toHaveLength(6)
  })

  it('permits post-failure inspection only for the exact publication-attempt state', async () => {
    const versionId = '11111111-2222-3333-4444-555555555555'
    const deploymentId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    const deployment = {
      id: deploymentId,
      strategy: 'percentage',
      versions: [{ versionId, percentage: 100 }],
    }
    const providerDeployment = {
      id: deploymentId,
      strategy: 'percentage',
      versions: [{ version_id: versionId, percentage: 100 }],
    }
    const proof = {
      contract: 'dongphugia:cloudflare-preview-resource-proof:v2',
      workerName: 'dongphugia-v1-public-preview',
      workerVersionId: versionId,
      workersDev: false,
      previewUrls: true,
      customDomains: [],
      workerRoutes: [],
      productionAssociation: false,
      versionIds: [versionId],
      deployments: [deployment],
      deploymentIds: [deploymentId],
      publicationBaseline: {
        workerName: 'dongphugia-v1-public-preview',
        state: 'ABSENT',
        workerAbsent: true,
        bootstrapRequired: true,
        reconciliationAllowed: true,
        activeDeployment: false,
        versionCount: 0,
        versionIds: [],
        deployments: [],
        customDomains: [],
        workerRoutes: [],
        bindings: [],
      },
    }
    const requests: Array<{ url: string, method: string }> = []
    const fetchImpl = async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = String(input)
      requests.push({ url, method: init?.method ?? 'GET' })
      const result = url.endsWith('/scripts')
        ? [{ id: 'dongphugia-v1-public-preview', routes: [] }]
        : url.includes('/workers/domains?')
          ? []
          : url.endsWith('/subdomain')
            ? { enabled: false, previews_enabled: true }
            : url.endsWith('/settings')
              ? { bindings: [{ name: 'ASSETS', type: 'assets' }] }
              : url.endsWith('/versions')
                ? { items: [{ id: versionId }] }
                : url.endsWith('/deployments')
                  ? { deployments: [providerDeployment] }
                  : null
      return Response.json({ success: true, result })
    }

    await expect(inspectRemoteResourceState({
      accountId: 'synthetic-account',
      apiToken: 'synthetic-token',
      expectedPublication: proof,
      fetchImpl,
    })).resolves.toMatchObject({
      contract: 'dongphugia:cloudflare-preview-post-failure-state:v1',
      state: 'PUBLISHED_ATTEMPT',
      expectedWorkerVersionId: versionId,
      versionIds: [versionId],
      deployments: [deployment],
      inspection: 'exact-current-publication-attempt',
    })
    expect(requests).toHaveLength(6)
    expect(requests.every(({ method }) => method === 'GET')).toBe(true)
  })

  it('rejects post-failure inspection when a new version appears after the attempt', async () => {
    const versionId = '11111111-2222-3333-4444-555555555555'
    const unexpectedVersionId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    const proof = {
      contract: 'dongphugia:cloudflare-preview-resource-proof:v2',
      workerName: 'dongphugia-v1-public-preview',
      workerVersionId: versionId,
      workersDev: false,
      previewUrls: true,
      customDomains: [],
      workerRoutes: [],
      productionAssociation: false,
      versionIds: [versionId],
      deployments: [],
      deploymentIds: [],
      publicationBaseline: {
        workerName: 'dongphugia-v1-public-preview',
        state: 'INCOMPLETE',
        workerAbsent: false,
        bootstrapRequired: false,
        reconciliationAllowed: true,
        activeDeployment: false,
        versionCount: 0,
        versionIds: [],
        deployments: [],
        customDomains: [],
        workerRoutes: [],
        bindings: [],
      },
    }
    const fetchImpl = async (input: URL | RequestInfo) => {
      const url = String(input)
      const result = url.endsWith('/scripts')
        ? [{ id: 'dongphugia-v1-public-preview', routes: [] }]
        : url.includes('/workers/domains?')
          ? []
          : url.endsWith('/subdomain')
            ? { enabled: false, previews_enabled: true }
            : url.endsWith('/settings')
              ? { bindings: [{ name: 'ASSETS', type: 'assets' }] }
              : url.endsWith('/versions')
                ? { items: [{ id: versionId }, { id: unexpectedVersionId }] }
                : url.endsWith('/deployments')
                  ? { deployments: [] }
                  : null
      return Response.json({ success: true, result })
    }

    await expect(inspectRemoteResourceState({
      accountId: 'synthetic-account',
      apiToken: 'synthetic-token',
      expectedPublication: proof,
      fetchImpl,
    })).rejects.toThrow('LEO563_PREVIEW_POST_FAILURE_VERSION_STATE_UNEXPECTED')
  })

  it('rejects post-failure inspection when an unexpected deployment appears after the attempt', async () => {
    const versionId = '11111111-2222-3333-4444-555555555555'
    const unexpectedDeploymentId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    const proof = {
      contract: 'dongphugia:cloudflare-preview-resource-proof:v2',
      workerName: 'dongphugia-v1-public-preview',
      workerVersionId: versionId,
      workersDev: false,
      previewUrls: true,
      customDomains: [],
      workerRoutes: [],
      productionAssociation: false,
      versionIds: [versionId],
      deployments: [],
      deploymentIds: [],
      publicationBaseline: {
        workerName: 'dongphugia-v1-public-preview',
        state: 'INCOMPLETE',
        workerAbsent: false,
        bootstrapRequired: false,
        reconciliationAllowed: true,
        activeDeployment: false,
        versionCount: 0,
        versionIds: [],
        deployments: [],
        customDomains: [],
        workerRoutes: [],
        bindings: [],
      },
    }
    const fetchImpl = async (input: URL | RequestInfo) => {
      const url = String(input)
      const result = url.endsWith('/scripts')
        ? [{ id: 'dongphugia-v1-public-preview', routes: [] }]
        : url.includes('/workers/domains?')
          ? []
          : url.endsWith('/subdomain')
            ? { enabled: false, previews_enabled: true }
            : url.endsWith('/settings')
              ? { bindings: [{ name: 'ASSETS', type: 'assets' }] }
              : url.endsWith('/versions')
                ? { items: [{ id: versionId }] }
                : url.endsWith('/deployments')
                  ? {
                    deployments: [{
                      id: unexpectedDeploymentId,
                      strategy: 'percentage',
                      versions: [{ version_id: versionId, percentage: 100 }],
                    }],
                  }
                  : null
      return Response.json({ success: true, result })
    }

    await expect(inspectRemoteResourceState({
      accountId: 'synthetic-account',
      apiToken: 'synthetic-token',
      expectedPublication: proof,
      fetchImpl,
    })).rejects.toThrow('LEO563_PREVIEW_POST_FAILURE_DEPLOYMENT_STATE_UNEXPECTED')
  })

  it.each([
    [
      'active deployment',
      { deployments: { deployments: [{ id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', strategy: 'percentage', versions: [{ version_id: '11111111-2222-3333-4444-555555555555', percentage: 100 }] }] } },
      'LEO563_PREVIEW_REMOTE_ACTIVE_DEPLOYMENT_FORBIDDEN',
    ],
    ['existing version', { versions: { items: [{ id: '11111111-2222-3333-4444-555555555555' }] } }, 'LEO563_PREVIEW_REMOTE_VERSION_STATE_FORBIDDEN'],
    ['route', { script: { id: 'dongphugia-v1-public-preview', routes: [{ id: 'route-id', pattern: 'example.com/*', script: 'dongphugia-v1-public-preview' }] } }],
    ['binding', { settings: { bindings: [{ name: 'DATABASE_URL', type: 'plain_text' }] } }],
  ])('rejects an incomplete-state reconciliation when it has an unexpected %s', async (_label, override, expectedError) => {
    const fetchImpl = async (input: URL | RequestInfo) => {
      const url = String(input)
      const script = override.script ?? { id: 'dongphugia-v1-public-preview', routes: [] }
      const result = url.endsWith('/scripts')
        ? [script]
        : url.includes('/workers/domains?')
          ? []
          : url.endsWith('/subdomain')
            ? { enabled: false, previews_enabled: false }
            : url.endsWith('/settings')
              ? (override.settings ?? { bindings: [] })
              : url.endsWith('/versions')
                ? (override.versions ?? { items: [] })
                : url.endsWith('/deployments')
                  ? (override.deployments ?? { deployments: [] })
                  : null
      return Response.json({ success: true, result })
    }

    await expect(inspectRemoteResourceState({
      accountId: 'synthetic-account',
      apiToken: 'synthetic-token',
      fetchImpl,
    })).rejects.toThrow(expectedError || 'LEO563_PREVIEW_REMOTE_')
  })

  it('fails closed when an existing Worker does not expose complete empty-state evidence', async () => {
    const fetchImpl = async (input: URL | RequestInfo) => {
      const url = String(input)
      const result = url.endsWith('/scripts')
        ? [{ id: 'dongphugia-v1-public-preview', routes: [] }]
        : url.includes('/workers/domains?')
          ? []
          : url.endsWith('/subdomain')
            ? { enabled: false, previews_enabled: false }
            : url.endsWith('/settings')
              ? null
              : url.endsWith('/versions')
                ? { items: [] }
                : url.endsWith('/deployments')
                  ? { deployments: [] }
                  : null
      return Response.json({ success: true, result })
    }

    await expect(inspectRemoteResourceState({
      accountId: 'synthetic-account',
      apiToken: 'synthetic-token',
      fetchImpl,
    })).rejects.toThrow('LEO563_PREVIEW_REMOTE_SETTINGS_STATE_UNKNOWN')
  })
})
