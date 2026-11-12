const ACCOUNT_ID = 'd54f3402b9d112ab64d6135e0e3f1fb1'
const TARGETS = {
  staging: 'dpg-staging',
}

function fail(code) {
  throw new Error(code)
}

export async function verifyEnvironmentWorkerTokenScope({
  environment,
  accountId,
}) {
  const workerName = TARGETS[environment]
  if (!workerName) fail('ENVIRONMENT_WORKER_TOKEN_ENVIRONMENT_INVALID')
  if (accountId !== ACCOUNT_ID) fail('ENVIRONMENT_WORKER_TOKEN_ACCOUNT_MISMATCH')

  // Cloudflare's supported token-policy evidence surface has not yet been
  // integrated. A manual string or a successful Worker GET cannot prove that
  // this token lacks Production write authority, so publication stays blocked.
  fail('ENVIRONMENT_WORKER_TOKEN_SCOPE_PROOF_UNAVAILABLE')
}

async function main() {
  const [environment] = process.argv.slice(2)
  const result = await verifyEnvironmentWorkerTokenScope({
    environment,
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  })
  process.stdout.write(`${JSON.stringify(result)}\n`)
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    process.stderr.write(`ENVIRONMENT_WORKER_TOKEN_SCOPE_FAILED:${error instanceof Error ? error.message : 'UNKNOWN'}\n`)
    process.exitCode = 1
  })
}
