import { createHash } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { createServer, type Server } from 'node:http'
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Readable, Writable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import {
  API_ORIGIN_ACKNOWLEDGEMENT,
  nextWranglerConfirmation,
  runEnvironmentWorkerWranglerDeploy,
  verifyPreparedStagingPublication,
} from './run-environment-worker-wrangler-deploy.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(here, '../..')
const runnerPath = path.join(here, 'run-environment-worker-wrangler-deploy.mjs')
const workerPackage = JSON.parse(await readFile(path.join(repositoryRoot, 'apps/environment-worker/package.json'), 'utf8'))
const ACCOUNT_ID = 'd54f3402b9d112ab64d6135e0e3f1fb1'
const SOURCE_SHA = 'b'.repeat(40)
const FAKE_TOKEN = 'test-token-value-that-is-not-a-cloudflare-credential'
const tempDirectories: string[] = []
const servers: Server[] = []

function digest(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex')
}

async function createPreparedArtifact() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dpg-wrangler-deploy-test-'))
  tempDirectories.push(root)
  await mkdir(path.join(root, 'assets'), { recursive: true })
  await writeFile(path.join(root, 'assets/index.html'), '<main>mock</main>\n')
  await writeFile(path.join(root, 'worker.mjs'), 'export default { fetch() { return new Response("mock") } }\n')
  const config = {
    name: 'dpg-staging',
    main: 'worker.mjs',
    compatibility_date: '2026-11-12',
    workers_dev: true,
    preview_urls: false,
    assets: { directory: 'assets', binding: 'ASSETS', not_found_handling: 'none' },
    vars: { APP_ENV: 'staging' },
  }
  const configBytes = `${JSON.stringify(config, null, 2)}\n`
  await writeFile(path.join(root, 'wrangler.json'), configBytes)
  const manifest = {
    contract: 'dpg:combined-environment-worker:publication:v1',
    sourceSha: SOURCE_SHA,
    environment: 'staging',
    workerName: 'dpg-staging',
    origin: 'https://dpg-staging.tranhuunguyenhuy.workers.dev',
    accountId: ACCOUNT_ID,
    deploymentConfigSha256: digest(configBytes),
  }
  await writeFile(path.join(root, 'publication-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  return root
}

async function createApiMock() {
  const requests: Array<{ method: string; pathname: string; authorization: string | undefined }> = []
  const server = createServer((request, response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1')
    const pathname = url.pathname.replace(/^\/client\/v4/, '')
    requests.push({ method: request.method || '', pathname, authorization: request.headers.authorization })

    if (request.method !== 'GET') {
      response.writeHead(405, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ success: false, errors: [{ code: 405, message: 'mock blocks writes' }] }))
      return
    }
    if (pathname === `/accounts/${ACCOUNT_ID}/workers/services/dpg-staging`) {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({
        success: true,
        errors: [],
        messages: [],
        result: {
          default_environment: {
            environment: 'production',
            script: { tag: 'existing-tag', tags: [], last_deployed_from: 'api' },
          },
        },
      }))
      return
    }
    if (pathname === `/accounts/${ACCOUNT_ID}/workers/scripts/dpg-staging/secrets`) {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ success: true, errors: [], messages: [], result: [{ name: 'APP_ENV' }] }))
      return
    }

    response.writeHead(404, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ success: false, errors: [{ code: 404, message: 'unexpected mock request' }] }))
  })
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Expected local mock API address')
  return { endpoint: `http://127.0.0.1:${address.port}/client/v4`, requests }
}

