import { describe, expect, it, vi } from 'vitest'

import { validateEnvironmentWorkerSource } from './validate-environment-worker-source.mjs'

const repository = 'tranhuunguyenhuy-hue/dongphugia.com.vn'
const sourceSha = 'a'.repeat(40)
const token = 'test-github-token'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('combined Worker trusted source gate', () => {
  it('accepts only a commit on main for the main publication path', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ status: 'ahead', head: { sha: sourceSha } }))
    await expect(validateEnvironmentWorkerSource({
      sourceKind: 'main', sourceSha, repository, token, fetchImpl,
    })).resolves.toMatchObject({ sourceKind: 'main', sourceSha })
    expect(fetchImpl.mock.calls[0][0]).toContain(`/compare/main...${sourceSha}`)
  })

  it('requires an open same-repository PR approved at the exact head SHA', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        state: 'open', draft: false, base: { ref: 'main' }, head: { sha: sourceSha, repo: { full_name: repository } },
      }))
      .mockResolvedValueOnce(jsonResponse({ data: { repository: { pullRequest: { reviewDecision: 'APPROVED' } } } }))
    await expect(validateEnvironmentWorkerSource({
      sourceKind: 'approved-pr', sourceSha, prNumber: '42', repository, token, fetchImpl,
    })).resolves.toMatchObject({ sourceKind: 'approved-pr', sourceSha, prNumber: 42 })
  })

  it('rejects unapproved or changed PR candidates', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        state: 'open', draft: false, base: { ref: 'main' }, head: { sha: sourceSha, repo: { full_name: repository } },
      }))
      .mockResolvedValueOnce(jsonResponse({ data: { repository: { pullRequest: { reviewDecision: 'REVIEW_REQUIRED' } } } }))
    await expect(validateEnvironmentWorkerSource({
      sourceKind: 'approved-pr', sourceSha, prNumber: '42', repository, token, fetchImpl,
    })).rejects.toThrow('ENVIRONMENT_WORKER_SOURCE_PR_APPROVAL_REQUIRED')

    await expect(validateEnvironmentWorkerSource({
      sourceKind: 'approved-pr', sourceSha, prNumber: '42', repository, token,
      fetchImpl: vi.fn().mockResolvedValue(jsonResponse({
        state: 'open', draft: false, base: { ref: 'main' }, head: { sha: 'b'.repeat(40), repo: { full_name: repository } },
      })),
    })).rejects.toThrow('ENVIRONMENT_WORKER_SOURCE_PR_IDENTITY_INVALID')
  })
})
