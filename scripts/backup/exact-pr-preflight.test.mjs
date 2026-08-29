import { describe, expect, it } from 'vitest'

import { validateExactPrCandidate } from './exact-pr-preflight.mjs'

const repository = 'tranhuunguyenhuy-hue/dongphugia.com.vn'
const candidateSha = 'a'.repeat(40)

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
