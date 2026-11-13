import { describe, expect, it, vi } from 'vitest'

import { verifyEnvironmentWorkerDeploymentToken } from './verify-environment-worker-deployment-token.mjs'

const accountId = 'd54f3402b9d112ab64d6135e0e3f1fb1'
const expectedTokenId = 'a'.repeat(32)
const token = 'test-only-token'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('Staging deployment token identity preflight', () => {
  it('verifies the active token identity and explicitly leaves scope to external review', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      success: true,
      result: { id: expectedTokenId, status: 'active' },
    }))

    await expect(verifyEnvironmentWorkerDeploymentToken({
      environment: 'staging', accountId, expectedTokenId, apiToken: token, fetchImpl,
    })).resolves.toEqual({
      environment: 'staging',
      accountId,
      workerName: 'dpg-staging',
      tokenId: expectedTokenId,
      tokenStatus: 'active',
      tokenIdentityVerified: true,
      policyScopeMachineVerified: false,
      policyScopeReview: 'external-required-reviewer-approval',
    })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [requestUrl, request] = fetchImpl.mock.calls[0]
    expect(requestUrl).toBe(`https://api.cloudflare.com/client/v4/accounts/${accountId}/tokens/verify`)
    expect(request).toMatchObject({ method: 'GET' })
    expect(request.headers).toMatchObject({ Authorization: `Bearer ${token}` })
  })

  it.each([
    { label: 'different token id', result: { id: 'b'.repeat(32), status: 'active' } },
    { label: 'disabled token', result: { id: expectedTokenId, status: 'disabled' } },
    { label: 'expired token', result: { id: expectedTokenId, status: 'expired' } },
    { label: 'missing token status', result: { id: expectedTokenId } },
  ])('rejects $label', async ({ result }) => {
    await expect(verifyEnvironmentWorkerDeploymentToken({
      environment: 'staging', accountId, expectedTokenId, apiToken: token,
      fetchImpl: vi.fn().mockResolvedValue(jsonResponse({ success: true, result })),
    })).rejects.toThrow('ENVIRONMENT_WORKER_TOKEN_IDENTITY_MISMATCH')
  })

  it('rejects API failures, malformed responses, and network failures without exposing credentials', async () => {
    const denied = await verifyEnvironmentWorkerDeploymentToken({
      environment: 'staging', accountId, expectedTokenId, apiToken: token,
      fetchImpl: vi.fn().mockResolvedValue(jsonResponse({ success: false }, 403)),
    }).catch((error: Error) => error.message)
    expect(denied).toBe('ENVIRONMENT_WORKER_TOKEN_IDENTITY_REQUEST_FAILED')
    expect(denied).not.toContain(token)

    await expect(verifyEnvironmentWorkerDeploymentToken({
      environment: 'staging', accountId, expectedTokenId, apiToken: token,
      fetchImpl: vi.fn().mockResolvedValue(new Response('not json')),
    })).rejects.toThrow('ENVIRONMENT_WORKER_TOKEN_IDENTITY_RESPONSE_INVALID')

    await expect(verifyEnvironmentWorkerDeploymentToken({
      environment: 'staging', accountId, expectedTokenId, apiToken: token,
      fetchImpl: vi.fn().mockRejectedValue(new Error(`request failed: ${token}`)),
    })).rejects.toThrow('ENVIRONMENT_WORKER_TOKEN_IDENTITY_REQUEST_FAILED')
  })

  it('rejects wrong target, account, malformed token identity, and missing credentials before fetching', async () => {
    const fetchImpl = vi.fn()
    await expect(verifyEnvironmentWorkerDeploymentToken({
      environment: 'preview', accountId, expectedTokenId, apiToken: token, fetchImpl,
    })).rejects.toThrow('ENVIRONMENT_WORKER_TOKEN_ENVIRONMENT_INVALID')
    await expect(verifyEnvironmentWorkerDeploymentToken({
      environment: 'staging', accountId: 'wrong-account', expectedTokenId, apiToken: token, fetchImpl,
    })).rejects.toThrow('ENVIRONMENT_WORKER_TOKEN_ACCOUNT_MISMATCH')
    await expect(verifyEnvironmentWorkerDeploymentToken({
      environment: 'staging', accountId, expectedTokenId: 'not-an-id', apiToken: token, fetchImpl,
    })).rejects.toThrow('ENVIRONMENT_WORKER_TOKEN_EXPECTED_ID_INVALID')
    await expect(verifyEnvironmentWorkerDeploymentToken({
      environment: 'staging', accountId, expectedTokenId, apiToken: '', fetchImpl,
    })).rejects.toThrow('ENVIRONMENT_WORKER_TOKEN_CREDENTIAL_MISSING')
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
