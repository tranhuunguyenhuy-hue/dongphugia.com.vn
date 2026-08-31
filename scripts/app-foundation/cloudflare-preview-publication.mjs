import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const WORKER_NAME = 'dongphugia-v1-public-preview'
const PREVIEW_ALIAS = 'pr-138'
const PULL_REQUEST = 138
const FREE_WORKER_GZIP_LIMIT_KIB = 3 * 1024
const FREE_STATIC_ASSET_LIMIT = 20_000
const STATIC_ASSET_FILE_LIMIT_BYTES = 25 * 1024 * 1024
const PREVIEW_SUBREQUEST_LIMIT = 50
const PRODUCTION_HOST_PATTERN = /(^|[/:.])(?:www\.|admin\.)?dongphugia\.vn(?:[/:]|$)/i
const SECRET_LIKE_PATTERN = /(SERVICE_ROLE|AUTH_ADMIN|ADMIN_SESSION|SECRET|PASSWORD|DATABASE_URL|DIRECT_URL|PRIVATE_KEY|CREDENTIAL|CLOUDFLARE_API_TOKEN|BUNNY_API_KEY)/i
const ALLOWED_CONFIG_KEYS = new Set([
  'name',
  'compatibility_date',
  'compatibility_flags',
  'main',
  'workers_dev',
  'preview_urls',
  'assets',
  'vars',
  'no_bundle',
  'rules',
  'limits',
])

function parseArgs(argv) {
  const args = {}
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (!argument?.startsWith('--') || !argv[index + 1]) {
      throw new Error('LEO563_PREVIEW_PUBLICATION_ARGUMENT_INVALID')
    }
    args[argument.slice(2)] = argv[index + 1]
    index += 1
  }
  return args
}

function requireSourceSha(value) {
  if (!/^[0-9a-f]{40}$/.test(value ?? '')) throw new Error('LEO563_PREVIEW_SOURCE_SHA_INVALID')
  return value
}

function requirePlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`LEO563_PREVIEW_${label}_INVALID`)
  }
  return value
}

function equalKeys(value, expected) {
  const actual = Object.keys(value).sort()
  return actual.length === expected.length && actual.every((key, index) => key === [...expected].sort()[index])
}

async function sha256File(filePath) {
  return createHash('sha256').update(await readFile(filePath)).digest('hex')
}

async function listFiles(root, relative = '') {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const child = path.join(relative, entry.name)
    if (entry.isDirectory()) files.push(...await listFiles(root, child))
    else if (entry.isFile()) files.push(child)
  }
  return files.sort((left, right) => left.localeCompare(right))
}

async function digestDirectory(root) {
  const hash = createHash('sha256')
  let totalBytes = 0
  let largestFile = { path: '', bytes: 0 }
  const files = await listFiles(root)
  for (const relativePath of files) {
    const content = await readFile(path.join(root, relativePath))
    totalBytes += content.byteLength
    if (content.byteLength > largestFile.bytes) {
      largestFile = { path: relativePath.split(path.sep).join('/'), bytes: content.byteLength }
    }
    hash.update(`${relativePath.split(path.sep).join('/')}\0`)
    hash.update(content)
    hash.update('\0')
  }
  return { sha256: hash.digest('hex'), fileCount: files.length, totalBytes, largestFile }
}

