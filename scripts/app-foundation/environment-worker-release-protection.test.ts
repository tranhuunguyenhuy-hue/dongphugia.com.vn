import { describe, expect, it, vi } from 'vitest'

import {
  validateEnvironmentWorkerReleaseProtection,
  verifyEnvironmentWorkerReleaseProtection,
} from './verify-environment-worker-release-protection.mjs'

const repository = 'tranhuunguyenhuy-hue/dongphugia.com.vn'
const token = 'test-github-token'

function configuration() {
  return {
    environment: {
      name: 'cloudflare-staging',
      can_admins_bypass: false,
      deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
      protection_rules: [{
        type: 'required_reviewers',
        prevent_self_review: false,
        reviewers: [{ type: 'User', reviewer: { login: 'tranhuunguyenhuy-hue' } }],
      }],
    },
    branchPolicies: { branch_policies: [{ name: 'main', type: 'branch' }] },
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('Staging GitHub release protection', () => {
  it('requires an Owner reviewer, main-only branch policy, and disabled administrator bypass', () => {
    expect(validateEnvironmentWorkerReleaseProtection(configuration())).toEqual({
      repository,
      environment: 'cloudflare-staging',
      requiredReviewer: 'tranhuunguyenhuy-hue',
      branch: 'main',
      adminsCanBypass: false,
      protectionVerified: true,
    })
  })

  it.each([
    ['missing environment', { ...configuration(), environment: undefined }, 'ENVIRONMENT_WORKER_GITHUB_ENVIRONMENT_INVALID'],
    ['wrong environment', { ...configuration(), environment: { ...configuration().environment, name: 'staging' } }, 'ENVIRONMENT_WORKER_GITHUB_ENVIRONMENT_INVALID'],
    ['administrator bypass', { ...configuration(), environment: { ...configuration().environment, can_admins_bypass: true } }, 'ENVIRONMENT_WORKER_GITHUB_ADMIN_BYPASS_ENABLED'],
    ['missing reviewer', { ...configuration(), environment: { ...configuration().environment, protection_rules: [] } }, 'ENVIRONMENT_WORKER_GITHUB_REVIEWER_GATE_MISSING'],
    ['wrong reviewer', { ...configuration(), environment: { ...configuration().environment, protection_rules: [{ ...configuration().environment.protection_rules[0], reviewers: [{ type: 'User', reviewer: { login: 'someone-else' } }] }] } }, 'ENVIRONMENT_WORKER_GITHUB_REVIEWER_IDENTITY_INVALID'],
    ['additional reviewer', { ...configuration(), environment: { ...configuration().environment, protection_rules: [{ ...configuration().environment.protection_rules[0], reviewers: [...configuration().environment.protection_rules[0].reviewers, { type: 'User', reviewer: { login: 'another-user' } }] }] } }, 'ENVIRONMENT_WORKER_GITHUB_REVIEWER_IDENTITY_INVALID'],
    ['unrestricted branch policy', { ...configuration(), environment: { ...configuration().environment, deployment_branch_policy: null } }, 'ENVIRONMENT_WORKER_GITHUB_BRANCH_POLICY_INVALID'],
    ['wildcard branch', { ...configuration(), branchPolicies: { branch_policies: [{ name: '*', type: 'branch' }] } }, 'ENVIRONMENT_WORKER_GITHUB_BRANCH_POLICY_INVALID'],
    ['additional branch', { ...configuration(), branchPolicies: { branch_policies: [{ name: 'main', type: 'branch' }, { name: 'release/*', type: 'branch' }] } }, 'ENVIRONMENT_WORKER_GITHUB_BRANCH_POLICY_INVALID'],
  ] as const)('rejects %s configuration', (_label, candidate, code) => {
    expect(() => validateEnvironmentWorkerReleaseProtection(candidate)).toThrow(code)
  })

  it('reads only the exact environment protection and branch-policy endpoints', async () => {
    const setup = configuration()
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse(setup.environment))
      .mockResolvedValueOnce(jsonResponse(setup.branchPolicies))
    await expect(verifyEnvironmentWorkerReleaseProtection({ repository, token, fetchImpl }))
      .resolves.toMatchObject({ protectionVerified: true, branch: 'main' })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      'https://api.github.com/repos/tranhuunguyenhuy-hue/dongphugia.com.vn/environments/cloudflare-staging',
      'https://api.github.com/repos/tranhuunguyenhuy-hue/dongphugia.com.vn/environments/cloudflare-staging/deployment-branch-policies',
    ])
    expect(fetchImpl.mock.calls[0][1]?.headers).toMatchObject({ Authorization: `Bearer ${token}` })
  })

  it('fails closed on an API error and refuses other repositories or a missing GitHub token', async () => {
    await expect(verifyEnvironmentWorkerReleaseProtection({
      repository: 'other/repository', token, fetchImpl: vi.fn(),
    })).rejects.toThrow('ENVIRONMENT_WORKER_GITHUB_REPOSITORY_INVALID')
    await expect(verifyEnvironmentWorkerReleaseProtection({
      repository, token: '', fetchImpl: vi.fn(),
    })).rejects.toThrow('ENVIRONMENT_WORKER_GITHUB_TOKEN_MISSING')
    await expect(verifyEnvironmentWorkerReleaseProtection({
      repository, token, fetchImpl: vi.fn().mockResolvedValue(jsonResponse({ message: 'denied' }, 403)),
    })).rejects.toThrow('ENVIRONMENT_WORKER_GITHUB_PROTECTION_REQUEST_FAILED')
  })
})
