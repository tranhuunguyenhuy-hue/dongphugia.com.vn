import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const EXPECTED_ACCOUNT_ID = 'd54f3402b9d112ab64d6135e0e3f1fb1'
const ENVIRONMENTS = {
  staging: { workerName: 'dpg-staging', origin: 'https://dpg-staging.tranhuunguyenhuy.workers.dev' },
}
const SHA = /^[a-f0-9]{40}$/
const SHA256 = /^[a-f0-9]{64}$/
const SECRET_NAME = /(SERVICE_ROLE|AUTH_ADMIN|SECRET|PASSWORD|DATABASE_URL|DIRECT_URL|PRIVATE_KEY|CREDENTIAL|CLOUDFLARE_API_TOKEN|BUNNY_API_KEY)/i
const CONFIG_KEYS = [
  'name', 'main', 'compatibility_date', 'compatibility_flags', 'workers_dev',
  'preview_urls', 'assets', 'observability', 'vars',
]
const VAR_KEYS = [
  'APP_ENV', 'APP_ORIGIN', 'PREVIEW_NOINDEX', 'BUILD_SOURCE_SHA',
  'PUBLIC_CATALOGUE_SOURCE',
]
const PRODUCTION_CATALOGUE_PATHS = [
  '/__catalogue/v1/manifest.json',
  '/__catalogue/v1/listings/{family}/{listing}/{page}.json',
  '/__catalogue/v1/products/{bucket}.json',
  '/__catalogue/v1/search/{shard}.json',
]
const ADMIN_RSC_GLOBALS = [
  '__dpg_rsc0_client_require__',
  '__dpg_rsc0_require__',
  '__dpg_rsc0_server_require__',
]
const UNNAMESPACED_ADMIN_RSC_GLOBALS = [
  '__vite_rsc_client_require__',
  '__vite_rsc_require__',
  '__vite_rsc_server_require__',
]

function fail(code) {
  throw new Error(code)
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

async function listFiles(root, relative = '') {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true })
  const files = []
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const child = path.join(relative, entry.name)
    if (entry.isSymbolicLink()) fail('ENVIRONMENT_WORKER_ARTIFACT_SYMLINK_FORBIDDEN')
    if (entry.isDirectory()) files.push(...await listFiles(root, child))
    else if (entry.isFile()) files.push(child)
    else fail('ENVIRONMENT_WORKER_ARTIFACT_ENTRY_INVALID')
  }
  return files
}

async function digestDirectory(root) {
  const hash = createHash('sha256')
  const files = await listFiles(root)
  let totalBytes = 0
  for (const relative of files) {
    const content = await readFile(path.join(root, relative))
    hash.update(`${relative.split(path.sep).join('/')}\0`)
    hash.update(content)
    hash.update('\0')
    totalBytes += content.byteLength
  }
  return { sha256: hash.digest('hex'), fileCount: files.length, totalBytes, files }
}