export function validatePreviewConfig(configValue) {
  const config = requirePlainObject(configValue, 'CONFIG')
  for (const key of Object.keys(config)) {
    if (!ALLOWED_CONFIG_KEYS.has(key)) throw new Error(`LEO563_PREVIEW_CONFIG_KEY_FORBIDDEN:${key}`)
  }
  if (config.name !== WORKER_NAME) throw new Error('LEO563_PREVIEW_WORKER_NAME_FAILED')
  if (config.workers_dev !== false) throw new Error('LEO563_PREVIEW_WORKERS_DEV_FAILED')
  if (config.preview_urls !== true) throw new Error('LEO563_PREVIEW_URLS_FAILED')
  if (config.main !== 'worker/index.js' || config.no_bundle !== true) {
    throw new Error('LEO563_PREVIEW_ENTRYPOINT_FAILED')
  }
  if (typeof config.compatibility_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(config.compatibility_date)) {
    throw new Error('LEO563_PREVIEW_COMPATIBILITY_DATE_FAILED')
  }
  if (!Array.isArray(config.compatibility_flags) || !config.compatibility_flags.includes('nodejs_compat')) {
    throw new Error('LEO563_PREVIEW_COMPATIBILITY_FLAGS_FAILED')
  }

  const assets = requirePlainObject(config.assets, 'ASSETS')
  if (!equalKeys(assets, ['binding', 'directory', 'not_found_handling'])) {
    throw new Error('LEO563_PREVIEW_ASSETS_KEYS_FAILED')
  }
  if (assets.binding !== 'ASSETS' || assets.directory !== 'assets' || assets.not_found_handling !== 'none') {
    throw new Error('LEO563_PREVIEW_ASSETS_FAILED')
  }

  const vars = requirePlainObject(config.vars, 'VARS')
  const expectedVars = {
    APP_ENV: 'preview',
    APP_BUILD_TARGET: 'public',
    APP_ORIGIN: 'https://public-preview.invalid',
    PREVIEW_NOINDEX: 'true',
  }
  if (!equalKeys(vars, Object.keys(expectedVars))) throw new Error('LEO563_PREVIEW_VARS_KEYS_FAILED')
  for (const [name, expected] of Object.entries(expectedVars)) {
    if (vars[name] !== expected) throw new Error(`LEO563_PREVIEW_VAR_FAILED:${name}`)
  }
  if (Object.keys(vars).some((name) => SECRET_LIKE_PATTERN.test(name))) {
    throw new Error('LEO563_PREVIEW_SECRET_LIKE_VAR_FORBIDDEN')
  }

  const limits = requirePlainObject(config.limits, 'LIMITS')
  if (Object.hasOwn(limits, 'cpu_ms')) throw new Error('LEO563_PREVIEW_EXPLICIT_CPU_LIMIT_FORBIDDEN')
  if (!equalKeys(limits, ['subrequests']) || limits.subrequests !== PREVIEW_SUBREQUEST_LIMIT) {
    throw new Error('LEO563_PREVIEW_FREE_LIMITS_FAILED')
  }

  const serialized = JSON.stringify(config)
  if (PRODUCTION_HOST_PATTERN.test(serialized)) throw new Error('LEO563_PREVIEW_PRODUCTION_HOST_FORBIDDEN')
  if (/\b(?:route|routes|custom_domains|triggers|services|d1_databases|kv_namespaces|r2_buckets|hyperdrive|durable_objects|secrets)\b/i.test(serialized)) {
    throw new Error('LEO563_PREVIEW_REMOTE_BINDING_OR_ROUTE_FORBIDDEN')
  }

  return {
    workerName: WORKER_NAME,
    previewAlias: PREVIEW_ALIAS,
    workersDev: false,
    previewUrls: true,
    routes: [],
    customDomains: [],
    bindings: [{ name: 'ASSETS', type: 'assets' }],
    limits: { subrequests: PREVIEW_SUBREQUEST_LIMIT },
  }
}

