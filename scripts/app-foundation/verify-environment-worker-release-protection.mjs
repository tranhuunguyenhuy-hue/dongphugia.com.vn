const REPOSITORY = 'tranhuunguyenhuy-hue/dongphugia.com.vn'
const ENVIRONMENT = 'cloudflare-staging'
const REQUIRED_REVIEWER = 'tranhuunguyenhuy-hue'
const API_VERSION = '2026-03-10'

function fail(code) {
  throw new Error(code)
}

export function validateEnvironmentWorkerReleaseProtection({ environment, branchPolicies }) {
  if (environment?.name !== ENVIRONMENT) fail('ENVIRONMENT_WORKER_GITHUB_ENVIRONMENT_INVALID')
  if (environment.can_admins_bypass !== false) fail('ENVIRONMENT_WORKER_GITHUB_ADMIN_BYPASS_ENABLED')
  if (environment.deployment_branch_policy?.protected_branches !== false
    || environment.deployment_branch_policy?.custom_branch_policies !== true) {
    fail('ENVIRONMENT_WORKER_GITHUB_BRANCH_POLICY_INVALID')
  }

  const requiredReviewRules = (environment.protection_rules ?? [])
    .filter((rule) => rule.type === 'required_reviewers')
  if (requiredReviewRules.length !== 1) fail('ENVIRONMENT_WORKER_GITHUB_REVIEWER_GATE_MISSING')
  const reviewerRule = requiredReviewRules[0]
  const reviewers = reviewerRule.reviewers ?? []
  if (reviewerRule.prevent_self_review !== false || reviewers.length !== 1
    || reviewers[0]?.type !== 'User'
    || reviewers[0]?.reviewer?.login !== REQUIRED_REVIEWER) {
    fail('ENVIRONMENT_WORKER_GITHUB_REVIEWER_IDENTITY_INVALID')
  }

  const policies = branchPolicies?.branch_policies
  if (!Array.isArray(policies) || policies.length !== 1
    || policies[0]?.type !== 'branch' || policies[0]?.name !== 'main') {
    fail('ENVIRONMENT_WORKER_GITHUB_BRANCH_POLICY_INVALID')
  }

  return {
    repository: REPOSITORY,
    environment: ENVIRONMENT,
    requiredReviewer: REQUIRED_REVIEWER,
    branch: 'main',
    adminsCanBypass: false,
    protectionVerified: true,
  }
}

async function getJson(fetchImpl, url, token) {
  let response
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': API_VERSION,
      },
    })
  } catch {
    fail('ENVIRONMENT_WORKER_GITHUB_PROTECTION_REQUEST_FAILED')
  }
  if (!response.ok) fail('ENVIRONMENT_WORKER_GITHUB_PROTECTION_REQUEST_FAILED')
  try {
    return await response.json()
  } catch {
    fail('ENVIRONMENT_WORKER_GITHUB_PROTECTION_RESPONSE_INVALID')
  }
}

export async function verifyEnvironmentWorkerReleaseProtection({
  repository,
  token,
  fetchImpl = fetch,
}) {
  if (repository !== REPOSITORY) fail('ENVIRONMENT_WORKER_GITHUB_REPOSITORY_INVALID')
  if (typeof token !== 'string' || token.length === 0) {
    fail('ENVIRONMENT_WORKER_GITHUB_TOKEN_MISSING')
  }

  const base = `https://api.github.com/repos/${REPOSITORY}/environments/${ENVIRONMENT}`
  const [environment, branchPolicies] = await Promise.all([
    getJson(fetchImpl, base, token),
    getJson(fetchImpl, `${base}/deployment-branch-policies`, token),
  ])
  return validateEnvironmentWorkerReleaseProtection({ environment, branchPolicies })
}

async function main() {
  const result = await verifyEnvironmentWorkerReleaseProtection({
    repository: process.env.GITHUB_REPOSITORY,
    token: process.env.GITHUB_TOKEN,
  })
  process.stdout.write(`${JSON.stringify(result)}\n`)
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    process.stderr.write(`ENVIRONMENT_WORKER_GITHUB_PROTECTION_FAILED:${error instanceof Error ? error.message : 'UNKNOWN'}\n`)
    process.exitCode = 1
  })
}
