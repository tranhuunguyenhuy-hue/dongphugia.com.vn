import { describe, expect, it, vi } from 'vitest'

import { verifyEnvironmentWorkerTokenScope } from './verify-environment-worker-token-scope.mjs'

const accountId = 'd54f3402b9d112ab64d6135e0e3f1fb1'

describe('environment Worker token scope preflight', () => {
  it('requires access to the selected Worker and denies Production before upload', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 403 }))
    await expect(verifyEnvironmentWorkerTokenScope({
      environment: 'preview', accountId, apiToken: 'scoped-test-token', fetchImpl,
    })).resolves.toMatchObject({
      workerName: 'dpg-preview',
      selectedWorkerReadable: true,
      productionWorkerDenied: true,
      productionStatus: 403,
    })
    expect(fetchImpl.mock.calls[0][0]).toContain('/scripts/dpg-preview/settings')
    expect(fetchImpl.mock.calls[1][0]).toContain('/scripts/dongphugia-v1-public-production/settings')
    expect(fetchImpl.mock.calls[0][1].method).toBe('GET')
  })

  it('rejects a token that can read Production or cannot read its selected Worker', async () => {
    await expect(verifyEnvironmentWorkerTokenScope({
      environment: 'staging', accountId, apiToken: 'too-broad',
      fetchImpl: vi.fn().mockResolvedValue(new Response('{}', { status: 200 })),
    })).rejects.toThrow('ENVIRONMENT_WORKER_TOKEN_PRODUCTION_ACCESS_FORBIDDEN')

    await expect(verifyEnvironmentWorkerTokenScope({
      environment: 'staging', accountId, apiToken: 'wrong-scope',
      fetchImpl: vi.fn().mockResolvedValue(new Response('{}', { status: 403 })),
    })).rejects.toThrow('ENVIRONMENT_WORKER_TOKEN_SELECTED_WORKER_ACCESS_REQUIRED')
  })
})