export async function createPublicationPreflight({ artifactRoot, sourceSha, workflowRunId }) {
  const sourceCommit = requireSourceSha(sourceSha)
  if (!workflowRunId) throw new Error('LEO563_PREVIEW_WORKFLOW_RUN_ID_REQUIRED')
  const publicRoot = path.join(artifactRoot, 'public')
  const deployableRoot = path.join(publicRoot, 'build')
  const candidate = JSON.parse(await readFile(path.join(artifactRoot, 'candidate-evidence.json'), 'utf8'))
  const manifest = JSON.parse(await readFile(path.join(publicRoot, 'artifact-manifest.json'), 'utf8'))
  const workerEvidence = JSON.parse(await readFile(path.join(deployableRoot, 'worker-artifact-evidence.json'), 'utf8'))
  const previewConfigPath = path.join(deployableRoot, 'wrangler.preview.json')
  const previewConfig = JSON.parse(await readFile(previewConfigPath, 'utf8'))

  if (candidate.contract !== 'dongphugia:app-preview-candidate:v1') throw new Error('LEO563_PREVIEW_CANDIDATE_CONTRACT_FAILED')
  if (candidate.candidate?.sourceCommit !== sourceCommit) throw new Error('LEO563_PREVIEW_CANDIDATE_SOURCE_FAILED')
  if (candidate.candidate?.pullRequest !== PULL_REQUEST) throw new Error('LEO563_PREVIEW_CANDIDATE_PR_FAILED')
  if (candidate.candidate?.workflowRunId !== workflowRunId) throw new Error('LEO563_PREVIEW_CANDIDATE_RUN_FAILED')
  if (candidate.publication?.mode !== 'ci-only' || candidate.publication?.cloudflareDeployment !== 'not-attempted') {
    throw new Error('LEO563_PREVIEW_CANDIDATE_PUBLICATION_STATE_FAILED')
  }
  if (manifest.sourceCommit !== sourceCommit || workerEvidence.sourceCommit !== sourceCommit) {
    throw new Error('LEO563_PREVIEW_ARTIFACT_SOURCE_FAILED')
  }
  if (candidate.candidate?.publicArtifactSha256 !== manifest.artifactSha256) {
    throw new Error('LEO563_PREVIEW_PUBLIC_ARTIFACT_IDENTITY_FAILED')
  }

  const configProof = validatePreviewConfig(previewConfig)
  const worker = await digestDirectory(path.join(deployableRoot, 'worker'))
  const assets = await digestDirectory(path.join(deployableRoot, 'assets'))
  const previewConfigSha256 = await sha256File(previewConfigPath)
  if (worker.sha256 !== workerEvidence.worker?.sha256 || worker.sha256 !== candidate.candidate?.publicWorkerSha256) {
    throw new Error('LEO563_PREVIEW_WORKER_IDENTITY_FAILED')
  }
  if (assets.sha256 !== workerEvidence.staticAssets?.sha256 || assets.sha256 !== candidate.candidate?.publicStaticAssetsSha256) {
    throw new Error('LEO563_PREVIEW_ASSETS_IDENTITY_FAILED')
  }
  if (previewConfigSha256 !== workerEvidence.previewConfig?.sha256 || previewConfigSha256 !== candidate.candidate?.publicPreviewConfigSha256) {
    throw new Error('LEO563_PREVIEW_CONFIG_IDENTITY_FAILED')
  }
  if (workerEvidence.previewConfig?.workerName !== WORKER_NAME || workerEvidence.previewConfig?.previewAlias !== PREVIEW_ALIAS) {
    throw new Error('LEO563_PREVIEW_RESOURCE_IDENTITY_FAILED')
  }
  if (
    workerEvidence.freeLimits?.passed !== true ||
    workerEvidence.worker?.wranglerGzipKiB > FREE_WORKER_GZIP_LIMIT_KIB ||
    assets.fileCount > FREE_STATIC_ASSET_LIMIT ||
    assets.largestFile.bytes > STATIC_ASSET_FILE_LIMIT_BYTES
  ) throw new Error('LEO563_PREVIEW_FREE_CAPACITY_FAILED')

  return {
    contract: 'dongphugia:cloudflare-preview-publication-preflight:v1',
    sourceCommit,
    pullRequest: PULL_REQUEST,
    workflowRunId,
    publicArtifactSha256: manifest.artifactSha256,
    workerArtifactSha256: worker.sha256,
    staticAssetsSha256: assets.sha256,
    previewConfigSha256,
    ...configProof,
    freeLimits: {
      workerGzipKiB: workerEvidence.worker.wranglerGzipKiB,
      workerGzipLimitKiB: FREE_WORKER_GZIP_LIMIT_KIB,
      staticAssetFiles: assets.fileCount,
      staticAssetLimit: FREE_STATIC_ASSET_LIMIT,
      largestStaticAssetBytes: assets.largestFile.bytes,
      individualStaticAssetLimitBytes: STATIC_ASSET_FILE_LIMIT_BYTES,
      passed: true,
    },
    productionSupabase: 'not-bound',
    productionDnsOrTraffic: 'unchanged-before-upload',
  }
}

