import { appendFile } from 'node:fs/promises'

const REPOSITORY = 'tranhuunguyenhuy-hue/dongphugia.com.vn'
const ACCOUNT_ID = 'd54f3402b9d112ab64d6135e0e3f1fb1'
const SOURCE_SHA = /^[a-f0-9]{40}$/
const ARTIFACT_SHA256 = /^[a-f0-9]{64}$/
const TOKEN_ID = /^[a-f0-9]{32}$/

function fail(code) {
  throw new Error(code)
}

export function renderEnvironmentWorkerReviewSummary({
  serverUrl,
  repository,
  runId,
  sourceSha,
  artifactSha256,
  deploymentTokenId,
}) {
  if (serverUrl !== 'https://github.com' || repository !== REPOSITORY) {
    fail('ENVIRONMENT_WORKER_REVIEW_SUMMARY_REPOSITORY_INVALID')
  }
  if (!/^\d+$/.test(runId || '')) fail('ENVIRONMENT_WORKER_REVIEW_SUMMARY_RUN_ID_INVALID')
  if (!SOURCE_SHA.test(sourceSha || '')) fail('ENVIRONMENT_WORKER_REVIEW_SUMMARY_SOURCE_SHA_INVALID')
  if (!ARTIFACT_SHA256.test(artifactSha256 || '')) {
    fail('ENVIRONMENT_WORKER_REVIEW_SUMMARY_ARTIFACT_SHA256_INVALID')
  }
  if (!TOKEN_ID.test(deploymentTokenId || '')) {
    fail('ENVIRONMENT_WORKER_REVIEW_SUMMARY_TOKEN_ID_INVALID')
  }

  return [
    '### Staging release candidate — external token review required',
    `- Workflow run: ${serverUrl}/${repository}/actions/runs/${runId}`,
    `- Source SHA: ${sourceSha}`,
    `- Candidate artifact content SHA-256: ${artifactSha256}`,
    `- Deployment token ID to inspect: ${deploymentTokenId}`,
    `- Target: account ${ACCOUNT_ID}, Worker dpg-staging.`,
    '- Before approving cloudflare-staging, inspect this exact token in the existing Cloudflare connection. Confirm it is active, has only the Workers Editor role scoped to the existing dpg-staging Worker (Individual Workers scope), and has no other or broader write grant.',
    '- This is an external human review. CI does not retrieve or machine-verify token policy; the later /tokens/verify check proves token identity/status only.',
    '- Inspect immediately before approving this run. Repeat for every release; any policy change or revocation invalidates earlier review.',
  ].join('\n')
}

async function main() {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY
  if (!summaryPath) fail('ENVIRONMENT_WORKER_REVIEW_SUMMARY_PATH_REQUIRED')

  const summary = renderEnvironmentWorkerReviewSummary({
    serverUrl: process.env.RELEASE_SERVER_URL,
    repository: process.env.RELEASE_REPOSITORY,
    runId: process.env.RELEASE_RUN_ID,
    sourceSha: process.env.RELEASE_SOURCE_SHA,
    artifactSha256: process.env.RELEASE_ARTIFACT_SHA256,
    deploymentTokenId: process.env.RELEASE_DEPLOYMENT_TOKEN_ID,
  })
  await appendFile(summaryPath, `${summary}\n`, 'utf8')
  process.stdout.write('ENVIRONMENT_WORKER_REVIEW_SUMMARY_RECORDED\n')
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    process.stderr.write(`ENVIRONMENT_WORKER_REVIEW_SUMMARY_FAILED:${error instanceof Error ? error.message : 'UNKNOWN'}\n`)
    process.exitCode = 1
  })
}
