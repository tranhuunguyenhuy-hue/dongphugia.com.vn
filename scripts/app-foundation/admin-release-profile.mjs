// Preparation only; not connected to a deployment workflow.
import { createHash } from 'node:crypto'
import { lstat, readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { digestEnvironmentWorkerArtifact } from './environment-worker-artifact-digest.mjs'

const SHA = /^[a-f0-9]{40}$/
const SHA256 = /^[a-f0-9]{64}$/
const ID = /^[a-f0-9]{32}$/
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const keysAre = (value, keys) => isObject(value) && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort())
const expectedHosts = { admin: '/admin', public: ['dongphugia.vn', 'www.dongphugia.vn'] }
const expectedVars = { APP_ENV: 'production', APP_ORIGIN: 'https://www.dongphugia.vn', APP_BUILD_TARGET: 'public', RUNTIME_ROLE: 'production', WRITE_FREEZE_MODE: 'false', PRISMA_REQUEST_SCOPE_REQUIRED: 'true' }
const expectedBindings = { ASSETS: { type: 'assets' }, HYPERDRIVE_ADMIN_NO_CACHE: { type: 'hyperdrive', cache: 'off' } }

export function validateAdminReleaseProfile(manifest, { sourceSha, hashes }) {
  if (!SHA.test(sourceSha || '') || !keysAre(hashes, ['worker', 'publicServer', 'adminServer', 'assets']) || Object.values(hashes).some((value) => !SHA256.test(value || ''))) throw new Error('ADMIN_RELEASE_EXPECTED_IDENTITY_INVALID')
  if (!keysAre(manifest, ['contract', 'sourceSha', 'entrypoint', 'hosts', 'schema', 'bindings', 'vars', 'hashes'])
    || manifest.contract !== 'dpg:combined-public-admin-worker:v1' || manifest.sourceSha !== sourceSha
    || manifest.entrypoint !== 'combined/worker.mjs' || manifest.schema !== 'dpg_app'
    || JSON.stringify(manifest.hosts) !== JSON.stringify(expectedHosts)
    || JSON.stringify(manifest.bindings) !== JSON.stringify(expectedBindings)
    || JSON.stringify(manifest.vars) !== JSON.stringify(expectedVars)
    || !keysAre(manifest.hashes, ['worker', 'publicServer', 'adminServer', 'assets'])
    || Object.keys(hashes).some((key) => manifest.hashes[key] !== hashes[key])) throw new Error('ADMIN_RELEASE_PROFILE_INVALID')
  return true
}

async function inspectTree(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error('ENVIRONMENT_WORKER_ARTIFACT_SYMLINK_FORBIDDEN')
    if (/^wrangler\.(jsonc?|toml)$/i.test(entry.name)) throw new Error('ADMIN_RELEASE_CANDIDATE_CONFIG_FORBIDDEN')
    if (/^(?:\.env(?:\..*)?|\.dev\.vars(?:\..*)?)$/i.test(entry.name)) throw new Error('ADMIN_RELEASE_CANDIDATE_CONFIG_FORBIDDEN')
    if (entry.isDirectory()) await inspectTree(path.join(dir, entry.name))
    else if (!entry.isFile()) throw new Error('ADMIN_RELEASE_ENTRY_INVALID')
  }
}

export async function verifyAdminReleaseArtifact(root, manifest, { sourceSha }) {
  const entries = await readdir(root, { withFileTypes: true })
  if (entries.length !== 2 || entries.some((entry) => !['combined', 'manifest.json'].includes(entry.name) || entry.isSymbolicLink()) || !entries.some((entry) => entry.name === 'combined' && entry.isDirectory()) || !entries.some((entry) => entry.name === 'manifest.json' && entry.isFile())) throw new Error('ADMIN_RELEASE_ROOT_CONTENT_INVALID')
  if (JSON.stringify(JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'))) !== JSON.stringify(manifest)) throw new Error('ADMIN_RELEASE_MANIFEST_MISMATCH')
  const combined = path.join(root, 'combined')
  const top = await readdir(combined, { withFileTypes: true })
  if (top.length !== 4 || top.some((entry) => !['worker.mjs', 'public', 'admin', 'assets'].includes(entry.name) || entry.isSymbolicLink())) throw new Error('ADMIN_RELEASE_ROOT_CONTENT_INVALID')
  for (const name of ['public', 'admin']) {
    const contents = await readdir(path.join(combined, name), { withFileTypes: true })
    if (contents.length !== 1 || contents[0].name !== 'server' || !contents[0].isDirectory() || contents[0].isSymbolicLink()) throw new Error('ADMIN_RELEASE_ROOT_CONTENT_INVALID')
  }
  const worker = path.join(combined, 'worker.mjs')
  if (!(await lstat(worker)).isFile()) throw new Error('ADMIN_RELEASE_ENTRYPOINT_INVALID')
  for (const name of ['public/server/index.mjs', 'admin/server/index.mjs']) {
    const entrypoint = await lstat(path.join(combined, name))
    if (!entrypoint.isFile() || entrypoint.isSymbolicLink()) throw new Error('ADMIN_RELEASE_ENTRYPOINT_INVALID')
  }
  const adminAssets = await lstat(path.join(combined, 'assets', 'admin'))
  if (!adminAssets.isDirectory() || adminAssets.isSymbolicLink()) throw new Error('ADMIN_RELEASE_ADMIN_ASSETS_INVALID')
  const dirs = ['public/server', 'admin/server', 'assets'].map((name) => path.join(combined, name))
  await Promise.all(dirs.map(inspectTree))
  const [publicServer, adminServer, assets] = await Promise.all(dirs.map(digestEnvironmentWorkerArtifact))
  const hashes = { worker: createHash('sha256').update(await readFile(worker)).digest('hex'), publicServer: publicServer.sha256, adminServer: adminServer.sha256, assets: assets.sha256 }
  return validateAdminReleaseProfile(manifest, { sourceSha, hashes })
}

// A reviewed caller must verify this ID identifies the intended cache-disabled
// Hyperdrive and must construct all other target settings from trusted policy.
export function reconstructAdminCapabilities(hyperdriveId) {
  if (!ID.test(hyperdriveId || '')) throw new Error('ADMIN_RELEASE_EXPECTED_IDENTITY_INVALID')
  return { main: 'combined/worker.mjs', assets: { directory: 'combined/assets', binding: 'ASSETS', run_worker_first: true }, hyperdrive: [{ binding: 'HYPERDRIVE_ADMIN_NO_CACHE', id: hyperdriveId }], vars: { ...expectedVars } }
}

// A caller must supply independently reviewed target metadata, never values
// chosen by the candidate artifact. This does not query the provider itself.
export function verifyAdminHyperdriveMetadata(config, expected) {
  if (!ID.test(expected?.id || '') || !expected?.host || !expected?.database || expected?.user !== 'dpg_admin_runtime_login') throw new Error('ADMIN_RELEASE_EXPECTED_IDENTITY_INVALID')
  if (!isObject(config) || config.id !== expected.id || config.caching?.disabled !== true
    || config.origin?.host !== expected.host || config.origin?.database !== expected.database
    || config.origin?.user !== expected.user || !['postgres', 'postgresql'].includes(config.origin?.scheme)) {
    throw new Error('ADMIN_RELEASE_HYPERDRIVE_TARGET_INVALID')
  }
  return true
}
