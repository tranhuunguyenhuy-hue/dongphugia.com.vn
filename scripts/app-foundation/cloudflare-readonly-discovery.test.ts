import { describe, expect, it } from 'vitest'

import { runDiscovery } from './cloudflare-readonly-discovery.mjs'

function response(result: unknown, status = 200) {
  return new Response(JSON.stringify({ success: status < 400, result, errors: status < 400 ? [] : [{ code: 10000, message: 'redacted by implementation' }] }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('LEO-563 Cloudflare read-only discovery', () => {
  it('reports unavailable CI credentials without making a provider call', async () => {
    const calls: string[] = []
    const report = await runDiscovery({
      accountId: '',
      apiToken: '',
      fetchImpl: async (url: string) => { calls.push(url); return response([]) },
    })
    expect(calls).toEqual([])
    expect(report.credentials).toEqual({ accountId: 'UNAVAILABLE', apiToken: 'UNAVAILABLE' })
    expect(report.createNewResourceRequired).toBeNull()
  })

  it('uses GET only, sanitizes credentials and rejects routed or bound Workers', async () => {
    const requests: Array<{ url: string; method: string; authorization: string }> = []
    const fetchImpl = async (url: string, init?: RequestInit) => {
      requests.push({
        url,
        method: String(init?.method),
        authorization: String(new Headers(init?.headers).get('authorization')),
      })
      if (url.endsWith('/workers/scripts')) return response([{ id: 'safe-preview' }, { id: 'routed-preview' }, { id: 'bound-preview' }])
      if (url.endsWith('/workers/domains')) return response([{ service: 'routed-preview', hostname: 'www.dongphugia.vn' }])
      if (url.includes('/subscriptions')) return response([{ rate_plan: { public_name: 'Workers Free' } }])
      if (url.includes('/account-settings')) return response({ default_usage_model: 'standard' })
      if (url.includes('/zones?')) return response([{ id: 'zone-secret-id' }])
      if (url.includes('/workers/routes')) return response([{ script: 'routed-preview', pattern: 'dongphugia.vn/*' }])
      if (url.endsWith('/subdomain')) return response({ enabled: false, previews_enabled: true })
      if (url.endsWith('/versions')) return response({ items: [{ id: '11111111-1111-1111-1111-111111111111', created_on: '2026-08-31T00:00:00.000Z', number: 1 }] })
      if (url.endsWith('/deployments')) return response({ deployments: [{ id: '22222222-2222-2222-2222-222222222222', strategy: 'percentage', versions: [{ version_id: '11111111-1111-1111-1111-111111111111', percentage: 100 }] }] })
      if (url.includes('/settings')) {
        return response(url.includes('bound-preview') ? { bindings: [{ name: 'DB', type: 'd1' }] } : { bindings: [] })
      }
      if (url.endsWith('/pages/projects')) return response([{ name: 'legacy-production', subdomain: 'legacy.pages.dev' }])
      if (url.includes('/pages/projects/legacy-production/domains')) return response([{ name: 'dongphugia.vn' }])
      throw new Error(`Unexpected test URL: ${url}`)
    }

    const report = await runDiscovery({
      accountId: 'account-secret-id',
      apiToken: 'token-secret-value',
      sourceCommit: '4c1f0d801781bc988f99519335827cc671d07310',
      fetchImpl,
    })
    expect(requests.every((request) => request.method === 'GET')).toBe(true)
    expect(report.suitableIsolatedPublicWorker).toBe('safe-preview')
    expect(report.createNewResourceRequired).toBe(false)
    expect(report.workersPlan.freeConfirmed).toBe(true)
    expect(report.workers.find((worker) => worker.name === 'safe-preview')?.versions).toEqual(expect.objectContaining({
      status: 'READ_OK',
      versionIds: ['11111111-1111-1111-1111-111111111111'],
    }))
    expect(report.workers.find((worker) => worker.name === 'safe-preview')?.deployments).toEqual(expect.objectContaining({
      status: 'READ_OK',
      deploymentIds: ['22222222-2222-2222-2222-222222222222'],
    }))
    expect(report.productionAssociation).toBe('PRESENT_ON_ACCOUNT_RESOURCES')
    expect(report.sourceCommit).toBe('4c1f0d801781bc988f99519335827cc671d07310')
    const serialized = JSON.stringify(report)
    expect(serialized).not.toContain('account-secret-id')
    expect(serialized).not.toContain('token-secret-value')
    expect(serialized).not.toContain('zone-secret-id')
    expect(serialized).not.toContain('redacted by implementation')
  })

  it('fails suitability closed when required inventory permissions are denied', async () => {
    const fetchImpl = async (url: string) => {
      if (url.includes('/workers/domains')) return response(null, 403)
      if (url.includes('/zones?')) return response([])
      if (url.includes('/workers/scripts')) return response([])
      if (url.includes('/pages/projects')) return response([])
      return response([])
    }
    const report = await runDiscovery({ accountId: 'account', apiToken: 'token', fetchImpl })
    expect(report.suitableIsolatedPublicWorker).toBeNull()
    expect(report.createNewResourceRequired).toBeNull()
    expect(report.productionAssociation).toBe('UNKNOWN')
    expect(report.calls).toContainEqual(expect.objectContaining({ label: 'workers.domains.list', status: 'READ_DENIED' }))
  })

  it('records malformed version/deployment state without treating it as safe', async () => {
    const fetchImpl = async (url: string) => {
      if (url.endsWith('/workers/scripts')) return response([{ id: 'safe-preview' }])
      if (url.endsWith('/workers/domains')) return response([])
      if (url.includes('/subscriptions')) return response([{ rate_plan: { public_name: 'Workers Free' } }])
      if (url.includes('/account-settings')) return response({ default_usage_model: 'standard' })
      if (url.includes('/zones?')) return response([])
      if (url.endsWith('/subdomain')) return response({ enabled: false, previews_enabled: true })
      if (url.endsWith('/versions')) return response({ items: [{ id: 'not-a-version-id' }] })
      if (url.endsWith('/deployments')) return response({ deployments: [{ id: 'not-a-deployment-id', strategy: 'percentage', versions: [] }] })
      if (url.includes('/settings')) return response({ bindings: [] })
      if (url.endsWith('/pages/projects')) return response([])
      throw new Error(`Unexpected test URL: ${url}`)
    }

    const report = await runDiscovery({ accountId: 'account', apiToken: 'token', fetchImpl })
    const worker = report.workers[0]
    expect(worker.versions.status).toBe('INVALID')
    expect(worker.deployments.status).toBe('INVALID')
    expect(report.suitableIsolatedPublicWorker).toBeNull()
    expect(report.createNewResourceRequired).toBeNull()
  })
})
