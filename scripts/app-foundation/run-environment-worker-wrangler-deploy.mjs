import { createHash } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ACCOUNT_ID = 'd54f3402b9d112ab64d6135e0e3f1fb1'
const WORKER_NAME = 'dpg-staging'
const WORKER_ORIGIN = 'https://dpg-staging.tranhuunguyenhuy.workers.dev'
export const API_ORIGIN_ACKNOWLEDGEMENT = 'dpg-staging-script-api-origin-v1'
const API_ORIGIN_ACK = API_ORIGIN_ACKNOWLEDGEMENT
const API_ORIGIN_WARNING = 'You are about to upload a Worker that was last updated via the script API.'
const API_ORIGIN_EXPLANATION = 'Edits that have been made via the script API will be overridden by your local code and config.'
const CONFIRMATION_PROMPTS = ['Would you like to continue?', 'Do you want to continue?']
const SHA = /^[a-f0-9]{40}$/
const SHA256 = /^[a-f0-9]{64}$/

function fail(code) {
  throw new Error(code)
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function stripAnsi(value) {
  return value
    .replace(/\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g, '')
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\u001b[P^_X][\s\S]*?\u001b\\/g, '')
    .replace(/\u001b[ -/]*[@-~]/g, '')
    .replace(/\u001b\][^\u0007]*$/g, '')
}

function isKnownApiOriginWarning(outputBeforePrompt) {
  const lines = stripAnsi(outputBeforePrompt)
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  while (lines.length && /^(?:\?|›|❯)$/.test(lines.at(-1))) lines.pop()
  if (lines.length < 2) return false

  const lastTwo = lines.slice(-2)
  const warning = lastTwo[0].replace(/^(?:▲\s*)?\[(?:WARNING|WARN)\]\s*/i, '')
  return warning === API_ORIGIN_WARNING && lastTwo[1] === API_ORIGIN_EXPLANATION
}

export function nextWranglerConfirmation(output, cursor = 0) {
  const cleanOutput = stripAnsi(output).replace(/\r/g, '\n')
  const matches = []
  for (const prompt of CONFIRMATION_PROMPTS) {
    const index = cleanOutput.indexOf(prompt, cursor)
    if (index >= 0) matches.push({
      index: index + prompt.length,
      prompt,
      recognizedApiOrigin: prompt === CONFIRMATION_PROMPTS[0]
        && isKnownApiOriginWarning(cleanOutput.slice(cursor, index)),
      nextCursor: index + prompt.length,
      priority: 0,
    })
  }
  let lineStart = cursor
  while (lineStart < cleanOutput.length) {
    const lineEnd = cleanOutput.indexOf('\n', lineStart)
    const end = lineEnd < 0 ? cleanOutput.length : lineEnd
    const line = cleanOutput.slice(lineStart, end)
    const hasYesNoChoices = /(?:\([Yy]\/[Nn]\)|\[[Yy]\/[Nn]\])/.test(line)
    const questionIndex = line.lastIndexOf('?')
    if (hasYesNoChoices && questionIndex >= 0) matches.push({
      index: lineStart + questionIndex + 1,
      prompt: line.slice(questionIndex + 1).trim(),
      recognizedApiOrigin: false,
      nextCursor: end,
      priority: 1,
    })
    if (lineEnd < 0) break
    lineStart = lineEnd + 1
  }
  if (!matches.length) return null
  matches.sort((left, right) => left.index - right.index || left.priority - right.priority)
  const match = matches[0]
  return {
    index: match.index,
    prompt: match.prompt,
    recognizedApiOrigin: match.recognizedApiOrigin,
    nextCursor: match.nextCursor,
  }
}

function quoteShellArgument(argument) {
  return `'${String(argument).replaceAll("'", "'\"'\"'")}'`
}

function publicationArguments({ environment, sourceSha, artifactRoot, accountId, cloudflareAccountId, acknowledgement }) {
  if (environment !== 'staging') fail('ENVIRONMENT_WORKER_WRANGLER_ENVIRONMENT_INVALID')
  if (!SHA.test(sourceSha || '')) fail('ENVIRONMENT_WORKER_WRANGLER_SOURCE_SHA_INVALID')
  if (accountId !== ACCOUNT_ID || cloudflareAccountId !== ACCOUNT_ID) {
    fail('ENVIRONMENT_WORKER_WRANGLER_ACCOUNT_MISMATCH')
  }
  if (!['none', API_ORIGIN_ACK].includes(acknowledgement)) {
    fail('ENVIRONMENT_WORKER_WRANGLER_API_ORIGIN_ACK_INVALID')
  }

  const root = path.resolve(artifactRoot)
  const configPath = path.join(root, 'wrangler.json')
  const wranglerPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../apps/environment-worker/node_modules/wrangler/bin/wrangler.js')
  const message = `DPG ${environment} source ${sourceSha}`
  return { root, configPath, wranglerPath, message }
}

