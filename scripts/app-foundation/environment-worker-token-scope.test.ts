import { describe, expect, it, vi } from 'vitest'

import { verifyEnvironmentWorkerTokenScope } from './verify-environment-worker-token-scope.mjs'

const accountId = 'd54f3402b9d112ab64d6135e0e3f1fb1'

describe('environment Worker token scope preflight', () => {
  it('blocks even a manual scope string plus successful selected-Worker GET', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    const legacyAttestation = {
      environment: 'staging',
      accountId,
      apiToken: 'test-only-token',
      policyScopeAttestation: 'individual-worker:dpg-staging:editor',
      fetchImpl,
    }
    await expect(verifyEnvironmentWorkerTokenScope(legacyAttestation))
      .rejects.toThrow('ENVIRONMENT_WORKER_TOKEN_SCOPE_PROOF_UNAVAILABLE')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('rejects an invalid environment or account before publication', async () => {
    await expect(verifyEnvironmentWorkerTokenScope({
      environment: 'preview', accountId,
    })).rejects.toThrow('ENVIRONMENT_WORKER_TOKEN_ENVIRONMENT_INVALID')

    await expect(verifyEnvironmentWorkerTokenScope({
      environment: 'staging', accountId: 'wrong-account',
    })).rejects.toThrow('ENVIRONMENT_WORKER_TOKEN_ACCOUNT_MISMATCH')
  })
})