export async function prepareEnvironmentWorkerPublication({
  artifactRoot,
  environment,
  sourceSha,
  accountId,
}) {
  const target = ENVIRONMENTS[environment]
  if (!target) fail('ENVIRONMENT_WORKER_PUBLISH_ENVIRONMENT_INVALID')
  if (!SHA.test(sourceSha || '')) fail('ENVIRONMENT_WORKER_PUBLISH_SOURCE_SHA_INVALID')
  if (accountId !== EXPECTED_ACCOUNT_ID) fail('ENVIRONMENT_WORKER_PUBLISH_ACCOUNT_MISMATCH')

  const root = path.resolve(artifactRoot)
  const manifest = JSON.parse(await readFile(path.join(root, 'candidate-manifest.json'), 'utf8'))
  const originalConfigBytes = await readFile(path.join(root, 'wrangler.json'))
  const originalConfig = JSON.parse(originalConfigBytes.toString('utf8'))
  const origin = target.origin
  if (!isObject(manifest) || manifest.contract !== 'dpg:combined-environment-worker:v2'
    || manifest.sourceSha !== sourceSha || manifest.appEnvironment !== environment
    || manifest.workerName !== target.workerName || manifest.origin !== origin
    || manifest.dataMode !== 'production-published-public-catalogue'
    || !isObject(manifest.deployment) || manifest.deployment.workersDev !== true
    || manifest.deployment.localOnly !== false
    || manifest.deployment.previewUrls !== false || manifest.deployment.noindex !== true
    || JSON.stringify(manifest.deployment.customDomains) !== '[]'
    || JSON.stringify(manifest.deployment.routes) !== '[]'
    || !isObject(manifest.observability) || manifest.observability.logs !== true
    || manifest.observability.persist !== false || manifest.observability.traces !== false
    || !isObject(manifest.productionData)
    || manifest.productionData.origin !== 'https://www.dongphugia.vn'
    || manifest.productionData.mode !== 'runtime-readonly-public-assets'
    || JSON.stringify(manifest.productionData.allowedPaths) !== JSON.stringify(PRODUCTION_CATALOGUE_PATHS)
    || manifest.productionData.credentials !== false || manifest.productionData.cookies !== false
    || manifest.productionData.privateAdminData !== 'unavailable'
    || manifest.productionData.authWrites !== 'disabled'
    || manifest.productionData.orderWrites !== 'disabled'
    || manifest.productionData.cmsWrites !== 'disabled'
    || manifest.productionData.uploadWrites !== 'disabled'
    || !isObject(manifest.authentication) || manifest.authentication.enabled !== false
    || manifest.authentication.providerConfigBound !== false) {
    fail('ENVIRONMENT_WORKER_PUBLISH_MANIFEST_IDENTITY_INVALID')
  }
  if (!isObject(manifest.apps) || manifest.apps.public?.entrypoint !== 'public-worker/index.js'
    || manifest.apps.admin?.entrypoint !== 'admin-worker/index.js'
    || manifest.apps.admin?.basePath !== '/admin'
    || manifest.apps.admin?.assetsBasePath !== '/admin/'
    || manifest.apps.admin?.authentication !== 'disabled'
    || manifest.apps.admin?.privateData !== 'unavailable'
    || manifest.apps.admin?.rscGlobalNamespace !== 'dpg-rsc0'
    || JSON.stringify(manifest.apps.admin?.rscGlobalNames) !== JSON.stringify(ADMIN_RSC_GLOBALS)) {
    fail('ENVIRONMENT_WORKER_PUBLISH_APP_MOUNT_INVALID')
  }
  if (!SHA256.test(manifest.apps.admin.sha256 || '')
    || !Number.isSafeInteger(manifest.apps.admin.fileCount) || manifest.apps.admin.fileCount < 1
    || !Number.isSafeInteger(manifest.apps.admin.totalBytes) || manifest.apps.admin.totalBytes < 1) {
    fail('ENVIRONMENT_WORKER_PUBLISH_ADMIN_DIGEST_MANIFEST_INVALID')
  }
  for (const section of [manifest.apps.public, manifest.assets]) {
    if (!isObject(section) || !SHA256.test(section.sha256 || '')
      || !Number.isSafeInteger(section.fileCount) || section.fileCount < 1
      || !Number.isSafeInteger(section.totalBytes) || section.totalBytes < 1) {
      fail('ENVIRONMENT_WORKER_PUBLISH_DIGEST_MANIFEST_INVALID')
    }
  }
  if (!isObject(manifest.dispatcher) || manifest.dispatcher.entrypoint !== 'worker.mjs'
    || !SHA256.test(manifest.dispatcher.sha256 || '')
    || !SHA256.test(manifest.dispatcher.dispatchSha256 || '')
    || !SHA256.test(manifest.configSha256 || '')) {
    fail('ENVIRONMENT_WORKER_PUBLISH_DISPATCHER_MANIFEST_INVALID')
  }
  if (sha256(originalConfigBytes) !== manifest.configSha256) {
    fail('ENVIRONMENT_WORKER_PUBLISH_CONFIG_DIGEST_MISMATCH')
  }

  const actualDirectories = await Promise.all([
    digestDirectory(path.join(root, 'public-worker')),
    digestDirectory(path.join(root, 'admin-worker')),
    digestDirectory(path.join(root, 'assets')),
  ])
  for (const [index, section] of [manifest.apps.public, manifest.apps.admin, manifest.assets].entries()) {
    const actual = actualDirectories[index]
    if (actual.sha256 !== section.sha256 || actual.fileCount !== section.fileCount
      || actual.totalBytes !== section.totalBytes) {
      fail('ENVIRONMENT_WORKER_PUBLISH_CONTENT_DIGEST_MISMATCH')
    }
  }
  const adminRscFiles = [
    ...actualDirectories[1].files.map((file) => path.join(root, 'admin-worker', file)),
    ...actualDirectories[2].files
      .filter((file) => file.startsWith(`admin${path.sep}`))
      .map((file) => path.join(root, 'assets', file)),
  ].filter((file) => /\.(?:m?js)$/.test(file))
  const adminRscGlobalsFound = new Set()
  for (const file of adminRscFiles) {
    const source = await readFile(file, 'utf8')
    for (const globalName of UNNAMESPACED_ADMIN_RSC_GLOBALS) {
      if (source.includes(globalName)) fail('ENVIRONMENT_WORKER_PUBLISH_ADMIN_RSC_NAMESPACE_INVALID')
    }
    for (const globalName of ADMIN_RSC_GLOBALS) {
      if (source.includes(globalName)) adminRscGlobalsFound.add(globalName)
    }
  }
  if (ADMIN_RSC_GLOBALS.some((globalName) => !adminRscGlobalsFound.has(globalName))) {
    fail('ENVIRONMENT_WORKER_PUBLISH_ADMIN_RSC_NAMESPACE_INVALID')
  }
  const [workerBytes, dispatchBytes] = await Promise.all([
    readFile(path.join(root, 'worker.mjs')),
    readFile(path.join(root, 'dispatch.mjs')),
  ])
  if (!/from\s+['"]\.\/admin-worker\//.test(workerBytes.toString('utf8'))
    || sha256(workerBytes) !== manifest.dispatcher.sha256
    || sha256(dispatchBytes) !== manifest.dispatcher.dispatchSha256) {
    fail('ENVIRONMENT_WORKER_PUBLISH_DISPATCHER_DIGEST_MISMATCH')
  }
  if (!actualDirectories[2].files.some((file) => file.startsWith(`_next${path.sep}static${path.sep}`))
    || !actualDirectories[2].files.some((file) => file.startsWith(`admin${path.sep}_next${path.sep}static${path.sep}`))) {
    fail('ENVIRONMENT_WORKER_PUBLISH_STATIC_MOUNT_INVALID')
  }

  const allowedRootEntries = new Set(['worker.mjs', 'dispatch.mjs', 'wrangler.json', 'candidate-manifest.json', 'public-worker', 'admin-worker', 'assets'])
  const rootEntries = await readdir(root, { withFileTypes: true })
  if (rootEntries.some((entry) => !allowedRootEntries.has(entry.name) || entry.isSymbolicLink())) {
    fail('ENVIRONMENT_WORKER_PUBLISH_ROOT_CONTENT_INVALID')
  }

  const allowedConfigKeys = [...CONFIG_KEYS].sort()
  if (!isObject(originalConfig)
    || JSON.stringify(Object.keys(originalConfig).sort()) !== JSON.stringify(allowedConfigKeys)
    || originalConfig.name !== target.workerName || originalConfig.main !== 'worker.mjs'
    || originalConfig.compatibility_date !== '2026-11-12'
    || JSON.stringify(originalConfig.compatibility_flags) !== '["nodejs_compat"]'
    || originalConfig.workers_dev !== true || originalConfig.preview_urls !== false
    || JSON.stringify(originalConfig.assets) !== JSON.stringify({
      directory: 'assets', binding: 'ASSETS', not_found_handling: 'none', run_worker_first: ['/*'],
    })
    || !isObject(originalConfig.observability)
    || originalConfig.observability.enabled !== true
    || JSON.stringify(originalConfig.observability.logs) !== JSON.stringify({ enabled: true, persist: false, invocation_logs: true })
    || JSON.stringify(originalConfig.observability.traces) !== JSON.stringify({ enabled: false, persist: false })
    || !isObject(originalConfig.vars)
    || JSON.stringify(Object.keys(originalConfig.vars).sort()) !== JSON.stringify([...VAR_KEYS].sort())
    || originalConfig.vars.APP_ENV !== environment || originalConfig.vars.APP_ORIGIN !== origin
    || originalConfig.vars.PREVIEW_NOINDEX !== 'true' || originalConfig.vars.BUILD_SOURCE_SHA !== sourceSha
    || originalConfig.vars.PUBLIC_CATALOGUE_SOURCE !== 'production-published-snapshot'
    || Object.keys(originalConfig.vars).some((name) => SECRET_NAME.test(name))) {
    fail('ENVIRONMENT_WORKER_PUBLISH_CONFIG_ALLOWLIST_INVALID')
  }

  const deploymentConfig = {
    name: target.workerName,
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
  await writeFile(path.join(root, 'wrangler.json'), `${JSON.stringify(deploymentConfig, null, 2)}\n`, 'utf8')
  const evidence = {
    contract: 'dpg:combined-environment-worker:publication:v1',
    sourceSha,
    environment,
    workerName: target.workerName,
    origin,
    accountId: EXPECTED_ACCOUNT_ID,
    apps: {
      publicSha256: actualDirectories[0].sha256,
      adminSha256: actualDirectories[1].sha256,
      admin: 'ssr-rendered-auth-disabled-private-data-unavailable',
      assetsSha256: actualDirectories[2].sha256,
    },
    dataMode: 'production-published-public-catalogue',
    authentication: 'disabled-without-provider-config',
    deploymentConfigSha256: sha256(`${JSON.stringify(deploymentConfig, null, 2)}\n`),
  }
  await writeFile(path.join(root, 'publication-manifest.json'), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8')
  return evidence
}

async function main() {
  const [artifactRoot, environment, sourceSha, accountId] = process.argv.slice(2)
  if (!artifactRoot || !environment || !sourceSha || !accountId) {
    fail('USAGE: prepare-environment-worker-publication <artifact-root> staging <source-sha> <account-id>')
  }
  const evidence = await prepareEnvironmentWorkerPublication({ artifactRoot, environment, sourceSha, accountId })
  process.stdout.write(`${JSON.stringify({ status: 'ENVIRONMENT_WORKER_PUBLICATION_PREFLIGHT_PASS', ...evidence })}\n`)
}

if (process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) {
  main().catch((error) => {
    process.stderr.write(`ENVIRONMENT_WORKER_PUBLICATION_PREFLIGHT_FAILED:${error instanceof Error ? error.message : 'UNKNOWN'}\n`)
    process.exitCode = 1
  })
}