export function parseWranglerUpload(output, expectedWorkerName = WORKER_NAME, expectedAlias = PREVIEW_ALIAS) {
  const clean = output.replace(/\u001b\[[0-9;]*m/g, '')
  const versionMatch = clean.match(/(?:Worker\s+)?Version ID:\s*([0-9a-f-]{32,64})/i)
  if (!versionMatch) throw new Error('LEO563_PREVIEW_VERSION_ID_MISSING')
  const urls = [...clean.matchAll(/https:\/\/[a-z0-9.-]+\.workers\.dev\/?/gi)].map((match) => match[0].replace(/\/$/, ''))
  const aliasPrefix = `${expectedAlias}-${expectedWorkerName}.`
  const aliasUrl = urls.find((value) => new URL(value).hostname.startsWith(aliasPrefix))
  if (!aliasUrl) throw new Error('LEO563_PREVIEW_ALIAS_URL_MISSING')
  for (const value of urls) {
    const url = new URL(value)
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.workers.dev')) {
      throw new Error('LEO563_PREVIEW_URL_INVALID')
    }
  }
  return {
    workerVersionId: versionMatch[1],
    previewAlias: expectedAlias,
    previewUrl: aliasUrl,
    versionPreviewUrl: urls.find((value) => value !== aliasUrl) ?? null,
  }
}

function providerErrorCodes(body) {
  if (!Array.isArray(body?.errors)) return []
  return body.errors.map((error) => Number(error?.code)).filter(Number.isInteger)
}

function normalizeOptionalList(value, errorCode) {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new Error(errorCode)
  return value
}

function collectWorkerRoutes(worker) {
  // Cloudflare's ScriptListResponse documents routes as optional; an omitted
  // optional association is the provider's empty-route representation.
  return normalizeOptionalList(worker?.routes, 'LEO563_PREVIEW_REMOTE_ROUTE_STATE_UNKNOWN')
}

function collectWorkerBindings(settings) {
  // The settings object is required; its documented optional bindings field
  // may be omitted/null to represent no attached binding.
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    throw new Error('LEO563_PREVIEW_REMOTE_SETTINGS_STATE_UNKNOWN')
  }
  return normalizeOptionalList(settings?.bindings, 'LEO563_PREVIEW_REMOTE_BINDING_STATE_UNKNOWN').map((binding) => ({
    name: typeof binding?.name === 'string' ? binding.name : 'UNKNOWN',
    type: typeof binding?.type === 'string' ? binding.type : 'UNKNOWN',
  }))
}

function collectWorkerCustomDomains(domains) {
  const customDomains = []
  for (const domain of domains) {
    if (domain?.service !== WORKER_NAME) continue
    if (typeof domain?.hostname !== 'string') throw new Error('LEO563_PREVIEW_REMOTE_DOMAIN_STATE_UNKNOWN')
    customDomains.push(domain.hostname)
  }
  return customDomains.sort()
}

