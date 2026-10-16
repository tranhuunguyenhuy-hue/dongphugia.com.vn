import { spawnSync } from 'node:child_process'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { validateExactPrCandidate } from './exact-pr-preflight.mjs'

const repository = 'tranhuunguyenhuy-hue/dongphugia.com.vn'
const candidateSha = 'a'.repeat(40)
const mergeSha = 'd'.repeat(40)

const validInput = (overrides = {}) => ({
  repository,
  requestedPrNumber: '127',
  candidateSha,
  candidateReachable: true,
  pr: {
    repositoryFullName: repository,
    baseRepositoryFullName: repository,
    number: 127,
    baseRef: 'main',
    headRepositoryFullName: repository,
    headSha: candidateSha,
    state: 'open',
  },
  ...overrides,
})

describe('LEO-552 exact PR preflight', () => {
  it('accepts an exact open PR head targeting main', () => {
    expect(validateExactPrCandidate(validInput())).toMatchObject({
      accepted: true,
      mode: 'exact-pr-head',
      prNumber: 127,
      candidateSha,
    })
  })

  it('accepts an exact merged PR head only when its merge commit is on trusted main', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'leo552-merged-pr-'))
    const prJsonPath = join(directory, 'pull.json')
    await writeFile(prJsonPath, JSON.stringify({
      number: 156,
      state: 'closed',
      merged: true,
      merge_commit_sha: mergeSha,
      base: { ref: 'main', repo: { full_name: repository } },
      head: { sha: candidateSha, repo: { full_name: repository } },
    }))

    const result = spawnSync(process.execPath, [
      join(process.cwd(), 'scripts/backup/exact-pr-preflight.mjs'),
      'validate',
      prJsonPath,
      repository,
      '156',
      candidateSha,
      'true',
      'true',
    ], { encoding: 'utf8' })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('LEO552_PREFLIGHT status=PASS mode=exact-merged-pr-head')
    expect(result.stderr).toBe('')
  })

  it('rejects a stale SHA', () => {
    expect(validateExactPrCandidate(validInput({ candidateSha: 'b'.repeat(40) }))).toEqual({
      accepted: false,
      reason: 'candidate_sha_is_not_current_pr_head',
    })
  })

  it('rejects a closed PR', () => {
    expect(validateExactPrCandidate(validInput({ pr: { ...validInput().pr, state: 'closed' } }))).toEqual({
      accepted: false,
      reason: 'pull_request_not_open',
    })
  })

  it('rejects a merged PR without an exact merge commit on trusted main', () => {
    const mergedPr = {
      ...validInput().pr,
      state: 'closed',
      merged: true,
      mergeCommitSha: mergeSha,
    }
    expect(validateExactPrCandidate(validInput({
      pr: { ...mergedPr, mergeCommitSha: '' },
      mergeCommitReachable: true,
    }))).toEqual({
      accepted: false,
      reason: 'missing_or_invalid_merge_sha',
    })
    expect(validateExactPrCandidate(validInput({
      pr: mergedPr,
      mergeCommitReachable: false,
    }))).toEqual({
      accepted: false,
      reason: 'merge_commit_not_reachable_from_main',
    })
  })

  it('rejects a PR whose base is not main', () => {
    expect(validateExactPrCandidate(validInput({ pr: { ...validInput().pr, baseRef: 'release' } }))).toEqual({
      accepted: false,
      reason: 'base_branch_mismatch',
    })
  })

  it('rejects a mismatched PR number and candidate SHA', () => {
    expect(validateExactPrCandidate(validInput({ requestedPrNumber: '128' }))).toEqual({
      accepted: false,
      reason: 'pull_request_number_mismatch',
    })
    expect(validateExactPrCandidate(validInput({ pr: { ...validInput().pr, headSha: 'c'.repeat(40) } }))).toEqual({
      accepted: false,
      reason: 'candidate_sha_is_not_current_pr_head',
    })
  })

  it('rejects a foreign or fork candidate', () => {
    expect(validateExactPrCandidate(validInput({
      pr: { ...validInput().pr, headRepositoryFullName: 'someone/fork' },
    }))).toEqual({
      accepted: false,
      reason: 'untrusted_candidate_repository',
    })
  })

  it('rejects a repository mismatch', () => {
    expect(validateExactPrCandidate(validInput({
      pr: { ...validInput().pr, baseRepositoryFullName: 'someone/other-repo' },
    }))).toEqual({
      accepted: false,
      reason: 'repository_mismatch',
    })
  })

  it('rejects missing input and unreachable candidate commits', () => {
    expect(validateExactPrCandidate(validInput({ requestedPrNumber: '' }))).toEqual({
      accepted: false,
      reason: 'missing_or_invalid_pr_number',
    })
    expect(validateExactPrCandidate(validInput({ candidateSha: '' }))).toEqual({
      accepted: false,
      reason: 'missing_or_invalid_candidate_sha',
    })
    expect(validateExactPrCandidate(validInput({ candidateReachable: false }))).toEqual({
      accepted: false,
      reason: 'candidate_commit_not_reachable_from_pr_head',
    })
  })
})
