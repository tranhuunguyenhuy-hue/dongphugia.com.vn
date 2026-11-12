const ACCOUNT_ID = 'd54f3402b9d112ab64d6135e0e3f1fb1'
const TARGETS = {
  staging: 'dpg-staging',
}
export const REQUIRED_POLICY_SCOPE_ATTESTATION = 'individual-worker:dpg-staging:editor'

function fail(code) {
  throw new Error(code)
}

export async function verifyEnvironmentWorkerTokenScope({
  environment,
  accountId,
  apiToken,
  policyScopeAttestation,
  fetchImpl = fetch,
}) {
  const workerName = TARGETS[environment]
  if (!workerName) fail('ENVIRONMENT_WORKER_TOKEN_ENVIRONMENT_INVALID')
  if (accountId !== ACCOUNT_ID) fail('ENVIRONMENT_WORKER_TOKEN_ACCOUNT_MISMATCH')
  if (!apiToken) fail('ENVIRONMENT_WORKER_TOKEN_REQUIRED')
  if (policyScopeAttestation !== REQUIRED_POLICY_SCOPE_ATTESTATION) {
    fail('ENVIRONMENT_WORKER_TOKEN_POLICY_SCOPE_EVIDENCE_REQUIRED')
  }

  const targetResponse = await fetchImpl(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${workerName}/settings`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiToken}`, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    },
  )
  if (!targetResponse.ok) fail('ENVIRONMENT_WORKER_TOKEN_SELECTED_WORKER_ACCESS_REQUIRED')

  return {
    status: 'ENVIRONMENT_WORKER_ACCESS_AND_OPERATOR_ATTESTATION_PASS',
    environment,
    workerName,
    accountId: ACCOUNT_ID,
    selectedWorkerReadable: true,
    policyScopeAttestation: {
      value: policyScopeAttestation,
      apiVerified: false,
    },
    productionWriteAuthority: 'unknown-not-tested',
  }
}

async function main() {
  const [environment, policyScopeAttestation] = process.argv.slice(2)
  const result = await verifyEnvironmentWorkerTokenScope({
    environment,
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
    policyScopeAttestation,
  })
  process.stdout.write(`${JSON.stringify(result)}\n`)
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    process.stderr.write(`ENVIRONMENT_WORKER_TOKEN_SCOPE_FAILED:${error instanceof Error ? error.message : 'UNKNOWN'}\n`)
    process.exitCode = 1
  })
}
