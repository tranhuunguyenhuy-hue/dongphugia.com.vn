const SOURCE_SHA = /^[a-f0-9]{40}$/

function fail(code) {
  throw new Error(code)
}

async function githubJson(fetchImpl, url, token, init = {}) {
  const response = await fetchImpl(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...init.headers,
    },
    signal: AbortSignal.timeout(20000),
  })
  if (!response.ok) fail(`ENVIRONMENT_WORKER_SOURCE_GITHUB_HTTP_${response.status}`)
  return response.json()
}

export async function validateEnvironmentWorkerSource({
  sourceKind,
  sourceSha,
  prNumber,
  repository,
  token,
  fetchImpl = fetch,
  apiUrl = 'https://api.github.com',
}) {
  if (!SOURCE_SHA.test(sourceSha || '')) fail('ENVIRONMENT_WORKER_SOURCE_SHA_INVALID')
  if (!/^[^/]+\/[^/]+$/.test(repository || '')) fail('ENVIRONMENT_WORKER_SOURCE_REPOSITORY_INVALID')
  if (!token) fail('ENVIRONMENT_WORKER_SOURCE_TOKEN_REQUIRED')

  if (sourceKind === 'main') {
    const compare = await githubJson(
      fetchImpl,
      `${apiUrl}/repos/${repository}/compare/main...${sourceSha}`,
      token,
    )
    // GitHub's compare response has no top-level head SHA. With main...source,
    // `behind` or `identical` plus a source-SHA merge base proves ancestry.
    if (!['identical', 'behind'].includes(compare.status)
      || compare.merge_base_commit?.sha !== sourceSha) {
      fail('ENVIRONMENT_WORKER_SOURCE_NOT_ON_MAIN')
    }
    return { sourceKind, sourceSha }
  }

  if (sourceKind !== 'approved-pr' || !Number.isSafeInteger(Number(prNumber)) || Number(prNumber) < 1) {
    fail('ENVIRONMENT_WORKER_SOURCE_KIND_INVALID')
  }
  const pullRequest = await githubJson(
    fetchImpl,
    `${apiUrl}/repos/${repository}/pulls/${Number(prNumber)}`,
    token,
  )
  if (pullRequest.state !== 'open' || pullRequest.draft !== false
    || pullRequest.base?.ref !== 'main'
    || pullRequest.head?.sha !== sourceSha
    || pullRequest.head?.repo?.full_name !== repository) {
    fail('ENVIRONMENT_WORKER_SOURCE_PR_IDENTITY_INVALID')
  }

  const [owner, name] = repository.split('/')
  const review = await githubJson(fetchImpl, `${apiUrl}/graphql`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'query($owner:String!, $name:String!, $number:Int!) { repository(owner:$owner, name:$name) { pullRequest(number:$number) { reviewDecision } } }',
      variables: { owner, name, number: Number(prNumber) },
    }),
  })
  if (review.errors?.length || review.data?.repository?.pullRequest?.reviewDecision !== 'APPROVED') {
    fail('ENVIRONMENT_WORKER_SOURCE_PR_APPROVAL_REQUIRED')
  }
  return { sourceKind, sourceSha, prNumber: Number(prNumber), reviewDecision: 'APPROVED' }
}

async function main() {
  const [sourceKind, sourceSha, prNumber = ''] = process.argv.slice(2)
  const repository = process.env.GITHUB_REPOSITORY
  const token = process.env.GITHUB_TOKEN
  const validated = await validateEnvironmentWorkerSource({
    sourceKind,
    sourceSha,
    prNumber,
    repository,
    token,
  })
  process.stdout.write(`${JSON.stringify({ status: 'ENVIRONMENT_WORKER_SOURCE_ACCEPTED', ...validated })}\n`)
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    process.stderr.write(`ENVIRONMENT_WORKER_SOURCE_REJECTED:${error instanceof Error ? error.message : 'UNKNOWN'}\n`)
    process.exitCode = 1
  })
}
