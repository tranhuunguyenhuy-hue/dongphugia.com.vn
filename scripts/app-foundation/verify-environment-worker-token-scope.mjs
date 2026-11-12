const ACCOUNT_ID = 'd54f3402b9d112ab64d6135e0e3f1fb1'
const TARGETS = {
  preview: 'dpg-preview',
  staging: 'dpg-staging',
}
const PRODUCTION_WORKER = 'dongphugia-v1-public-production'

function fail(code) {
  throw new Error(code)
}

export async function verifyEnvironmentWorkerTokenScope({
  environment,
  accountId,
  apiToken,
  fetchImpl = fetch,
}) {
  const workerName = TARGETS[environment]
  if (!workerName) fail('ENVIRONMENT_WORKER_TOKEN_ENVIRONMENT_INVALID')
  if (accountId !== ACCOUNT_ID) fail('ENVIRONMENT_WORKER_TOKEN_ACCOUNT_MISMATCH')
  if (!apiToken) fail('ENVIRONMENT_WORKER_TOKEN_REQUIRED')

  async function getSettings(name) {
    return fetchImpl(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${name}/settings`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiToken}`, Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(20000),
      },
    )
  }

  const targetResponse = await getSettings(workerName)
  if (!targetResponse.ok) fail('ENVIRONMENT_WORKER_TOKEN_SELECTED_WORKER_ACCESS_REQUIRED')

  const productionResponse = await getSettings(PRODUCTION_WORKER)
  if (![403, 404].includes(productionResponse.status)) {
    fail(productionResponse.ok
      ? 'ENVIRONMENT_WORKER_TOKEN_PRODUCTION_ACCESS_FORBIDDEN'
      : 'ENVIRONMENT_WORKER_TOKEN_PRODUCTION_SCOPE_UNVERIFIED')
  }

  return {
    status: 'ENVIRONMENT_WORKER_TOKEN_SCOPE_PASS',
    environment,
    workerName,
    accountId: ACCOUNT_ID,
    selectedWorkerReadable: true,
    productionWorkerDenied: true,
    productionStatus: productionResponse.status,
  }
}

async function main() {
  const [environment] = process.argv.slice(2)
  const result = await verifyEnvironmentWorkerTokenScope({
    environment,
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
  })
  process.stdout.write(`${JSON.stringify(result)}\n`)
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    process.stderr.write(`ENVIRONMENT_WORKER_TOKEN_SCOPE_FAILED:${error instanceof Error ? error.message : 'UNKNOWN'}\n`)
    process.exitCode = 1
  })
}