async function createPythonPtyScriptShim(root: string) {
  const shimPath = path.join(root, 'util-linux-script-test-shim')
  await writeFile(shimPath, `#!/usr/bin/env python3
import os
import pty
import select
import signal
import subprocess
import sys
import time

if sys.argv[1:] == ['--version']:
    print('script from util-linux 2.40 (test PTY shim)')
    raise SystemExit(0)

command_index = sys.argv.index('--command')
command = sys.argv[command_index + 1]
master, slave = pty.openpty()
child = subprocess.Popen(command, shell=True, executable='/bin/sh', stdin=slave, stdout=slave, stderr=slave,
                         env=os.environ.copy(), start_new_session=True, close_fds=True)
os.close(slave)
input_open = True
master_open = True

def terminate_child(_signum, _frame):
    try:
        os.killpg(child.pid, signal.SIGTERM)
    except ProcessLookupError:
        pass

signal.signal(signal.SIGTERM, terminate_child)
while master_open:
    readers = [master]
    if input_open:
        readers.append(sys.stdin.fileno())
    ready, _, _ = select.select(readers, [], [], 0.1)
    for descriptor in ready:
        if descriptor == master:
            try:
                output = os.read(master, 4096)
            except OSError:
                master_open = False
                break
            if output:
                os.write(sys.stdout.fileno(), output)
            elif child.poll() is not None:
                master_open = False
                break
        else:
            data = os.read(sys.stdin.fileno(), 4096)
            if data:
                os.write(master, data)
            else:
                input_open = False
    if child.poll() is not None and not ready:
        try:
            output = os.read(master, 4096)
            if output:
                os.write(sys.stdout.fileno(), output)
            else:
                master_open = False
        except OSError:
            master_open = False
os.close(master)
raise SystemExit(child.wait())
`, 'utf8')
  await chmod(shimPath, 0o755)
  return shimPath
}

function captureOutput() {
  let text = ''
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      text += chunk.toString('utf8')
      callback()
    },
  })
  return { stream, text: () => text }
}

const scriptVersion = process.platform === 'linux'
  ? spawnSync('script', ['--version'], { encoding: 'utf8', stdio: 'pipe' })
  : null
const hasUtilLinuxScript = Boolean(scriptVersion && scriptVersion.status === 0
  && /script from util-linux/i.test(`${scriptVersion.stdout || ''}${scriptVersion.stderr || ''}`))

