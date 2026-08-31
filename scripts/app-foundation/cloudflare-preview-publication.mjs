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
const PRODUCTION_HOST_PATTERN = /(^|[/:.])(?:www\.|admin\.)?dongphugia\.vn(?:[/:]|$)/i
const SECRET_LIKE_PATTERN = /(SERVICE_ROLE|AUTH_ADMIN|ADMIN_SESSION|SECRET|PASSWORD|DATABASE_URL|DIRECT_URL|PRIVATE_KEY|CREDENTIAL|CLOUDFLARE_API_TOKEN|BUNNY_API_KEY)/i
const VERSION_ID_PATTERN = /^[0-9a-f-]{32,64}$/i
const SHA256_PATTERN = /^[0-9a-f]{64}$/i
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
  if (Object.hasOwn(config, 'limits')) throw new Error('LEO563_PREVIEW_EXPLICIT_LIMITS_FORBIDDEN')
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

export function parseWranglerDeploy(output) {
  const clean = output.replace(/\u001b\[[0-9;]*m/g, '')
  const versionMatch = clean.match(/Current Version ID:\s*([0-9a-f-]{32,64})/i)
  if (!versionMatch) throw new Error('LEO563_PREVIEW_BOOTSTRAP_VERSION_ID_MISSING')
  return { bootstrapVersionId: versionMatch[1] }
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

function collectRemoteVersionIds(versions, errorCode = 'LEO563_PREVIEW_REMOTE_VERSION_STATE_UNKNOWN') {
  if (!Array.isArray(versions?.items)) throw new Error(errorCode)
  return versions.items.map((version) => {
    if (typeof version?.id !== 'string' || !/^[0-9a-f-]{32,64}$/i.test(version.id)) throw new Error(errorCode)
    return version.id
  }).sort()
}

function collectRemoteDeployments(deployments, errorCode = 'LEO563_PREVIEW_REMOTE_DEPLOYMENT_STATE_UNKNOWN') {
  if (!Array.isArray(deployments?.deployments)) throw new Error(errorCode)
  return deployments.deployments.map((deployment) => {
    if (typeof deployment?.id !== 'string' || !/^[0-9a-f-]{32,64}$/i.test(deployment.id)) throw new Error(errorCode)
    if (deployment.strategy !== 'percentage' || !Array.isArray(deployment.versions) || deployment.versions.length === 0) {
      throw new Error(errorCode)
    }
    const versions = deployment.versions.map((version) => {
      if (
        typeof version?.version_id !== 'string' ||
        !/^[0-9a-f-]{32,64}$/i.test(version.version_id) ||
        typeof version?.percentage !== 'number' ||
        !Number.isFinite(version.percentage)
      ) throw new Error(errorCode)
      return { versionId: version.version_id, percentage: version.percentage }
    }).sort((left, right) => left.versionId.localeCompare(right.versionId))
    return { id: deployment.id, strategy: deployment.strategy, versions }
  }).sort((left, right) => left.id.localeCompare(right.id))
}

function remoteDeploymentIds(deployments) {
  return deployments.map((deployment) => deployment.id)
}

function assertSafePublishedBindings(bindings) {
  const safePlainText = new Set(['APP_ENV', 'APP_BUILD_TARGET', 'APP_ORIGIN', 'PREVIEW_NOINDEX'])
  if (!bindings.some((binding) => binding.name === 'ASSETS' && binding.type === 'assets')) {
    throw new Error('LEO563_PREVIEW_INSPECTION_ASSETS_BINDING_FAILED')
  }
  for (const binding of bindings) {
    if (SECRET_LIKE_PATTERN.test(binding.name)) throw new Error('LEO563_PREVIEW_INSPECTION_SECRET_BINDING_FAILED')
    if (binding.type === 'assets' && binding.name === 'ASSETS') continue
    if (binding.type === 'plain_text' && safePlainText.has(binding.name)) continue
    throw new Error(`LEO563_PREVIEW_INSPECTION_BINDING_FAILED:${binding.name}:${binding.type}`)
  }
}

function requireManagedVersionId(value, errorCode = 'LEO563_PREVIEW_MANAGED_EVIDENCE_VERSION_INVALID') {
  if (typeof value !== 'string' || !VERSION_ID_PATTERN.test(value)) throw new Error(errorCode)
  return value
}

function requireManagedSha256(value, errorCode = 'LEO563_PREVIEW_MANAGED_EVIDENCE_DIGEST_INVALID') {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) throw new Error(errorCode)
  return value
}

function requireManagedWorkersDevUrl(value, label) {
  if (typeof value !== 'string') throw new Error(`LEO563_PREVIEW_MANAGED_EVIDENCE_${label}_URL_INVALID`)
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.workers.dev') || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('invalid')
    }
  } catch {
    throw new Error(`LEO563_PREVIEW_MANAGED_EVIDENCE_${label}_URL_INVALID`)
  }
  return value
}

