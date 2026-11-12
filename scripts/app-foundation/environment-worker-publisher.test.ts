import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { prepareEnvironmentWorkerPublication } from './prepare-environment-worker-publication.mjs'

const ACCOUNT_ID = 'd54f3402b9d112ab64d6135e0e3f1fb1'
const sourceSha = 'a'.repeat(40)
const rootDirectories: string[] = []

function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex')
}

async function digestDirectory(root: string) {
  const { readdir, readFile } = await import('node:fs/promises')
  const files: string[] = []
  async function visit(current: string, relative = '') {
    for (const entry of (await readdir(current, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name))) {
      const child = path.join(relative, entry.name)
      if (entry.isDirectory()) await visit(path.join(current, entry.name), child)
      else files.push(child)
    }
  }
  await visit(root)
  const hash = createHash('sha256')
  let totalBytes = 0
  for (const relative of files) {
    const content = await readFile(path.join(root, relative))
    hash.update(`${relative.split(path.sep).join('/')}\0`)
    hash.update(content)
    hash.update('\0')
    totalBytes += content.byteLength
  }
  return { sha256: hash.digest('hex'), fileCount: files.length, totalBytes }
}

async function createCandidate() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dpg-env-worker-'))
  rootDirectories.push(root)
  const directories = ['public-worker', 'assets/_next/static/css']
  for (const directory of directories) await mkdir(path.join(root, directory), { recursive: true })
  await writeFile(path.join(root, 'public-worker/index.js'), 'export default { fetch() { return new Response("public") } }\n')
  await writeFile(path.join(root, 'assets/_next/static/css/public.css'), 'body{}\n')
  await writeFile(path.join(root, 'worker.mjs'), 'import publicWorker from "./public-worker/index.js"; export default publicWorker\n')
  await writeFile(path.join(root, 'dispatch.mjs'), 'export default { fetch() { return new Response("combined") } }\n')

  const environment = 'staging'
  const workerName = 'dpg-staging'
  const origin = 'https://dpg-staging.tranhuunguyenhuy.workers.dev'
  const config = {
    name: workerName,
    main: 'worker.mjs',
    compatibility_date: '2026-11-12',
    compatibility_flags: ['nodejs_compat'],
    workers_dev: true,
    preview_urls: false,
    assets: { directory: 'assets', binding: 'ASSETS', not_found_handling: 'none', run_worker_first: ['/*'] },
    observability: {
      enabled: true,
      logs: { enabled: true, persist: false, invocation_logs: true },
      traces: { enabled: false, persist: false },
    },
    vars: {
      APP_ENV: environment,
      APP_ORIGIN: origin,
      PREVIEW_NOINDEX: 'true',
      BUILD_SOURCE_SHA: sourceSha,
      PUBLIC_CATALOGUE_SOURCE: 'production-published-snapshot',
    },
  }
  const configBytes = `${JSON.stringify(config, null, 2)}\n`
  await writeFile(path.join(root, 'wrangler.json'), configBytes)
  const [publicDigest, assetsDigest] = await Promise.all([
    digestDirectory(path.join(root, 'public-worker')),
    digestDirectory(path.join(root, 'assets')),
  ])
  const manifest = {
    contract: 'dpg:combined-environment-worker:v1',
    sourceSha,
    appEnvironment: environment,
    workerName,
    origin,
    apps: {
      public: { entrypoint: 'public-worker/index.js', ...publicDigest },
      admin: {
        route: '/admin', status: 503, runtime: 'static-unavailable',
        authentication: 'disabled', privateData: 'unavailable',
      },
    },
    assets: assetsDigest,
    dispatcher: {
      entrypoint: 'worker.mjs',
      sha256: sha256(await readFile(path.join(root, 'worker.mjs'))),
      dispatchSha256: sha256(await readFile(path.join(root, 'dispatch.mjs'))),
    },
    configSha256: sha256(configBytes),
    authentication: { enabled: false, providerConfigBound: false },
    deployment: { workersDev: true, previewUrls: false, localOnly: false, customDomains: [], routes: [], noindex: true },
    dataMode: 'production-published-public-catalogue',
    productionData: {
      origin: 'https://www.dongphugia.vn',
      mode: 'runtime-readonly-public-assets',
      allowedPaths: [
        '/__catalogue/v1/manifest.json',
        '/__catalogue/v1/listings/{family}/{listing}/{page}.json',
        '/__catalogue/v1/products/{bucket}.json',
        '/__catalogue/v1/search/{shard}.json',
      ],
      credentials: false,
      cookies: false,
      privateAdminData: 'unavailable',
      authWrites: 'disabled',
      orderWrites: 'disabled',
      cmsWrites: 'disabled',
      uploadWrites: 'disabled',
    },
    observability: { logs: true, persist: false, traces: false },
  }
  await writeFile(path.join(root, 'candidate-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  return root
}

afterEach(async () => {
  await Promise.all(rootDirectories.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('Staging Worker trusted publication contract', () => {
  it('rewrites only the exact Staging identity with the source-verified config allowlist', async () => {
    const root = await createCandidate()
    const evidence = await prepareEnvironmentWorkerPublication({
      artifactRoot: root,
      environment: 'staging',
      sourceSha,
      accountId: ACCOUNT_ID,
    })
    const config = JSON.parse(await readFile(path.join(root, 'wrangler.json'), 'utf8'))

    expect(evidence).toMatchObject({
      environment: 'staging',
      workerName: 'dpg-staging',
      origin: 'https://dpg-staging.tranhuunguyenhuy.workers.dev',
      accountId: ACCOUNT_ID,
      sourceSha,
      dataMode: 'production-published-public-catalogue',
      authentication: 'disabled-without-provider-config',
    })
    expect(config).toMatchObject({
      name: 'dpg-staging',
      workers_dev: true,
      preview_urls: false,
      vars: {
        APP_ENV: 'staging', BUILD_SOURCE_SHA: sourceSha, PREVIEW_NOINDEX: 'true',
        PUBLIC_CATALOGUE_SOURCE: 'production-published-snapshot',
      },
    })
    expect(config.vars).not.toHaveProperty('ADMIN_AUTH_ENABLED')
    expect(config.vars).not.toHaveProperty('NEXT_PUBLIC_ADMIN_AUTH_ENABLED')
    expect(config.vars).not.toHaveProperty('ADMIN_BASE_PATH')
    expect(config).not.toHaveProperty('routes')
    expect(config).not.toHaveProperty('d1_databases')
    expect(config.vars).not.toHaveProperty('SUPABASE_SERVICE_ROLE_KEY')
  })

  it('rejects an account mismatch before preparing deployment config', async () => {
    const root = await createCandidate()
    await expect(prepareEnvironmentWorkerPublication({
      artifactRoot: root, environment: 'staging', sourceSha, accountId: 'b255b2091ce23ca52c4de4a342ce9dd8',
    })).rejects.toThrow('ENVIRONMENT_WORKER_PUBLISH_ACCOUNT_MISMATCH')
  })

  it('rejects artifact tampering even when candidate metadata still names the reviewed SHA', async () => {
    const root = await createCandidate()
    await writeFile(path.join(root, 'public-worker/index.js'), 'export default { fetch() { return new Response("tampered") } }\n')
    await expect(prepareEnvironmentWorkerPublication({
      artifactRoot: root, environment: 'staging', sourceSha, accountId: ACCOUNT_ID,
    })).rejects.toThrow('ENVIRONMENT_WORKER_PUBLISH_CONTENT_DIGEST_MISMATCH')
  })

  it('rejects any candidate that claims Auth is enabled', async () => {
    const root = await createCandidate()
    const manifestPath = path.join(root, 'candidate-manifest.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    manifest.authentication.enabled = true
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
    await expect(prepareEnvironmentWorkerPublication({
      artifactRoot: root, environment: 'staging', sourceSha, accountId: ACCOUNT_ID,
    })).rejects.toThrow('ENVIRONMENT_WORKER_PUBLISH_MANIFEST_IDENTITY_INVALID')
  })

  it('rejects an injected route or additional deployment setting', async () => {
    const root = await createCandidate()
    const configPath = path.join(root, 'wrangler.json')
    const config = JSON.parse(await readFile(configPath, 'utf8'))
    config.routes = ['www.dongphugia.vn/*']
    const configBytes = `${JSON.stringify(config, null, 2)}\n`
    await writeFile(configPath, configBytes)
    const manifestPath = path.join(root, 'candidate-manifest.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    manifest.configSha256 = sha256(configBytes)
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

    await expect(prepareEnvironmentWorkerPublication({
      artifactRoot: root, environment: 'staging', sourceSha, accountId: ACCOUNT_ID,
    })).rejects.toThrow('ENVIRONMENT_WORKER_PUBLISH_CONFIG_ALLOWLIST_INVALID')
  })
})
