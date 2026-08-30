import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import path from 'node:path'

function run(command: string, args: string[], cwd: string, environment: NodeJS.ProcessEnv) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: environment, stdio: 'inherit' })
    child.on('error', reject)
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`PUBLIC_WORKER_BUILD_COMMAND_FAILED:${code}`)))
  })
}

async function main() {
  const appRoot = process.cwd()
  const sourceCommit = process.env.BUILD_SOURCE_SHA?.trim()
  if (!sourceCommit || !/^[0-9a-f]{40}$/.test(sourceCommit)) throw new Error('PUBLIC_WORKER_SOURCE_SHA_REQUIRED')

  // The foundation exposes no on-demand revalidation surface. A source-derived
  // build value removes adapter randomness while the Worker rejects all related
  // external control paths/headers. A future revalidation design must replace it.
  const revalidationDisabledBuildValue = createHash('sha256')
    .update(`dongphugia:vinext-revalidation-disabled:v1:${sourceCommit}`)
    .digest('hex')
  const environment = {
    ...process.env,
    DPG_DETERMINISTIC_BUILD_SEED: createHash('sha256')
      .update(`dongphugia:public-worker-build:v1:${sourceCommit}`)
      .digest('hex'),
    __VINEXT_SHARED_REVALIDATE_SECRET: revalidationDisabledBuildValue,
  }
  const entropyPreload = path.resolve(appRoot, '../../scripts/app-foundation/deterministic-build-entropy.mjs')
  environment.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''} --import=${entropyPreload}`.trim()
  const vinextCli = path.join(appRoot, 'node_modules', 'vinext', 'dist', 'cli.js')
  await run(process.execPath, [vinextCli, 'build'], appRoot, environment)

  const canonicalizer = path.resolve(appRoot, '../../scripts/app-foundation/canonicalize-public-worker.mts')
  const tsxCli = path.join(appRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs')
  await run(process.execPath, [tsxCli, canonicalizer, '--server-dir', 'dist/server'], appRoot, environment)
}

main().catch((error) => {
  console.error(`LEO563_PUBLIC_WORKER_BUILD_FAILED: ${error.message}`)
  process.exitCode = 1
})