function normalizeManagedDeployments(value, errorCode = 'LEO563_PREVIEW_MANAGED_EVIDENCE_DEPLOYMENT_INVALID') {
  if (value === null) return null
  if (!Array.isArray(value)) throw new Error(errorCode)
  const deployments = value.map((deployment) => ({
    id: deployment?.id,
    strategy: deployment?.strategy,
    versions: Array.isArray(deployment?.versions)
      ? deployment.versions.map((version) => ({
        version_id: version?.versionId ?? version?.version_id,
        percentage: version?.percentage,
      }))
      : deployment?.versions,
  }))
  return collectRemoteDeployments({ deployments }, errorCode)
}

function normalizeManagedPublicationProof(proof) {
  if (
    !proof ||
    proof.contract !== 'dongphugia:cloudflare-managed-preview-evidence:v1' ||
    proof.workerName !== WORKER_NAME ||
    typeof proof.sourceCommit !== 'string' ||
    !/^[0-9a-f]{40}$/.test(proof.sourceCommit) ||
    proof.pullRequest !== PULL_REQUEST ||
    typeof proof.workflowRunId !== 'string' ||
    !/^\d+$/.test(proof.workflowRunId) ||
    proof.previewAlias !== PREVIEW_ALIAS ||
    proof.workersDev !== false ||
    proof.previewUrls !== true ||
    !Array.isArray(proof.customDomains) || proof.customDomains.length !== 0 ||
    !Array.isArray(proof.workerRoutes) || proof.workerRoutes.length !== 0 ||
    proof.productionAssociation !== false
  ) throw new Error('LEO563_PREVIEW_MANAGED_EVIDENCE_INVALID')

  const workerVersionId = requireManagedVersionId(proof.workerVersionId)
  const bootstrapVersionId = proof.bootstrapVersionId === undefined || proof.bootstrapVersionId === null
    ? null
    : requireManagedVersionId(proof.bootstrapVersionId, 'LEO563_PREVIEW_MANAGED_EVIDENCE_BOOTSTRAP_VERSION_INVALID')
  if (bootstrapVersionId === workerVersionId) {
    throw new Error('LEO563_PREVIEW_MANAGED_EVIDENCE_BOOTSTRAP_VERSION_INVALID')
  }
  const priorVersionIds = proof.priorVersionIds?.map((value) => requireManagedVersionId(value))
  if (!Array.isArray(priorVersionIds) || priorVersionIds.length === 0 || !priorVersionIds.includes(workerVersionId)) {
    throw new Error('LEO563_PREVIEW_MANAGED_EVIDENCE_VERSION_STATE_INVALID')
  }
  if (bootstrapVersionId && !priorVersionIds.includes(bootstrapVersionId)) {
    throw new Error('LEO563_PREVIEW_MANAGED_EVIDENCE_BOOTSTRAP_VERSION_INVALID')
  }
  priorVersionIds.sort()

  const priorDeployments = normalizeManagedDeployments(proof.priorDeployments)
  if (priorDeployments !== null && priorDeployments.length === 0) {
    throw new Error('LEO563_PREVIEW_MANAGED_EVIDENCE_DEPLOYMENT_STATE_INVALID')
  }
  const priorDeploymentIds = proof.priorDeploymentIds === null
    ? null
    : proof.priorDeploymentIds?.map((value) => requireManagedVersionId(value, 'LEO563_PREVIEW_MANAGED_EVIDENCE_DEPLOYMENT_ID_INVALID'))
  if (priorDeploymentIds !== null && !Array.isArray(priorDeploymentIds)) {
    throw new Error('LEO563_PREVIEW_MANAGED_EVIDENCE_DEPLOYMENT_ID_INVALID')
  }
  if (priorDeployments !== null && !sameJson(priorDeploymentIds, remoteDeploymentIds(priorDeployments))) {
    throw new Error('LEO563_PREVIEW_MANAGED_EVIDENCE_DEPLOYMENT_ID_INVALID')
  }
  if (
    priorDeployments === null && proof.deploymentIdentityBasis !== 'prior-version-evidence' ||
    priorDeployments !== null && proof.deploymentIdentityBasis !== 'prior-resource-proof'
  ) throw new Error('LEO563_PREVIEW_MANAGED_EVIDENCE_DEPLOYMENT_BASIS_INVALID')

  const bindings = Array.isArray(proof.bindings)
    ? proof.bindings.map((binding) => ({ name: binding?.name, type: binding?.type }))
    : null
  if (!bindings) throw new Error('LEO563_PREVIEW_MANAGED_EVIDENCE_BINDING_STATE_INVALID')
  try {
    assertSafePublishedBindings(bindings)
  } catch {
    throw new Error('LEO563_PREVIEW_MANAGED_EVIDENCE_BINDING_STATE_INVALID')
  }

  for (const field of ['publicArtifactSha256', 'workerArtifactSha256', 'staticAssetsSha256', 'previewConfigSha256']) {
    requireManagedSha256(proof[field])
  }

  return {
    contract: 'dongphugia:cloudflare-managed-preview-evidence:v1',
    sourceCommit: proof.sourceCommit,
    pullRequest: PULL_REQUEST,
    workflowRunId: proof.workflowRunId,
    workerName: WORKER_NAME,
    previewAlias: PREVIEW_ALIAS,
    workerVersionId,
    bootstrapVersionId,
    workersDev: false,
    previewUrls: true,
    customDomains: [],
    workerRoutes: [],
    productionAssociation: false,
    priorVersionIds,
    priorDeployments,
    priorDeploymentIds,
    deploymentIdentityBasis: proof.deploymentIdentityBasis,
    publicArtifactSha256: proof.publicArtifactSha256,
    workerArtifactSha256: proof.workerArtifactSha256,
    staticAssetsSha256: proof.staticAssetsSha256,
    previewConfigSha256: proof.previewConfigSha256,
    bindings,
  }
}

