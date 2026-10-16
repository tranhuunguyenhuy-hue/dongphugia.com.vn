const SHA_PATTERN = /^[0-9a-f]{40}$/
const PR_NUMBER_PATTERN = /^[1-9][0-9]*$/

function fail(reason) {
  return { accepted: false, reason }
}

export function validateExactPrCandidate(input) {
  const repository = input?.repository
  const requestedPrNumber = String(input?.requestedPrNumber ?? '')
  const candidateSha = String(input?.candidateSha ?? '')
  const pr = input?.pr

  if (!PR_NUMBER_PATTERN.test(requestedPrNumber)) return fail('missing_or_invalid_pr_number')
  if (!SHA_PATTERN.test(candidateSha)) return fail('missing_or_invalid_candidate_sha')
  if (!pr || typeof pr !== 'object') return fail('pull_request_not_found')
  if (pr.repositoryFullName !== repository
    || pr.baseRepositoryFullName !== repository) return fail('repository_mismatch')
  if (String(pr.number) !== requestedPrNumber) return fail('pull_request_number_mismatch')
  const isOpen = pr.state === 'open'
  const isMerged = pr.state === 'closed' && pr.merged === true
  if (!isOpen && !isMerged) return fail('pull_request_not_open')
  if (pr.baseRef !== 'main') return fail('base_branch_mismatch')
  if (pr.headRepositoryFullName !== repository) return fail('untrusted_candidate_repository')
  if (pr.headSha !== candidateSha) return fail('candidate_sha_is_not_current_pr_head')
  if (input.candidateReachable !== true) return fail('candidate_commit_not_reachable_from_pr_head')
  if (isMerged && !SHA_PATTERN.test(pr.mergeCommitSha)) return fail('missing_or_invalid_merge_sha')
  if (isMerged && input.mergeCommitReachable !== true) return fail('merge_commit_not_reachable_from_main')

  return {
    accepted: true,
    mode: isMerged ? 'exact-merged-pr-head' : 'exact-pr-head',
    prNumber: Number(requestedPrNumber),
    candidateSha,
    ...(isMerged ? { mergeSha: pr.mergeCommitSha } : {}),
  }
}

async function main() {
  const [mode, prJsonPath, repository, requestedPrNumber, candidateSha, candidateReachable, mergeCommitReachable] = process.argv.slice(2)
  if (mode !== 'validate' || !prJsonPath || !repository || !requestedPrNumber || !candidateSha) {
    throw new Error('usage: node exact-pr-preflight.mjs validate <pr-json> <repository> <pr-number> <candidate-sha> <candidate-reachable> [merge-commit-reachable]')
  }

  const { readFile } = await import('node:fs/promises')
  const raw = JSON.parse(await readFile(prJsonPath, 'utf8'))
  const result = validateExactPrCandidate({
    repository,
    requestedPrNumber,
    candidateSha,
    candidateReachable: candidateReachable === 'true',
    mergeCommitReachable: mergeCommitReachable === 'true',
    pr: {
      repositoryFullName: raw.base?.repo?.full_name,
      baseRepositoryFullName: raw.base?.repo?.full_name,
      number: raw.number,
      baseRef: raw.base?.ref,
      headRepositoryFullName: raw.head?.repo?.full_name,
      headSha: raw.head?.sha,
      state: raw.state,
      merged: raw.merged,
      mergeCommitSha: raw.merge_commit_sha,
    },
  })
  if (!result.accepted) {
    process.stderr.write(`LEO552_PREFLIGHT status=FAIL reason=${result.reason}\n`)
    process.exitCode = 1
    return
  }
  process.stdout.write(`LEO552_PREFLIGHT status=PASS mode=${result.mode}\n`)
}

if (process.argv[1]?.endsWith('/exact-pr-preflight.mjs')) void main().catch(() => {
  process.stderr.write('LEO552_PREFLIGHT status=FAIL reason=invalid_pull_request_response\n')
  process.exitCode = 1
})
