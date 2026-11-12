import { spawn } from 'node:child_process'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'

const SOURCE_SHA = /^[a-f0-9]{40}$/
const origin = 'http://127.0.0.1:8787'
const repositoryRoot = process.cwd()
const wrangler = path.join(repositoryRoot, 'apps/environment-worker/node_modules/wrangler/bin/wrangler.js')
const config = path.join(repositoryRoot, '.artifacts/environment-worker/preview/wrangler.json')
const credentialName = /(CLOUDFLARE|CF_|WRANGLER|SUPABASE|BUNNY|AWS_|GITHUB_|SERVICE_ROLE|AUTH_ADMIN|DATABASE|DIRECT_URL|PRIVATE_KEY|CREDENTIAL|PASSWORD|SECRET|TOKEN|ACCESS_KEY)/i

function run(command, args, environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: repositoryRoot, env: environment, stdio: 'inherit' })
    child.once('error', reject)
    child.once('close', (code, signal) => code === 0
      ? resolve()
      : reject(new Error(`LOCAL_PREVIEW_COMMAND_FAILED:${code ?? signal ?? 'unknown'}`)))
  })
}

async function main() {
  const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot, encoding: 'utf8' }).trim()
  if (!SOURCE_SHA.test(sourceSha)) throw new Error('LOCAL_PREVIEW_SOURCE_SHA_INVALID')

  const safeEnvironment = { ...process.env }
  for (const name of Object.keys(safeEnvironment)) {
    if (credentialName.test(name)) delete safeEnvironment[name]
  }
  delete safeEnvironment.NEXT_PUBLIC_SUPABASE_URL
  delete safeEnvironment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  delete safeEnvironment.PUBLIC_CATALOGUE_CHECKPOINT
  delete safeEnvironment.PUBLIC_CATALOGUE_SNAPSHOT
  delete safeEnvironment.PUBLIC_CATALOGUE_TEST_FIXTURES

  const buildEnvironment = {
    ...safeEnvironment,
    APP_ENV: 'preview',
    APP_WORKER_NAME: 'dpg-local-preview',
    APP_ORIGIN: origin,
    PREVIEW_NOINDEX: 'true',
    BUILD_SOURCE_SHA: sourceSha,
  }
  process.stdout.write(`Local Preview source ${sourceSha}; building read-only Production catalogue runtime.\n`)
  await run('npm', ['run', 'build:environment-worker'], buildEnvironment)
  process.stdout.write(`Local Preview is starting at ${origin}\nPress Ctrl+C to stop.\n`)
  await run(process.execPath, [wrangler, 'dev', '--local', '--config', config, '--ip', '127.0.0.1', '--port', '8787'], {
    ...safeEnvironment,
    WRANGLER_SEND_METRICS: 'false',
  })
}

main().catch((error) => {
  process.stderr.write(`LOCAL_PREVIEW_FAILED:${error instanceof Error ? error.message : 'UNKNOWN'}\n`)
  process.exitCode = 1
})
