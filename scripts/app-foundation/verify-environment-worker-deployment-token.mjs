const ACCOUNT_ID = 'd54f3402b9d112ab64d6135e0e3f1fb1'
const TARGETS = {
  staging: 'dpg-staging',
}
const TOKEN_ID = /^[a-f0-9]{32}$/

function fail(code) {
  throw new Error(code)
}

export async function verifyEnvironmentWorkerDeploymentToken({
  environment,
  accountId,
  expectedTokenId,
  apiToken,
  fetchImpl = fetch,
}) {
  const workerName = TARGETS[environment]
  if (!workerName) fail('ENVIRONMENT_WORKER_TOKEN_ENVIRONMENT_INVALID')
  if (accountId !== ACCOUNT_ID) fail('ENVIRONMENT_WORKER_TOKEN_ACCOUNT_MISMATCH')
  if (!TOKEN_ID.test(expectedTokenId || '')) fail('ENVIRONMENT_WORKER_TOKEN_EXPECTED_ID_INVALID')
  if (typeof apiToken !== 'string' || apiToken.length === 0) {
    fail('ENVIRONMENT_WORKER_TOKEN_CREDENTIAL_MISSING')
  }

  let response
  try {
    response = await fetchImpl(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/tokens/verify`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${apiToken}`,
        },
      },
    )
  } catch {
    fail('ENVIRONMENT_WORKER_TOKEN_IDENTITY_REQUEST_FAILED')
  }
  if (!response.ok) fail('ENVIRONMENT_WORKER_TOKEN_IDENTITY_REQUEST_FAILED')

  let body
  try {
    body = await response.json()
  } catch {
    fail('ENVIRONMENT_WORKER_TOKEN_IDENTITY_RESPONSE_INVALID')
  }
  if (body?.success !== true || body?.result?.id !== expectedTokenId
    || body?.result?.status !== 'active') {
    fail('ENVIRONMENT_WORKER_TOKEN_IDENTITY_MISMATCH')
  }

  return {
    environment,
    accountId,
    workerName,
    tokenId: body.result.id,
    tokenStatus: body.result.status,
    tokenIdentityVerified: true,
    policyScopeMachineVerified: false,
    policyScopeReview: 'external-required-reviewer-approval',
  }
}

async function main() {
  const [environment, accountId, expectedTokenId] = process.argv.slice(2)
  const result = await verifyEnvironmentWorkerDeploymentToken({
    environment,
    accountId,
    expectedTokenId,
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
  })
  process.stdout.write(`${JSON.stringify(result)}\n`)
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    process.stderr.write(`ENVIRONMENT_WORKER_TOKEN_IDENTITY_FAILED:${error instanceof Error ? error.message : 'UNKNOWN'}\n`)
    process.exitCode = 1
  })
}