export async function inspectRemoteResourceState({ accountId, apiToken, fetchImpl = fetch }) {
  if (!accountId || !apiToken) throw new Error('LEO563_PREVIEW_REMOTE_PREFLIGHT_CREDENTIALS_MISSING')
  const calls = []
  const headers = { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' }
  async function get(label, pathname) {
    const response = await fetchImpl(`https://api.cloudflare.com/client/v4${pathname}`, { method: 'GET', headers })
    let body = null
    try {
      body = await response.json()
    } catch {
      // Provider response bytes are intentionally not echoed.
    }
    calls.push({ label, status: response.ok ? 'READ_OK' : 'READ_FAILED', httpStatus: response.status, errorCodes: providerErrorCodes(body) })
    if (!response.ok || body?.success === false) throw new Error(`LEO563_PREVIEW_REMOTE_PREFLIGHT_READ_FAILED:${label}`)
    return body?.result ?? null
  }
  const [scripts, domains] = await Promise.all([
    get('workers.scripts.list', `/accounts/${accountId}/workers/scripts`),
    get('workers.domains.list', `/accounts/${accountId}/workers/domains?service=${encodeURIComponent(WORKER_NAME)}`),
  ])
  if (!Array.isArray(scripts)) throw new Error('LEO563_PREVIEW_REMOTE_SCRIPTS_STATE_UNKNOWN')
  if (!Array.isArray(domains)) throw new Error('LEO563_PREVIEW_REMOTE_DOMAINS_STATE_UNKNOWN')
  const worker = scripts.find((script) => script?.id === WORKER_NAME)
  const customDomains = collectWorkerCustomDomains(domains)
  if (customDomains.length) throw new Error('LEO563_PREVIEW_REMOTE_DOMAIN_ALREADY_EXISTS')

  if (!worker) {
    return {
      contract: 'dongphugia:cloudflare-preview-remote-preflight:v2',
      workerName: WORKER_NAME,
      state: 'ABSENT',
      workerAbsent: true,
      bootstrapRequired: true,
      reconciliationAllowed: true,
      activeDeployment: false,
      versionCount: 0,
      customDomains: [],
      workerRoutes: [],
      bindings: [],
      calls,
    }
  }

  const encodedWorker = encodeURIComponent(WORKER_NAME)
  const [subdomain, settings, versions, deployments] = await Promise.all([
    get('workers.subdomain.get', `/accounts/${accountId}/workers/scripts/${encodedWorker}/subdomain`),
    get('workers.settings.get', `/accounts/${accountId}/workers/scripts/${encodedWorker}/settings`),
    get('workers.versions.list', `/accounts/${accountId}/workers/scripts/${encodedWorker}/versions`),
    get('workers.deployments.list', `/accounts/${accountId}/workers/scripts/${encodedWorker}/deployments`),
  ])
  if (
    !subdomain ||
    typeof subdomain.enabled !== 'boolean' ||
    typeof subdomain.previews_enabled !== 'boolean'
  ) throw new Error('LEO563_PREVIEW_REMOTE_SUBDOMAIN_STATE_UNKNOWN')
  const workerRoutes = collectWorkerRoutes(worker)
  const bindings = collectWorkerBindings(settings)
  if (!Array.isArray(versions?.items)) throw new Error('LEO563_PREVIEW_REMOTE_VERSION_STATE_UNKNOWN')
  if (!Array.isArray(deployments?.deployments)) throw new Error('LEO563_PREVIEW_REMOTE_DEPLOYMENT_STATE_UNKNOWN')
  const versionItems = versions.items
  const deploymentItems = deployments.deployments

  if (workerRoutes.length) throw new Error('LEO563_PREVIEW_REMOTE_ROUTE_STATE_FORBIDDEN')
  if (deploymentItems.length) throw new Error('LEO563_PREVIEW_REMOTE_ACTIVE_DEPLOYMENT_FORBIDDEN')
  if (versionItems.length) throw new Error('LEO563_PREVIEW_REMOTE_VERSION_STATE_FORBIDDEN')
  if (bindings.length) throw new Error('LEO563_PREVIEW_REMOTE_BINDING_STATE_FORBIDDEN')
  if (subdomain.enabled !== false) throw new Error('LEO563_PREVIEW_REMOTE_ACTIVE_SUBDOMAIN_FORBIDDEN')
  if (subdomain.previews_enabled !== false) throw new Error('LEO563_PREVIEW_REMOTE_PREVIEW_URL_STATE_FORBIDDEN')

  return {
    contract: 'dongphugia:cloudflare-preview-remote-preflight:v2',
    workerName: WORKER_NAME,
    state: 'INCOMPLETE',
    workerAbsent: false,
    bootstrapRequired: false,
    reconciliationAllowed: true,
    activeDeployment: false,
    versionCount: 0,
    customDomains,
    workerRoutes,
    bindings,
    subdomain: {
      workersDevEnabled: subdomain.enabled,
      previewUrlsEnabled: subdomain.previews_enabled,
    },
    calls,
  }
}

export async function inspectPublishedResource({ accountId, apiToken, versionId, fetchImpl = fetch }) {
  if (!accountId || !apiToken) throw new Error('LEO563_PREVIEW_INSPECTION_CREDENTIALS_MISSING')
  if (!/^[0-9a-f-]{32,64}$/i.test(versionId ?? '')) throw new Error('LEO563_PREVIEW_INSPECTION_VERSION_INVALID')
  const calls = []
  const headers = { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' }
  async function get(label, pathname) {
    const response = await fetchImpl(`https://api.cloudflare.com/client/v4${pathname}`, { method: 'GET', headers })
    let body = null
    try {
      body = await response.json()
    } catch {
      // Provider response bytes are intentionally not echoed.
    }
    calls.push({ label, status: response.ok ? 'READ_OK' : 'READ_FAILED', httpStatus: response.status, errorCodes: providerErrorCodes(body) })
    if (!response.ok || body?.success === false) throw new Error(`LEO563_PREVIEW_INSPECTION_READ_FAILED:${label}`)
    return body?.result ?? null
  }

  const encodedWorker = encodeURIComponent(WORKER_NAME)
  const [settings, subdomain, domains, version] = await Promise.all([
    get('workers.settings.get', `/accounts/${accountId}/workers/scripts/${encodedWorker}/settings`),
    get('workers.subdomain.get', `/accounts/${accountId}/workers/scripts/${encodedWorker}/subdomain`),
    get('workers.domains.list', `/accounts/${accountId}/workers/domains?service=${encodedWorker}`),
    get('workers.version.get', `/accounts/${accountId}/workers/scripts/${encodedWorker}/versions/${encodeURIComponent(versionId)}`),
  ])

  if (subdomain?.enabled !== false || subdomain?.previews_enabled !== true) {
    throw new Error('LEO563_PREVIEW_INSPECTION_SUBDOMAIN_FAILED')
  }
  const customDomains = Array.isArray(domains)
    ? domains.filter((domain) => domain?.service === WORKER_NAME).map((domain) => domain?.hostname).filter((value) => typeof value === 'string').sort()
    : []
  if (customDomains.length !== 0) throw new Error('LEO563_PREVIEW_INSPECTION_CUSTOM_DOMAIN_FAILED')
  if (version?.id !== versionId) throw new Error('LEO563_PREVIEW_INSPECTION_VERSION_ID_FAILED')

  const bindings = Array.isArray(settings?.bindings)
    ? settings.bindings.map((binding) => ({
      name: typeof binding?.name === 'string' ? binding.name : 'UNKNOWN',
      type: typeof binding?.type === 'string' ? binding.type : 'UNKNOWN',
    }))
    : []
  const safePlainText = new Set(['APP_ENV', 'APP_BUILD_TARGET', 'APP_ORIGIN', 'PREVIEW_NOINDEX'])
  for (const binding of bindings) {
    if (SECRET_LIKE_PATTERN.test(binding.name)) throw new Error('LEO563_PREVIEW_INSPECTION_SECRET_BINDING_FAILED')
    if (binding.type === 'assets' && binding.name === 'ASSETS') continue
    if (binding.type === 'plain_text' && safePlainText.has(binding.name)) continue
    throw new Error(`LEO563_PREVIEW_INSPECTION_BINDING_FAILED:${binding.name}:${binding.type}`)
  }

  return {
    contract: 'dongphugia:cloudflare-preview-resource-proof:v1',
    workerName: WORKER_NAME,
    workerVersionId: versionId,
    workersDev: false,
    previewUrls: true,
    customDomains,
    workerRoutes: [],
    workerRoutesBasis: 'versions-upload-does-not-apply-triggers-and-no-zone-was-created',
    bindings,
    productionAssociation: false,
    calls,
  }
}

async function main() {
  const mode = process.argv[2]
  const args = parseArgs(process.argv.slice(3))
  if (mode === 'preflight') {
    const evidence = await createPublicationPreflight({
      artifactRoot: path.resolve(args['artifact-root'] || ''),
      sourceSha: args['source-sha'],
      workflowRunId: args['workflow-run-id'],
    })
    await writeFile(path.resolve(args.output || ''), `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 })
    process.stdout.write(`${JSON.stringify({ sourceCommit: evidence.sourceCommit, workerArtifactSha256: evidence.workerArtifactSha256, previewConfigSha256: evidence.previewConfigSha256 })}\n`)
    return
  }
  if (mode === 'record-upload') {
    const sourceCommit = requireSourceSha(args['source-sha'])
    const preflight = JSON.parse(await readFile(path.resolve(args.preflight || ''), 'utf8'))
    if (preflight.sourceCommit !== sourceCommit) throw new Error('LEO563_PREVIEW_UPLOAD_SOURCE_FAILED')
    const upload = parseWranglerUpload(await readFile(path.resolve(args.input || ''), 'utf8'))
    const evidence = {
      contract: 'dongphugia:cloudflare-preview-upload:v1',
      sourceCommit,
      pullRequest: PULL_REQUEST,
      workerName: WORKER_NAME,
      ...upload,
      publicArtifactSha256: preflight.publicArtifactSha256,
      workerArtifactSha256: preflight.workerArtifactSha256,
      staticAssetsSha256: preflight.staticAssetsSha256,
      previewConfigSha256: preflight.previewConfigSha256,
      productionDeployment: 'not-performed',
      productionDnsOrTraffic: 'unchanged',
    }
    await writeFile(path.resolve(args.output || ''), `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 })
    process.stdout.write(`${JSON.stringify({ workerVersionId: evidence.workerVersionId, previewUrl: evidence.previewUrl })}\n`)
    return
  }
  if (mode === 'inspect-resource') {
    const upload = JSON.parse(await readFile(path.resolve(args.upload || ''), 'utf8'))
    const evidence = await inspectPublishedResource({
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      apiToken: process.env.CLOUDFLARE_API_TOKEN,
      versionId: upload.workerVersionId,
    })
    if (upload.workerName !== evidence.workerName) throw new Error('LEO563_PREVIEW_INSPECTION_WORKER_FAILED')
    await writeFile(path.resolve(args.output || ''), `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 })
    process.stdout.write(`${JSON.stringify({ workerName: evidence.workerName, workerVersionId: evidence.workerVersionId, customDomains: evidence.customDomains, bindings: evidence.bindings })}\n`)
    return
  }
  if (mode === 'inspect-resource-state') {
    const evidence = await inspectRemoteResourceState({
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      apiToken: process.env.CLOUDFLARE_API_TOKEN,
    })
    await writeFile(path.resolve(args.output || ''), `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 })
    process.stdout.write(`${JSON.stringify({ workerName: evidence.workerName, state: evidence.state, reconciliationAllowed: evidence.reconciliationAllowed, customDomains: evidence.customDomains })}\n`)
    return
  }
  throw new Error('LEO563_PREVIEW_PUBLICATION_MODE_INVALID')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`LEO563_PREVIEW_PUBLICATION_FAILED:${error.message}`)
    process.exitCode = 1
  })
}

export {
  PREVIEW_ALIAS,
  PREVIEW_SUBREQUEST_LIMIT,
  WORKER_NAME,
}