async function runPublisherDeploy(artifactRoot: string, acknowledgement: string, apiBaseUrl: string) {
  const environment = {
    ...process.env,
    CI: 'true',
    GITHUB_ACTIONS: 'true',
    APP_ENV: 'staging',
    CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID,
    CLOUDFLARE_API_TOKEN: FAKE_TOKEN,
    CLOUDFLARE_API_BASE_URL: apiBaseUrl,
    WRANGLER_SEND_METRICS: 'false',
    NO_COLOR: '1',
  }
  return await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [
      runnerPath,
      'staging', SOURCE_SHA, artifactRoot, acknowledgement, ACCOUNT_ID,
    ], { cwd: repositoryRoot, env: environment, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    const timeout = setTimeout(() => child.kill('SIGTERM'), 90_000)
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk })
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk })
    child.once('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    child.once('close', (code) => {
      clearTimeout(timeout)
      resolve({ code, stdout, stderr })
    })
  })
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))))
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('Staging Wrangler API-managed adoption gate', () => {
  it('recognizes only the exact script API warning immediately before the exact confirmation', () => {
    const exact = [
      '▲ [WARNING] You are about to upload a Worker that was last updated via the script API.',
      'Edits that have been made via the script API will be overridden by your local code and config.',
      '? Would you like to continue?',
    ].join('\n')
    const firstPrompt = nextWranglerConfirmation(exact)
    expect(firstPrompt).toMatchObject({
      prompt: 'Would you like to continue?',
      recognizedApiOrigin: true,
    })
    expect(nextWranglerConfirmation(`${exact}\n[WARNING] remote secret conflict\n? Would you like to continue?`, firstPrompt!.nextCursor))
      .toMatchObject({ prompt: 'Would you like to continue?', recognizedApiOrigin: false })

    expect(nextWranglerConfirmation([
      '[WARNING] local config conflicts with dashboard configuration.',
      '? Would you like to continue?',
    ].join('\n'))).toMatchObject({ recognizedApiOrigin: false })
    expect(nextWranglerConfirmation([
      '[WARNING] You are about to upload a Worker that was last updated via the script API.',
      'Edits that have been made via the script API will be overridden by your local code and config.',
      '? Do you want to continue?',
    ].join('\n'))).toMatchObject({ recognizedApiOrigin: false })
    expect(nextWranglerConfirmation([
      '[WARNING] deployment settings changed',
      '? Proceed with the deployment? › (Y/n)',
    ].join('\n'))).toMatchObject({ recognizedApiOrigin: false })
  })

  it('binds the acknowledgement to the exact Staging account, Worker, source and prepared config', async () => {
    const artifactRoot = await createPreparedArtifact()
    await expect(verifyPreparedStagingPublication({
      artifactRoot,
      environment: 'staging',
      sourceSha: SOURCE_SHA,
      accountId: ACCOUNT_ID,
      cloudflareAccountId: ACCOUNT_ID,
      acknowledgement: API_ORIGIN_ACKNOWLEDGEMENT,
    })).resolves.toMatchObject({ configPath: path.join(artifactRoot, 'wrangler.json') })

    await expect(verifyPreparedStagingPublication({
      artifactRoot,
      environment: 'preview',
      sourceSha: SOURCE_SHA,
      accountId: ACCOUNT_ID,
      cloudflareAccountId: ACCOUNT_ID,
      acknowledgement: API_ORIGIN_ACKNOWLEDGEMENT,
    })).rejects.toThrow('ENVIRONMENT_WORKER_WRANGLER_ENVIRONMENT_INVALID')
    await expect(verifyPreparedStagingPublication({
      artifactRoot,
      environment: 'staging',
      sourceSha: SOURCE_SHA,
      accountId: ACCOUNT_ID,
      cloudflareAccountId: '0'.repeat(32),
      acknowledgement: API_ORIGIN_ACKNOWLEDGEMENT,
    })).rejects.toThrow('ENVIRONMENT_WORKER_WRANGLER_ACCOUNT_MISMATCH')
    await writeFile(path.join(artifactRoot, 'wrangler.json'), '{"name":"other-worker"}\n')
    await expect(verifyPreparedStagingPublication({
      artifactRoot,
      environment: 'staging',
      sourceSha: SOURCE_SHA,
      accountId: ACCOUNT_ID,
      cloudflareAccountId: ACCOUNT_ID,
      acknowledgement: API_ORIGIN_ACKNOWLEDGEMENT,
    })).rejects.toThrow('ENVIRONMENT_WORKER_WRANGLER_PUBLICATION_IDENTITY_INVALID')
  })

  it('reproduces the pinned Wrangler strict failure on API-origin metadata without any provider writes', async () => {
    expect(workerPackage.devDependencies.wrangler).toBe('4.160.1')
    const artifactRoot = await createPreparedArtifact()
    const mock = await createApiMock()
    const result = await runPublisherDeploy(artifactRoot, 'none', mock.endpoint)
    expect(result.code).not.toBe(0)
    expect(`${result.stdout}\n${result.stderr}`).toContain('Aborting the upload operation because of conflicts')
    expect(mock.requests.map(({ method, pathname }) => [method, pathname])).toEqual([[
      'GET', `/accounts/${ACCOUNT_ID}/workers/services/dpg-staging`,
    ]])
    expect(mock.requests.every(({ authorization }) => authorization === `Bearer ${FAKE_TOKEN}`)).toBe(true)
    expect(`${result.stdout}\n${result.stderr}`).not.toContain(FAKE_TOKEN)
  }, 90_000)

  it('uses a real PTY boundary to accept the exact prompt once, sanitize output, and propagate CLI exit status', async () => {
    if (process.platform === 'linux') expect(hasUtilLinuxScript).toBe(true)
    const artifactRoot = await createPreparedArtifact()
    const fakeWrangler = path.join(artifactRoot, 'fake-wrangler.mjs')
    await writeFile(fakeWrangler, [
      `const warning = 'You are about to upload a Worker that was last updated via the script API.'`,
      `const explanation = 'Edits that have been made via the script API will be overridden by your local code and config.'`,
      `process.stdin.setRawMode(true)`,
      `process.stdout.write(\`\\u001b[33m[WARNING] \${warning}\\u001b[0m\\r\\n\${explanation}\\r\\n? Would you like to continue? › (Y/n)\`)`,
      `process.stdin.once('data', (chunk) => {`,
      `  if (chunk.toString().trim() !== 'y') process.exit(41)`,
      `  process.stdout.write('✔ Would you like to ')`,
      `  setTimeout(() => {`,
      `    process.stdout.write('continue? … yes\\r\\n')`,
      `    process.stdout.write(String.fromCharCode(27, 80) + 'private-control-payload' + String.fromCharCode(27, 92) + '\\n')`,
      `    process.exit(23)`,
      `  }, 30)`,
      `})`,
    ].join('\n'), 'utf8')
    const ptyShim = process.platform === 'linux' && hasUtilLinuxScript
      ? 'script'
      : await createPythonPtyScriptShim(artifactRoot)
    const stdout = captureOutput()
    const stderr = captureOutput()
    const env = {
      ...process.env,
      CI: 'true',
      GITHUB_ACTIONS: 'true',
      CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID,
      CLOUDFLARE_API_TOKEN: FAKE_TOKEN,
      TEST_WRANGLER_MODE: 'exact',
    }
    const result = await runEnvironmentWorkerWranglerDeploy({
      environment: 'staging',
      sourceSha: SOURCE_SHA,
      artifactRoot,
      accountId: ACCOUNT_ID,
      acknowledgement: API_ORIGIN_ACKNOWLEDGEMENT,
      scriptCommand: ptyShim,
      env,
      stdout: stdout.stream,
      stderr: stderr.stream,
      platform: 'linux',
      wranglerPath: fakeWrangler,
    })
    expect(result).toMatchObject({ exitCode: 23, apiOriginAcknowledged: true, declinedOtherPrompt: false })
    expect(`${stdout.text()}${stderr.text()}`).toContain('Would you like to continue?')
    expect(`${stdout.text()}${stderr.text()}`).not.toContain(FAKE_TOKEN)
    expect(`${stdout.text()}${stderr.text()}`).not.toContain('private-control-payload')
    expect(`${stdout.text()}${stderr.text()}`).not.toMatch(/[\u001b\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/)
  }, 10_000)

  it('preserves a split UTF-8 triangle on both PTY output streams and accepts the exact prompt once', async () => {
    const artifactRoot = await createPreparedArtifact()
    const warning = Buffer.from([
      '▲ [WARNING] You are about to upload a Worker that was last updated via the script API.\n',
      'Edits that have been made via the script API will be overridden by your local code and config.\n',
      '? Would you like to continue? (y/N) ',
    ].join(''))
    const triangle = Buffer.from('▲')
    const triangleStart = warning.indexOf(triangle)
    const chunks = [
      warning.subarray(0, triangleStart + 1),
      warning.subarray(triangleStart + 1, triangleStart + 2),
      warning.subarray(triangleStart + 2, triangleStart + 3),
      warning.subarray(triangleStart + 3),
    ]
    const delayedChunks = () => Readable.from((async function* () {
      for (const chunk of chunks) {
        yield chunk
        await new Promise((resolve) => setTimeout(resolve, 2))
      }
    })())

    for (const streamName of ['stdout', 'stderr'] as const) {
      const answers: string[] = []
      const child = new EventEmitter() as EventEmitter & {
        stdout: Readable
        stderr: Readable
        stdin: Writable
        kill: () => void
      }
      child.stdout = streamName === 'stdout' ? delayedChunks() : Readable.from([])
      child.stderr = streamName === 'stderr' ? delayedChunks() : Readable.from([])
      child.stdin = new Writable({
        write(chunk, _encoding, callback) {
          answers.push(chunk.toString())
          callback()
        },
      })
      child.kill = () => {}
      let remainingStreams = 2
      const closeWhenStreamsEnd = () => {
        remainingStreams -= 1
        if (remainingStreams === 0) child.emit('close', 0, null)
      }
      child.stdout.once('end', closeWhenStreamsEnd)
      child.stderr.once('end', closeWhenStreamsEnd)

      const stdout = captureOutput()
      const stderr = captureOutput()
      const result = await runEnvironmentWorkerWranglerDeploy({
        environment: 'staging',
        sourceSha: SOURCE_SHA,
        artifactRoot,
        accountId: ACCOUNT_ID,
        acknowledgement: API_ORIGIN_ACKNOWLEDGEMENT,
        scriptCommand: 'fake-util-linux-script',
        spawnImpl: () => child,
        spawnSyncImpl: () => ({ status: 0, stdout: 'script from util-linux 2.40', stderr: '' }),
        env: { CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID, CLOUDFLARE_API_TOKEN: FAKE_TOKEN },
        stdout: stdout.stream,
        stderr: stderr.stream,
        platform: 'linux',
      })
      const output = `${stdout.text()}${stderr.text()}`
      expect(result).toMatchObject({ exitCode: 0, apiOriginAcknowledged: true, declinedOtherPrompt: false })
      expect(answers).toEqual(['y\n'])
      expect(output).toContain('▲ [WARNING] You are about to upload a Worker that was last updated via the script API.')
      expect(output).not.toContain('\ufffd')
      expect(output).not.toContain(FAKE_TOKEN)
      expect(output).not.toMatch(/[\u001b\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/)
    }
  })

  it('answers no to an additional confirmation and to a changed first prompt', async () => {
    if (process.platform === 'linux') expect(hasUtilLinuxScript).toBe(true)
    const artifactRoot = await createPreparedArtifact()
    const fakeWrangler = path.join(artifactRoot, 'fake-wrangler.mjs')
    await writeFile(fakeWrangler, [
      `const mode = process.env.TEST_WRANGLER_MODE`,
      `const warning = 'You are about to upload a Worker that was last updated via the script API.'`,
      `const explanation = 'Edits that have been made via the script API will be overridden by your local code and config.'`,
      `function readAnswer(callback) { process.stdin.once('data', (chunk) => callback(chunk.toString().trim())) }`,
      `function unexpectedPrompt() {`,
      `  const prompt = mode === 'changed-first' ? '? Proceed with deployment? (Y/n) ' : '? Would you like to continue? (Y/n) '`,
      `  process.stdout.write('[WARNING] a remote route configuration conflict\\r\\n' + prompt)`,
      `  readAnswer((answer) => { if (answer !== 'n') process.exit(42); process.stdout.write('token=' + process.env.CLOUDFLARE_API_TOKEN + '\\n'); process.exit(0) })`,
      `}`,
      `if (mode === 'changed-first') unexpectedPrompt()`,
      `else {`,
      `  process.stdout.write('[WARNING] ' + warning + '\\n' + explanation + '\\n? Would you like to continue? (y/N) ')`,
      `  readAnswer((answer) => { if (answer !== 'y') process.exit(43); unexpectedPrompt() })`,
      `}`,
    ].join('\n'), 'utf8')
    const ptyShim = process.platform === 'linux' && hasUtilLinuxScript
      ? 'script'
      : await createPythonPtyScriptShim(artifactRoot)

    for (const mode of ['extra-after-api-origin', 'changed-first']) {
      const stdout = captureOutput()
      const stderr = captureOutput()
      const result = await runEnvironmentWorkerWranglerDeploy({
        environment: 'staging',
        sourceSha: SOURCE_SHA,
        artifactRoot,
        accountId: ACCOUNT_ID,
        acknowledgement: API_ORIGIN_ACKNOWLEDGEMENT,
        scriptCommand: ptyShim,
        env: {
          ...process.env,
          CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID,
          CLOUDFLARE_API_TOKEN: FAKE_TOKEN,
          TEST_WRANGLER_MODE: mode,
        },
        stdout: stdout.stream,
        stderr: stderr.stream,
        platform: 'linux',
        wranglerPath: fakeWrangler,
      })
      const combined = `${stdout.text()}${stderr.text()}`
      expect(result.exitCode).toBe(1)
      expect(result.declinedOtherPrompt).toBe(true)
      expect(result.apiOriginAcknowledged).toBe(mode === 'extra-after-api-origin')
      expect(combined).not.toContain(FAKE_TOKEN)
      expect(combined).not.toMatch(/[\u001b\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/)
      if (mode === 'extra-after-api-origin') expect(combined).toContain('token=[REDACTED]')
    }
  }, 10_000)

  it('terminates a confirmation process that never reaches a recognized prompt', async () => {
    if (process.platform === 'linux') expect(hasUtilLinuxScript).toBe(true)
    const artifactRoot = await createPreparedArtifact()
    const fakeWrangler = path.join(artifactRoot, 'fake-wrangler.mjs')
    await writeFile(fakeWrangler, [
      `process.stdout.write('waiting without a recognized Wrangler prompt')`,
      `setInterval(() => {}, 1000)`,
    ].join('\n'), 'utf8')
    const ptyShim = process.platform === 'linux' && hasUtilLinuxScript
      ? 'script'
      : await createPythonPtyScriptShim(artifactRoot)
    const stdout = captureOutput()
    const stderr = captureOutput()
    await expect(runEnvironmentWorkerWranglerDeploy({
      environment: 'staging',
      sourceSha: SOURCE_SHA,
      artifactRoot,
      accountId: ACCOUNT_ID,
      acknowledgement: API_ORIGIN_ACKNOWLEDGEMENT,
      scriptCommand: ptyShim,
      env: {
        ...process.env,
        CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID,
        CLOUDFLARE_API_TOKEN: FAKE_TOKEN,
      },
      stdout: stdout.stream,
      stderr: stderr.stream,
      platform: 'linux',
      wranglerPath: fakeWrangler,
      confirmationTimeoutMs: 250,
    })).rejects.toThrow('ENVIRONMENT_WORKER_WRANGLER_CONFIRMATION_TIMEOUT')
  }, 10_000)

  it('accepts the real API-origin prompt and declines the next strict remote-secret conflict before upload', async () => {
    if (process.platform === 'linux') expect(hasUtilLinuxScript).toBe(true)
    expect(workerPackage.devDependencies.wrangler).toBe('4.160.1')
    const artifactRoot = await createPreparedArtifact()
    const mock = await createApiMock()
    const ptyShim = hasUtilLinuxScript ? 'script' : await createPythonPtyScriptShim(artifactRoot)
    const stdout = captureOutput()
    const stderr = captureOutput()
    const result = await runEnvironmentWorkerWranglerDeploy({
      environment: 'staging',
      sourceSha: SOURCE_SHA,
      artifactRoot,
      accountId: ACCOUNT_ID,
      acknowledgement: API_ORIGIN_ACKNOWLEDGEMENT,
      scriptCommand: ptyShim,
      platform: 'linux',
      env: {
        ...process.env,
        CI: 'true',
        GITHUB_ACTIONS: 'true',
        APP_ENV: 'staging',
        CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID,
        CLOUDFLARE_API_TOKEN: FAKE_TOKEN,
        CLOUDFLARE_API_BASE_URL: mock.endpoint,
        WRANGLER_SEND_METRICS: 'false',
        NO_COLOR: '1',
      },
      stdout: stdout.stream,
      stderr: stderr.stream,
    })
    const combined = `${stdout.text()}\n${stderr.text()}`
    expect(result.exitCode).toBe(1)
    expect(result.apiOriginAcknowledged, combined).toBe(true)
    expect(result.declinedOtherPrompt).toBe(true)
    expect(combined).toContain('You are about to upload a Worker that was last updated via the script API.')
    expect(combined).toContain('Environment variable `APP_ENV` conflicts with an existing remote secret.')
    expect(mock.requests.map(({ method, pathname }) => [method, pathname])).toEqual([
      ['GET', `/accounts/${ACCOUNT_ID}/workers/services/dpg-staging`],
      ['GET', `/accounts/${ACCOUNT_ID}/workers/scripts/dpg-staging/secrets`],
    ])
    expect(mock.requests.every(({ method }) => method === 'GET')).toBe(true)
    expect(mock.requests.every(({ authorization }) => authorization === `Bearer ${FAKE_TOKEN}`)).toBe(true)
    expect(combined).not.toContain(FAKE_TOKEN)
  }, 120_000)
})