export function validateManagedPublicationEvidence({ publicationPreflight, uploadEvidence, resourceProof, expectedWorkflowRunId = null, bootstrapVersionId: expectedBootstrapVersionId = null }) {
  if (
    publicationPreflight?.contract !== 'dongphugia:cloudflare-preview-publication-preflight:v1' ||
    uploadEvidence?.contract !== 'dongphugia:cloudflare-preview-upload:v1' ||
    !['dongphugia:cloudflare-preview-resource-proof:v1', 'dongphugia:cloudflare-preview-resource-proof:v2'].includes(resourceProof?.contract)
  ) throw new Error('LEO563_PREVIEW_MANAGED_EVIDENCE_CONTRACT_INVALID')

  const sourceCommit = publicationPreflight.sourceCommit
  if (
    typeof sourceCommit !== 'string' ||
    !/^[0-9a-f]{40}$/.test(sourceCommit) ||
    uploadEvidence.sourceCommit !== sourceCommit ||
    publicationPreflight.pullRequest !== PULL_REQUEST ||
    uploadEvidence.pullRequest !== PULL_REQUEST ||
    (expectedWorkflowRunId !== null && String(publicationPreflight.workflowRunId) !== String(expectedWorkflowRunId))
  ) throw new Error('LEO563_PREVIEW_MANAGED_EVIDENCE_SOURCE_FAILED')

  for (const evidence of [publicationPreflight, uploadEvidence, resourceProof]) {
    if (evidence.workerName !== WORKER_NAME) throw new Error('LEO563_PREVIEW_MANAGED_EVIDENCE_WORKER_IDENTITY_FAILED')
  }
  if (
    publicationPreflight.previewAlias !== PREVIEW_ALIAS ||
    uploadEvidence.previewAlias !== PREVIEW_ALIAS ||
    publicationPreflight.workersDev !== false ||
    publicationPreflight.previewUrls !== true ||
    uploadEvidence.productionDeployment !== 'not-performed' ||
    uploadEvidence.productionDnsOrTraffic !== 'unchanged' ||
    publicationPreflight.productionSupabase !== 'not-bound' ||
    publicationPreflight.productionDnsOrTraffic !== 'unchanged-before-upload' ||
    !Array.isArray(publicationPreflight.routes) || publicationPreflight.routes.length !== 0 ||
    !Array.isArray(publicationPreflight.customDomains) || publicationPreflight.customDomains.length !== 0 ||
    !Array.isArray(resourceProof.customDomains) || resourceProof.customDomains.length !== 0 ||
    !Array.isArray(resourceProof.workerRoutes) || resourceProof.workerRoutes.length !== 0 ||
    resourceProof.workersDev !== false ||
    resourceProof.previewUrls !== true ||
    resourceProof.productionAssociation !== false
  ) throw new Error('LEO563_PREVIEW_MANAGED_EVIDENCE_ISOLATION_FAILED')

  const workerVersionId = requireManagedVersionId(uploadEvidence.workerVersionId)
  if (resourceProof.workerVersionId !== workerVersionId) {
    throw new Error('LEO563_PREVIEW_MANAGED_EVIDENCE_VERSION_IDENTITY_FAILED')
  }
  requireManagedWorkersDevUrl(uploadEvidence.previewUrl, 'PREVIEW')
  requireManagedWorkersDevUrl(uploadEvidence.versionPreviewUrl, 'VERSION_PREVIEW')

  const digestFields = ['publicArtifactSha256', 'workerArtifactSha256', 'staticAssetsSha256', 'previewConfigSha256']
  for (const field of digestFields) {
    const preflightDigest = requireManagedSha256(publicationPreflight[field])
    const uploadDigest = requireManagedSha256(uploadEvidence[field])
    if (preflightDigest !== uploadDigest) throw new Error('LEO563_PREVIEW_MANAGED_EVIDENCE_DIGEST_MISMATCH')
  }

  const bindings = Array.isArray(resourceProof.bindings)
    ? resourceProof.bindings.map((binding) => ({ name: binding?.name, type: binding?.type }))
    : null
  if (!bindings) throw new Error('LEO563_PREVIEW_MANAGED_EVIDENCE_BINDING_STATE_INVALID')
  try {
    assertSafePublishedBindings(bindings)
  } catch {
    throw new Error('LEO563_PREVIEW_MANAGED_EVIDENCE_BINDING_STATE_INVALID')
  }

  const resourceBootstrapVersionId = resourceProof.bootstrapVersionId === undefined || resourceProof.bootstrapVersionId === null
    ? null
    : requireManagedVersionId(resourceProof.bootstrapVersionId, 'LEO563_PREVIEW_MANAGED_EVIDENCE_BOOTSTRAP_VERSION_INVALID')
  const bootstrapVersionId = expectedBootstrapVersionId === null
    ? resourceBootstrapVersionId
    : requireManagedVersionId(expectedBootstrapVersionId, 'LEO563_PREVIEW_MANAGED_EVIDENCE_BOOTSTRAP_VERSION_INVALID')
  if (resourceBootstrapVersionId !== null && bootstrapVersionId !== resourceBootstrapVersionId) {
    throw new Error('LEO563_PREVIEW_MANAGED_EVIDENCE_BOOTSTRAP_VERSION_INVALID')
  }
  if (bootstrapVersionId === workerVersionId) {
    throw new Error('LEO563_PREVIEW_MANAGED_EVIDENCE_BOOTSTRAP_VERSION_INVALID')
  }

  let priorVersionIds = [workerVersionId]
  let priorDeployments = null
  let deploymentIdentityBasis = 'prior-version-evidence'
  if (resourceProof.contract === 'dongphugia:cloudflare-preview-resource-proof:v2') {
    priorVersionIds = collectRemoteVersionIds(
      { items: resourceProof.versionIds?.map((id) => ({ id })) },
      'LEO563_PREVIEW_MANAGED_EVIDENCE_VERSION_STATE_INVALID',
    )
    if (!priorVersionIds.includes(workerVersionId)) throw new Error('LEO563_PREVIEW_MANAGED_EVIDENCE_VERSION_IDENTITY_FAILED')
    priorDeployments = normalizeManagedDeployments(
      resourceProof.deployments,
      'LEO563_PREVIEW_MANAGED_EVIDENCE_DEPLOYMENT_STATE_INVALID',
    )
    if (!priorDeployments?.length) throw new Error('LEO563_PREVIEW_MANAGED_EVIDENCE_DEPLOYMENT_STATE_INVALID')
    if (!sameJson(resourceProof.deploymentIds, remoteDeploymentIds(priorDeployments))) {
      throw new Error('LEO563_PREVIEW_MANAGED_EVIDENCE_DEPLOYMENT_ID_INVALID')
    }
    deploymentIdentityBasis = 'prior-resource-proof'
  }
  if (bootstrapVersionId) priorVersionIds = [...new Set([...priorVersionIds, bootstrapVersionId])]

  return normalizeManagedPublicationProof({
    contract: 'dongphugia:cloudflare-managed-preview-evidence:v1',
    sourceCommit,
    pullRequest: PULL_REQUEST,
    workflowRunId: String(publicationPreflight.workflowRunId),
    workerName: WORKER_NAME,
    previewAlias: PREVIEW_ALIAS,
    workerVersionId,
    bootstrapVersionId,
    workersDev: false,
    previewUrls: true,
    customDomains: [],
    workerRoutes: [],
    productionAssociation: false,
    priorVersionIds,
    priorDeployments,
    priorDeploymentIds: priorDeployments ? remoteDeploymentIds(priorDeployments) : null,
    deploymentIdentityBasis,
    publicArtifactSha256: publicationPreflight.publicArtifactSha256,
    workerArtifactSha256: publicationPreflight.workerArtifactSha256,
    staticAssetsSha256: publicationPreflight.staticAssetsSha256,
    previewConfigSha256: publicationPreflight.previewConfigSha256,
    bindings,
  })
}