export async function verifyPreparedStagingPublication({ artifactRoot, environment, sourceSha, accountId, cloudflareAccountId, acknowledgement }) {
  const paths = publicationArguments({ artifactRoot, environment, sourceSha, accountId, cloudflareAccountId, acknowledgement })
  const [manifestBytes, configBytes] = await Promise.all([
    readFile(path.join(paths.root, 'publication-manifest.json')),
    readFile(paths.configPath),
  ])
  let manifest
  let config
  try {
    manifest = JSON.parse(manifestBytes.toString('utf8'))
    config = JSON.parse(configBytes.toString('utf8'))
  } catch {
    fail('ENVIRONMENT_WORKER_WRANGLER_PUBLICATION_JSON_INVALID')
  }

  if (manifest.contract !== 'dpg:combined-environment-worker:publication:v1'
    || manifest.sourceSha !== sourceSha || manifest.environment !== environment
    || manifest.workerName !== WORKER_NAME || manifest.origin !== WORKER_ORIGIN
    || manifest.accountId !== ACCOUNT_ID
    || !SHA256.test(manifest.deploymentConfigSha256 || '')
    || sha256(configBytes) !== manifest.deploymentConfigSha256
    || config.name !== WORKER_NAME || config.main !== 'worker.mjs'
    || config.workers_dev !== true || config.preview_urls !== false
    || Object.hasOwn(config, 'routes') || Object.hasOwn(config, 'custom_domains')
    || Object.hasOwn(config, 'd1_databases') || Object.hasOwn(config, 'kv_namespaces')
    || Object.hasOwn(config, 'r2_buckets') || Object.hasOwn(config, 'services')
    || Object.hasOwn(config, 'durable_objects') || Object.hasOwn(config, 'queues')) {
    fail('ENVIRONMENT_WORKER_WRANGLER_PUBLICATION_IDENTITY_INVALID')
  }

  return paths
}

function getScriptCommand({ wranglerPath, configPath, message }) {
  const args = [
    process.execPath,
    wranglerPath,
    'deploy',
    '--strict',
    '--config',
    configPath,
    '--message',
    message,
  ]
  const command = args.map(quoteShellArgument).join(' ')
  return `env -u CI -u GITHUB_ACTIONS ${command}`
}

function requireUtilLinuxScript(scriptCommand = 'script', spawnSyncImpl = spawnSync, platform = process.platform) {
  if (platform !== 'linux') fail('ENVIRONMENT_WORKER_WRANGLER_INTERACTIVE_PUBLISH_REQUIRES_LINUX')
  const result = spawnSyncImpl(scriptCommand, ['--version'], { encoding: 'utf8', timeout: 5000 })
  const version = `${result.stdout || ''}${result.stderr || ''}`
  if (result.status !== 0 || !/script from util-linux/i.test(version)) {
    fail('ENVIRONMENT_WORKER_WRANGLER_UTIL_LINUX_SCRIPT_REQUIRED')
  }
}

