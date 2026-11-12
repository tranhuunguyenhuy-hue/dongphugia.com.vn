import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { validateEnvironmentWorkerSource } from './validate-environment-worker-source.mjs'

const builderSource = readFileSync(resolve(process.cwd(), 'scripts/app-foundation/build-environment-worker.mts'), 'utf8')

const repository = 'tranhuunguyenhuy-hue/dongphugia.com.vn'
const sourceSha = 'a'.repeat(40)
const token = 'test-github-token'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('combined Worker trusted source gate', () => {
  it('removes Wrangler dry-run metadata before returning a publishable artifact', () => {
    const dryRun = builderSource.indexOf("await run(process.execPath, [wrangler, 'deploy', '--dry-run'")
    const cleanup = builderSource.indexOf("await rm(path.join(outputRoot, '.wrangler')")
    const buildPass = builderSource.indexOf('ENVIRONMENT_WORKER_BUILD_PASS')

    expect(dryRun).toBeGreaterThanOrEqual(0)
    expect(cleanup).toBeGreaterThan(dryRun)
    expect(buildPass).toBeGreaterThan(cleanup)
    expect(builderSource).toContain("{ recursive: true, force: true })")
  })

  it.each(['identical', 'behind'] as const)('accepts a %s source commit that is on main', async (status) => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      status,
      head: { sha: sourceSha },
      merge_base_commit: { sha: sourceSha },
    }))
    await expect(validateEnvironmentWorkerSource({
      sourceKind: 'main', sourceSha, repository, token, fetchImpl,
    })).resolves.toMatchObject({ sourceKind: 'main', sourceSha })
    expect(fetchImpl.mock.calls[0][0]).toContain(`/compare/main...${sourceSha}`)
  })

  it.each([
    { status: 'ahead', mergeBaseSha: 'b'.repeat(40) },
    { status: 'diverged', mergeBaseSha: 'b'.repeat(40) },
    { status: 'behind', mergeBaseSha: 'b'.repeat(40) },
    { status: 'behind', mergeBaseSha: undefined },
  ])('rejects non-ancestor or incomplete main compare evidence: $status', async ({ status, mergeBaseSha }) => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      status,
      head: { sha: sourceSha },
      ...(mergeBaseSha ? { merge_base_commit: { sha: mergeBaseSha } } : {}),
    }))
    await expect(validateEnvironmentWorkerSource({
      sourceKind: 'main', sourceSha, repository, token, fetchImpl,
    })).rejects.toThrow('ENVIRONMENT_WORKER_SOURCE_NOT_ON_MAIN')
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
