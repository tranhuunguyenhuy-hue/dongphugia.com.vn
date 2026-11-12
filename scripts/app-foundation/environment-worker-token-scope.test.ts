import { describe, expect, it, vi } from 'vitest'

import { REQUIRED_POLICY_SCOPE_ATTESTATION, verifyEnvironmentWorkerTokenScope } from './verify-environment-worker-token-scope.mjs'

const accountId = 'd54f3402b9d112ab64d6135e0e3f1fb1'

describe('environment Worker token scope preflight', () => {
  it('requires reviewed Individual Worker Editor evidence and checks only the selected Worker', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    await expect(verifyEnvironmentWorkerTokenScope({
      environment: 'staging', accountId, apiToken: 'scoped-test-token',
      policyScopeAttestation: REQUIRED_POLICY_SCOPE_ATTESTATION, fetchImpl,
    })).resolves.toMatchObject({
      workerName: 'dpg-staging',
      selectedWorkerReadable: true,
      policyScopeAttestation: { value: REQUIRED_POLICY_SCOPE_ATTESTATION, apiVerified: false },
      productionWriteAuthority: 'unknown-not-tested',
    })
    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(fetchImpl.mock.calls[0][0]).toContain('/scripts/dpg-staging/settings')
    expect(fetchImpl.mock.calls[0][1].method).toBe('GET')
    expect(fetchImpl.mock.calls[0][0]).not.toContain('dongphugia-v1-public-production')
  })

  it('rejects missing policy evidence or a token without selected Worker read access', async () => {
    await expect(verifyEnvironmentWorkerTokenScope({
      environment: 'staging', accountId, apiToken: 'scoped-test-token', fetchImpl: vi.fn(),
    })).rejects.toThrow('ENVIRONMENT_WORKER_TOKEN_POLICY_SCOPE_EVIDENCE_REQUIRED')

    await expect(verifyEnvironmentWorkerTokenScope({
      environment: 'staging', accountId, apiToken: 'wrong-scope',
      policyScopeAttestation: REQUIRED_POLICY_SCOPE_ATTESTATION,
      fetchImpl: vi.fn().mockResolvedValue(new Response('{}', { status: 403 })),
    })).rejects.toThrow('ENVIRONMENT_WORKER_TOKEN_SELECTED_WORKER_ACCESS_REQUIRED')
  })
})