function assertManagedActiveState({ versionIds, deploymentRecords, managedPublication }) {
  if (!sameJson(versionIds, managedPublication.priorVersionIds)) {
    throw new Error('LEO563_PREVIEW_MANAGED_VERSION_STATE_UNEXPECTED')
  }
  if (managedPublication.priorDeployments !== null) {
    if (!sameJson(deploymentRecords, managedPublication.priorDeployments)) {
      throw new Error('LEO563_PREVIEW_MANAGED_DEPLOYMENT_STATE_UNEXPECTED')
    }
    return
  }

  if (deploymentRecords.length !== 1) {
    throw new Error('LEO563_PREVIEW_MANAGED_DEPLOYMENT_STATE_UNEXPECTED')
  }
  const deployment = deploymentRecords[0]
  const activeVersionId = managedPublication.bootstrapVersionId ?? managedPublication.workerVersionId
  if (
    deployment.versions.length !== 1 ||
    deployment.versions[0].versionId !== activeVersionId ||
    deployment.versions[0].percentage !== 100
  ) throw new Error('LEO563_PREVIEW_MANAGED_DEPLOYMENT_STATE_UNEXPECTED')
}

function normalizePrePublicationState(state) {
  if (!state || state.workerName !== WORKER_NAME || !['ABSENT', 'INCOMPLETE', 'MANAGED_ACTIVE_PREVIEW'].includes(state.state)) {
    throw new Error('LEO563_PREVIEW_PUBLICATION_BASELINE_UNKNOWN')
  }
  if (
    state.reconciliationAllowed !== true ||
    state.workerAbsent !== (state.state === 'ABSENT') ||
    state.bootstrapRequired !== (state.state === 'ABSENT') ||
    !Array.isArray(state.customDomains) || state.customDomains.length !== 0 ||
    !Array.isArray(state.workerRoutes) || state.workerRoutes.length !== 0 ||
    !Array.isArray(state.bindings) ||
    !Array.isArray(state.versionIds) ||
    !Array.isArray(state.deployments) ||
    !Array.isArray(state.deploymentIds) ||
    state.versionCount !== state.versionIds.length ||
    !sameJson(state.deploymentIds, remoteDeploymentIds(state.deployments))
  ) throw new Error('LEO563_PREVIEW_PUBLICATION_BASELINE_UNSAFE')

  if (state.state === 'MANAGED_ACTIVE_PREVIEW') {
    const managedPublication = normalizeManagedPublicationProof(state.managedPublication)
    if (
      state.workerAbsent !== false ||
      state.bootstrapRequired !== false ||
      state.activeDeployment !== true ||
      state.versionIds.length === 0 ||
      state.deployments.length === 0
    ) throw new Error('LEO563_PREVIEW_PUBLICATION_BASELINE_UNSAFE')
    try {
      assertSafePublishedBindings(state.bindings)
      assertManagedActiveState({
        versionIds: [...state.versionIds].sort(),
        deploymentRecords: state.deployments,
        managedPublication,
      })
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('LEO563_PREVIEW_MANAGED_')) throw error
      throw new Error('LEO563_PREVIEW_PUBLICATION_BASELINE_UNSAFE')
    }
    return {
      state: state.state,
      versionIds: [...state.versionIds].sort(),
      deployments: state.deployments,
      deploymentIds: [...state.deploymentIds],
      activeDeployment: true,
      bindings: state.bindings,
      customDomains: [...state.customDomains],
      workerRoutes: [...state.workerRoutes],
      managedPublication,
    }
  }

  if (
    state.activeDeployment !== false ||
    state.versionIds.length !== 0 ||
    state.deployments.length !== 0 ||
    state.deploymentIds.length !== 0 ||
    state.bindings.length !== 0
  ) throw new Error('LEO563_PREVIEW_PUBLICATION_BASELINE_UNSAFE')
  return {
    state: state.state,
    versionIds: [],
    deployments: [],
    deploymentIds: [],
    activeDeployment: false,
    bindings: [],
    customDomains: [...state.customDomains],
    workerRoutes: [...state.workerRoutes],
  }
}