export async function runEnvironmentWorkerWranglerDeploy({
  environment,
  sourceSha,
  artifactRoot,
  accountId,
  acknowledgement,
  scriptCommand = 'script',
  spawnImpl = spawn,
  spawnSyncImpl = spawnSync,
  env = process.env,
  cloudflareAccountId = env.CLOUDFLARE_ACCOUNT_ID,
  platform = process.platform,
  wranglerPath: wranglerPathOverride,
  stdout = process.stdout,
  stderr = process.stderr,
  confirmationTimeoutMs = 5 * 60 * 1000,
}) {
  const paths = await verifyPreparedStagingPublication({
    artifactRoot,
    environment,
    sourceSha,
    accountId,
    cloudflareAccountId,
    acknowledgement,
  })
  const wranglerPath = wranglerPathOverride || paths.wranglerPath
  const wranglerArguments = [
    wranglerPath,
    'deploy',
    '--strict',
    '--config',
    paths.configPath,
    '--message',
    paths.message,
  ]

  if (acknowledgement === 'none') {
    const direct = spawnImpl(process.execPath, wranglerArguments, {
      cwd: paths.root,
      env,
      stdio: ['inherit', 'pipe', 'pipe'],
    })
    return await new Promise((resolve, reject) => {
      const secret = env.CLOUDFLARE_API_TOKEN
      const safeStdout = createSafeOutputWriter(stdout, secret)
      const safeStderr = createSafeOutputWriter(stderr, secret)
      direct.stdout.on('data', (chunk) => safeStdout.write(chunk))
      direct.stderr.on('data', (chunk) => safeStderr.write(chunk))
      direct.once('error', reject)
      direct.once('close', (code, signal) => {
        safeStdout.end()
        safeStderr.end()
        resolve({ exitCode: code ?? 1, signal, apiOriginAcknowledged: false, declinedOtherPrompt: false })
      })
    })
  }

  requireUtilLinuxScript(scriptCommand, spawnSyncImpl, platform)
  const childEnv = { ...env }
  delete childEnv.CI
  delete childEnv.GITHUB_ACTIONS
  childEnv.NO_COLOR = '1'
  childEnv.FORCE_COLOR = '0'
  const command = getScriptCommand({ ...paths, wranglerPath })
  const terminal = spawnImpl(scriptCommand, [
    '--quiet', '--return', '--flush', '--command', command, '/dev/null',
  ], {
    cwd: paths.root,
    env: childEnv,
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  return await new Promise((resolve, reject) => {
    let rawOutput = ''
    let cursor = 0
    let apiOriginAcknowledged = false
    let declinedOtherPrompt = false
    let timeout
    let escalationTimeout
    let timedOut = false
    const secret = childEnv.CLOUDFLARE_API_TOKEN
    const safeStdout = createSafeOutputWriter(stdout, secret)
    const safeStderr = createSafeOutputWriter(stderr, secret)

    const refreshTimeout = () => {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        timedOut = true
        terminal.kill('SIGTERM')
        escalationTimeout = setTimeout(() => terminal.kill('SIGKILL'), 4000)
      }, confirmationTimeoutMs)
    }

    const inspectOutput = (chunk) => {
      rawOutput += chunk.toString('utf8')
      const cleanOutput = stripAnsi(rawOutput).replace(/\r/g, '\n')
      let prompt
      while ((prompt = nextWranglerConfirmation(cleanOutput, cursor))) {
        const shouldAcknowledge = acknowledgement === API_ORIGIN_ACK
          && !apiOriginAcknowledged
          && !declinedOtherPrompt
          && prompt.recognizedApiOrigin
        if (shouldAcknowledge) {
          apiOriginAcknowledged = true
          terminal.stdin.write('y\n')
        } else {
          declinedOtherPrompt = true
          terminal.stdin.write('n\n')
        }
        cursor = prompt.nextCursor
      }
    }

    refreshTimeout()
    terminal.stdout.on('data', (chunk) => {
      refreshTimeout()
      safeStdout.write(chunk)
      inspectOutput(chunk)
    })
    terminal.stderr.on('data', (chunk) => {
      refreshTimeout()
      safeStderr.write(chunk)
      inspectOutput(chunk)
    })
    terminal.once('error', (error) => {
      clearTimeout(timeout)
      clearTimeout(escalationTimeout)
      safeStdout.end()
      safeStderr.end()
      reject(error)
    })
    terminal.once('close', (code, signal) => {
      clearTimeout(timeout)
      clearTimeout(escalationTimeout)
      safeStdout.end()
      safeStderr.end()
      if (timedOut) {
        reject(new Error('ENVIRONMENT_WORKER_WRANGLER_CONFIRMATION_TIMEOUT'))
        return
      }
      resolve({
        exitCode: declinedOtherPrompt ? 1 : code ?? 1,
        signal,
        apiOriginAcknowledged,
        declinedOtherPrompt,
      })
    })
  })
}

function createSafeOutputWriter(target, secret) {
  let pending = ''
  const flush = (all = false) => {
    const boundary = all ? pending.length : pending.lastIndexOf('\n') + 1
    if (boundary <= 0) return
    let output = stripAnsi(pending.slice(0, boundary))
      .replace(/\r\n?/g, '\n')
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    if (secret) output = output.replaceAll(secret, '[REDACTED]')
    pending = pending.slice(boundary)
    target.write(output)
  }
  return {
    write(chunk) {
      pending += chunk.toString('utf8')
      flush()
    },
    end() {
      flush(true)
    },
  }
}

async function main() {
  const [environment, sourceSha, artifactRoot, acknowledgement, accountId] = process.argv.slice(2)
  if (!environment || !sourceSha || !artifactRoot || !acknowledgement || !accountId) {
    fail('USAGE: run-environment-worker-wrangler-deploy <environment> <source-sha> <artifact-root> <api-origin-ack> <account-id>')
  }
  const result = await runEnvironmentWorkerWranglerDeploy({
    environment,
    sourceSha,
    artifactRoot,
    accountId,
    acknowledgement,
  })
  if (result.declinedOtherPrompt) fail('ENVIRONMENT_WORKER_WRANGLER_UNEXPECTED_CONFIRMATION_DECLINED')
  if (result.exitCode !== 0) process.exitCode = result.exitCode
  else process.stdout.write('ENVIRONMENT_WORKER_WRANGLER_DEPLOY_COMMAND_SUCCEEDED\n')
}

if (process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) {
  main().catch((error) => {
    process.stderr.write(`ENVIRONMENT_WORKER_WRANGLER_DEPLOY_FAILED:${error instanceof Error ? error.message : 'UNKNOWN'}\n`)
    process.exitCode = 1
  })
}