function normalizeExpectedPublication(proof) {
  if (
    !proof ||
    proof.contract !== 'dongphugia:cloudflare-preview-resource-proof:v2' ||
    proof.workerName !== WORKER_NAME ||
    typeof proof.workerVersionId !== 'string' ||
    !/^[0-9a-f-]{32,64}$/i.test(proof.workerVersionId) ||
    !Array.isArray(proof.versionIds) ||
    !Array.isArray(proof.deployments) ||
    !Array.isArray(proof.deploymentIds)
  ) throw new Error('LEO563_PREVIEW_POST_FAILURE_EXPECTED_PROOF_INVALID')
  const versionIds = proof.versionIds.map((versionId) => {
    if (typeof versionId !== 'string' || !/^[0-9a-f-]{32,64}$/i.test(versionId)) {
      throw new Error('LEO563_PREVIEW_POST_FAILURE_EXPECTED_PROOF_INVALID')
    }
    return versionId
  }).sort()
  const deployments = proof.deployments.map((deployment) => ({
    id: deployment?.id,
    strategy: deployment?.strategy,
    versions: Array.isArray(deployment?.versions)
      ? deployment.versions.map((version) => ({
        version_id: version?.versionId,
        percentage: version?.percentage,
      }))
      : deployment?.versions,
  }))
  const normalizedDeployments = collectRemoteDeployments(
    { deployments },
    'LEO563_PREVIEW_POST_FAILURE_EXPECTED_PROOF_INVALID',
  )
  if (!versionIds.includes(proof.workerVersionId)) throw new Error('LEO563_PREVIEW_POST_FAILURE_EXPECTED_PROOF_INVALID')
  if (!sameJson(proof.deploymentIds, remoteDeploymentIds(normalizedDeployments))) {
    throw new Error('LEO563_PREVIEW_POST_FAILURE_EXPECTED_PROOF_INVALID')
  }
  const baseline = normalizePrePublicationState(proof.publicationBaseline)
  if (baseline.state === 'MANAGED_ACTIVE_PREVIEW') {
    const expectedVersionIds = [...new Set([...baseline.versionIds, proof.workerVersionId])].sort()
    if (!sameJson(versionIds, expectedVersionIds)) throw new Error('LEO563_PREVIEW_POST_FAILURE_EXPECTED_PROOF_INVALID')
    if (!sameJson(normalizedDeployments, baseline.deployments)) {
      throw new Error('LEO563_PREVIEW_POST_FAILURE_EXPECTED_PROOF_INVALID')
    }
  } else if (baseline.state === 'INCOMPLETE' && normalizedDeployments.length !== 0) {
    throw new Error('LEO563_PREVIEW_POST_FAILURE_EXPECTED_PROOF_INVALID')
  }
  if (
    proof.workersDev !== false ||
    proof.previewUrls !== true ||
    !Array.isArray(proof.customDomains) || proof.customDomains.length !== 0 ||
    !Array.isArray(proof.workerRoutes) || proof.workerRoutes.length !== 0 ||
    proof.productionAssociation !== false
  ) throw new Error('LEO563_PREVIEW_POST_FAILURE_EXPECTED_PROOF_INVALID')
  const bootstrapVersionId = proof.bootstrapVersionId === undefined || proof.bootstrapVersionId === null
    ? null
    : requireManagedVersionId(proof.bootstrapVersionId, 'LEO563_PREVIEW_POST_FAILURE_EXPECTED_PROOF_INVALID')
  if (bootstrapVersionId && baseline.state !== 'ABSENT') {
    throw new Error('LEO563_PREVIEW_POST_FAILURE_EXPECTED_PROOF_INVALID')
  }
  return { workerVersionId: proof.workerVersionId, versionIds, deployments: normalizedDeployments, baseline, bootstrapVersionId }
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

export async function inspectRemoteResourceState({ accountId, apiToken, expectedPublication = null, managedPublication = null, fetchImpl = fetch }) {
  if (!accountId || !apiToken) throw new Error('LEO563_PREVIEW_REMOTE_PREFLIGHT_CREDENTIALS_MISSING')
  if (expectedPublication && managedPublication) throw new Error('LEO563_PREVIEW_REMOTE_PREFLIGHT_MODES_CONFLICT')
  const managed = managedPublication ? normalizeManagedPublicationProof(managedPublication) : null
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
    if (expectedPublication) throw new Error('LEO563_PREVIEW_POST_FAILURE_WORKER_MISSING')
    if (managed) throw new Error('LEO563_PREVIEW_MANAGED_WORKER_MISSING')
    return {
      contract: 'dongphugia:cloudflare-preview-remote-preflight:v2',
      workerName: WORKER_NAME,
      state: 'ABSENT',
      workerAbsent: true,
      bootstrapRequired: true,
      reconciliationAllowed: true,
      activeDeployment: false,
      versionCount: 0,
      versionIds: [],
      deployments: [],
      deploymentIds: [],
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
  const versionIds = collectRemoteVersionIds(versions)
  const deploymentRecords = collectRemoteDeployments(deployments)

  if (workerRoutes.length) throw new Error('LEO563_PREVIEW_REMOTE_ROUTE_STATE_FORBIDDEN')
  if (managed) {
    if (subdomain.enabled !== false || subdomain.previews_enabled !== true) {
      throw new Error('LEO563_PREVIEW_MANAGED_SUBDOMAIN_STATE_UNEXPECTED')
    }
    try {
      assertSafePublishedBindings(bindings)
    } catch {
      throw new Error('LEO563_PREVIEW_MANAGED_BINDING_STATE_UNEXPECTED')
    }
    assertManagedActiveState({
      versionIds,
      deploymentRecords,
      managedPublication: managed,
    })
    return {
      contract: 'dongphugia:cloudflare-preview-remote-preflight:v2',
      workerName: WORKER_NAME,
      state: 'MANAGED_ACTIVE_PREVIEW',
      workerAbsent: false,
      bootstrapRequired: false,
      reconciliationAllowed: true,
      activeDeployment: true,
      versionCount: versionIds.length,
      versionIds,
      deployments: deploymentRecords,
      deploymentIds: remoteDeploymentIds(deploymentRecords),
      customDomains,
      workerRoutes,
      bindings,
      subdomain: {
        workersDevEnabled: subdomain.enabled,
        previewUrlsEnabled: subdomain.previews_enabled,
      },
      managedPublication: managed,
      calls,
    }
  }
  if (!expectedPublication) {
    if (deploymentRecords.length) throw new Error('LEO563_PREVIEW_REMOTE_ACTIVE_DEPLOYMENT_FORBIDDEN')
    if (versionIds.length) throw new Error('LEO563_PREVIEW_REMOTE_VERSION_STATE_FORBIDDEN')
    if (bindings.length) throw new Error('LEO563_PREVIEW_REMOTE_BINDING_STATE_FORBIDDEN')
    if (subdomain.enabled !== false) throw new Error('LEO563_PREVIEW_REMOTE_ACTIVE_SUBDOMAIN_FORBIDDEN')
    if (subdomain.previews_enabled !== false) throw new Error('LEO563_PREVIEW_REMOTE_PREVIEW_URL_STATE_FORBIDDEN')
  } else {
    const expected = normalizeExpectedPublication(expectedPublication)
    if (subdomain.enabled !== false || subdomain.previews_enabled !== true) {
      throw new Error('LEO563_PREVIEW_POST_FAILURE_SUBDOMAIN_FAILED')
    }
    assertSafePublishedBindings(bindings)
    if (!versionIds.includes(expected.workerVersionId) || !sameJson(versionIds, expected.versionIds)) {
      throw new Error('LEO563_PREVIEW_POST_FAILURE_VERSION_STATE_UNEXPECTED')
    }
    if (!sameJson(deploymentRecords, expected.deployments)) {
      throw new Error('LEO563_PREVIEW_POST_FAILURE_DEPLOYMENT_STATE_UNEXPECTED')
    }
    return {
      contract: 'dongphugia:cloudflare-preview-post-failure-state:v1',
      workerName: WORKER_NAME,
      state: 'PUBLISHED_ATTEMPT',
      workerAbsent: false,
      bootstrapRequired: false,
      reconciliationAllowed: false,
      activeDeployment: deploymentRecords.length > 0,
      versionCount: versionIds.length,
      versionIds,
      deployments: deploymentRecords,
      deploymentIds: remoteDeploymentIds(deploymentRecords),
      customDomains,
      workerRoutes,
      bindings,
      subdomain: {
        workersDevEnabled: subdomain.enabled,
        previewUrlsEnabled: subdomain.previews_enabled,
      },
      expectedWorkerVersionId: expected.workerVersionId,
      inspection: 'exact-current-publication-attempt',
      calls,
    }
  }

  return {
    contract: 'dongphugia:cloudflare-preview-remote-preflight:v2',
    workerName: WORKER_NAME,
    state: 'INCOMPLETE',
    workerAbsent: false,
    bootstrapRequired: false,
    reconciliationAllowed: true,
    activeDeployment: false,
    versionCount: 0,
    versionIds: [],
    deployments: [],
    deploymentIds: [],
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

export async function inspectPublishedResource({ accountId, apiToken, versionId, beforeState = null, bootstrapVersionId = null, fetchImpl = fetch }) {
  if (!accountId || !apiToken) throw new Error('LEO563_PREVIEW_INSPECTION_CREDENTIALS_MISSING')
  if (!/^[0-9a-f-]{32,64}$/i.test(versionId ?? '')) throw new Error('LEO563_PREVIEW_INSPECTION_VERSION_INVALID')
  if (bootstrapVersionId !== null && !/^[0-9a-f-]{32,64}$/i.test(bootstrapVersionId ?? '')) {
    throw new Error('LEO563_PREVIEW_INSPECTION_BOOTSTRAP_VERSION_INVALID')
  }
  const baseline = beforeState ? normalizePrePublicationState(beforeState) : null
  if (baseline && baseline.state !== 'ABSENT' && bootstrapVersionId) {
    throw new Error('LEO563_PREVIEW_INSPECTION_UNEXPECTED_BOOTSTRAP_VERSION')
  }
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
  const [scripts, settings, subdomain, domains, version, versions, deployments] = await Promise.all([
    get('workers.scripts.list', `/accounts/${accountId}/workers/scripts`),
    get('workers.settings.get', `/accounts/${accountId}/workers/scripts/${encodedWorker}/settings`),
    get('workers.subdomain.get', `/accounts/${accountId}/workers/scripts/${encodedWorker}/subdomain`),
    get('workers.domains.list', `/accounts/${accountId}/workers/domains?service=${encodedWorker}`),
    get('workers.version.get', `/accounts/${accountId}/workers/scripts/${encodedWorker}/versions/${encodeURIComponent(versionId)}`),
    get('workers.versions.list', `/accounts/${accountId}/workers/scripts/${encodedWorker}/versions`),
    get('workers.deployments.list', `/accounts/${accountId}/workers/scripts/${encodedWorker}/deployments`),
  ])

  if (!Array.isArray(scripts) || !scripts.some((script) => script?.id === WORKER_NAME)) {
    throw new Error('LEO563_PREVIEW_INSPECTION_WORKER_FAILED')
  }
  if (subdomain?.enabled !== false || subdomain?.previews_enabled !== true) {
    throw new Error('LEO563_PREVIEW_INSPECTION_SUBDOMAIN_FAILED')
  }
  const worker = scripts.find((script) => script?.id === WORKER_NAME)
  const workerRoutes = collectWorkerRoutes(worker)
  if (workerRoutes.length !== 0) throw new Error('LEO563_PREVIEW_INSPECTION_ROUTE_FAILED')
  const customDomains = Array.isArray(domains)
    ? domains.filter((domain) => domain?.service === WORKER_NAME).map((domain) => domain?.hostname).filter((value) => typeof value === 'string').sort()
    : []
  if (customDomains.length !== 0) throw new Error('LEO563_PREVIEW_INSPECTION_CUSTOM_DOMAIN_FAILED')
  if (version?.id !== versionId) throw new Error('LEO563_PREVIEW_INSPECTION_VERSION_ID_FAILED')

  const bindings = collectWorkerBindings(settings)
  assertSafePublishedBindings(bindings)
  const versionIds = collectRemoteVersionIds(versions, 'LEO563_PREVIEW_INSPECTION_VERSION_STATE_UNKNOWN')
  const deploymentRecords = collectRemoteDeployments(deployments, 'LEO563_PREVIEW_INSPECTION_DEPLOYMENT_STATE_UNKNOWN')
  const allowedVersionIds = new Set([
    versionId,
    ...(bootstrapVersionId ? [bootstrapVersionId] : []),
    ...(baseline?.versionIds ?? []),
  ])
  const expectedVersionIds = [...allowedVersionIds].sort()
  if (!sameJson(versionIds, expectedVersionIds)) {
    throw new Error('LEO563_PREVIEW_INSPECTION_VERSION_STATE_UNEXPECTED')
  }
  if (deploymentRecords.some((deployment) => deployment.versions.some((entry) => !allowedVersionIds.has(entry.versionId)))) {
    throw new Error('LEO563_PREVIEW_INSPECTION_DEPLOYMENT_STATE_UNEXPECTED')
  }
  if (baseline?.state === 'MANAGED_ACTIVE_PREVIEW' && !sameJson(deploymentRecords, baseline.deployments)) {
    throw new Error('LEO563_PREVIEW_INSPECTION_MANAGED_DEPLOYMENT_CHANGED')
  }
  if (baseline?.state === 'INCOMPLETE' && deploymentRecords.length !== 0) {
    throw new Error('LEO563_PREVIEW_INSPECTION_ACTIVE_DEPLOYMENT_UNEXPECTED')
  }
  if (!baseline && deploymentRecords.length !== 0) {
    throw new Error('LEO563_PREVIEW_INSPECTION_BASELINE_REQUIRED')
  }

  return {
    contract: 'dongphugia:cloudflare-preview-resource-proof:v2',
    workerName: WORKER_NAME,
    workerVersionId: versionId,
    workersDev: false,
    previewUrls: true,
    customDomains,
    workerRoutes,
    workerRoutesBasis: 'workers.scripts.list-and-workers.domains.list',
    bindings,
    versionIds,
    deployments: deploymentRecords,
    deploymentIds: remoteDeploymentIds(deploymentRecords),
    bootstrapVersionId,
    publicationBaseline: baseline
      ? {
        workerName: WORKER_NAME,
        state: baseline.state,
        workerAbsent: baseline.state === 'ABSENT',
        bootstrapRequired: baseline.state === 'ABSENT',
        reconciliationAllowed: true,
        activeDeployment: baseline.activeDeployment,
        versionCount: baseline.versionIds.length,
        versionIds: baseline.versionIds,
        deployments: baseline.deployments,
        deploymentIds: baseline.deploymentIds,
        customDomains: baseline.customDomains,
        workerRoutes: baseline.workerRoutes,
        bindings: baseline.bindings,
        ...(baseline.managedPublication ? { managedPublication: baseline.managedPublication } : {}),
      }
      : null,
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
  if (mode === 'validate-managed-publication') {
    const evidence = validateManagedPublicationEvidence({
      publicationPreflight: JSON.parse(await readFile(path.resolve(args['publication-preflight'] || ''), 'utf8')),
      uploadEvidence: JSON.parse(await readFile(path.resolve(args.upload || ''), 'utf8')),
      resourceProof: JSON.parse(await readFile(path.resolve(args['resource-proof'] || ''), 'utf8')),
      expectedWorkflowRunId: args['expected-workflow-run-id'] ?? null,
      bootstrapVersionId: args['bootstrap-version-id'] ?? null,
    })
    await writeFile(path.resolve(args.output || ''), `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 })
    process.stdout.write(JSON.stringify({
      workerName: evidence.workerName,
      sourceCommit: evidence.sourceCommit,
      workerVersionId: evidence.workerVersionId,
      deploymentIdentityBasis: evidence.deploymentIdentityBasis,
    }) + '\n')
    return
  }
  if (mode === 'inspect-resource') {
    const upload = JSON.parse(await readFile(path.resolve(args.upload || ''), 'utf8'))
    const beforeState = JSON.parse(await readFile(path.resolve(args.preflight || ''), 'utf8'))
    const bootstrapLog = args['bootstrap-log']
      ? await readFile(path.resolve(args['bootstrap-log']), 'utf8').catch(() => '')
      : ''
    const bootstrapVersionId = bootstrapLog.trim() ? parseWranglerDeploy(bootstrapLog).bootstrapVersionId : null
    const evidence = await inspectPublishedResource({
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      apiToken: process.env.CLOUDFLARE_API_TOKEN,
      versionId: upload.workerVersionId,
      beforeState,
      bootstrapVersionId,
    })
    if (upload.workerName !== evidence.workerName) throw new Error('LEO563_PREVIEW_INSPECTION_WORKER_FAILED')
    await writeFile(path.resolve(args.output || ''), `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 })
    process.stdout.write(`${JSON.stringify({ workerName: evidence.workerName, workerVersionId: evidence.workerVersionId, customDomains: evidence.customDomains, bindings: evidence.bindings })}\n`)
    return
  }
  if (mode === 'inspect-resource-state') {
    const expectedProof = args['expected-resource-proof']
      ? JSON.parse(await readFile(path.resolve(args['expected-resource-proof']), 'utf8'))
      : null
    const managedPublication = args['managed-publication-proof']
      ? JSON.parse(await readFile(path.resolve(args['managed-publication-proof']), 'utf8'))
      : null
    if (expectedProof && args.upload) {
      const upload = JSON.parse(await readFile(path.resolve(args.upload), 'utf8'))
      if (upload.workerName !== WORKER_NAME || upload.workerVersionId !== expectedProof.workerVersionId) {
        throw new Error('LEO563_PREVIEW_POST_FAILURE_UPLOAD_IDENTITY_FAILED')
      }
    }
    const evidence = await inspectRemoteResourceState({
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      apiToken: process.env.CLOUDFLARE_API_TOKEN,
      expectedPublication: expectedProof,
      managedPublication,
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
  WORKER_NAME,
}
