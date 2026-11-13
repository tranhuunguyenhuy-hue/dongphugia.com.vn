// Isolated preparation only: this module is not wired into a publisher.
import { lstat, readdir } from 'node:fs/promises'
import path from 'node:path'
import { digestEnvironmentWorkerArtifact } from './environment-worker-artifact-digest.mjs'
const SHA = /^[a-f0-9]{40}$/
const SHA256 = /^[a-f0-9]{64}$/
const ID = /^[a-f0-9]{32}$/
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const keysAre = (value, keys) => isObject(value)
  && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort())

export function validateAdminReleaseProfile(manifest, { sourceSha, hyperdriveId, bundleSha256, assetsSha256 }) {
  if (!SHA.test(sourceSha || '') || !ID.test(hyperdriveId || '') || !SHA256.test(bundleSha256 || '') || !SHA256.test(assetsSha256 || '')) throw new Error('ADMIN_RELEASE_EXPECTED_IDENTITY_INVALID')
  if (!keysAre(manifest, ['contract', 'sourceSha', 'entrypoint', 'routes', 'bindings', 'vars', 'schema', 'bundleSha256', 'assetsSha256'])
    || manifest.contract !== 'dpg:combined-public-admin-worker:v1'
    || manifest.sourceSha !== sourceSha
    || manifest.entrypoint !== 'server/index.mjs'
    || manifest.schema !== 'dpg_app'
    || manifest.bundleSha256 !== bundleSha256 || manifest.assetsSha256 !== assetsSha256
    || JSON.stringify(manifest.routes) !== JSON.stringify({ admin: '/admin', public: '/' })
    || !keysAre(manifest.bindings, ['ASSETS', 'HYPERDRIVE_ADMIN_NO_CACHE'])
    || JSON.stringify(manifest.bindings.ASSETS) !== JSON.stringify({ type: 'assets' })
    || JSON.stringify(manifest.bindings.HYPERDRIVE_ADMIN_NO_CACHE) !== JSON.stringify({ type: 'hyperdrive' })
    || !keysAre(manifest.vars, ['RUNTIME_ROLE', 'WRITE_FREEZE_MODE', 'PRISMA_REQUEST_SCOPE_REQUIRED'])
    || manifest.vars.RUNTIME_ROLE !== 'production'
    || manifest.vars.WRITE_FREEZE_MODE !== 'false'
    || manifest.vars.PRISMA_REQUEST_SCOPE_REQUIRED !== 'true') {
    throw new Error('ADMIN_RELEASE_PROFILE_INVALID')
  }
  return true
}

export async function verifyAdminReleaseArtifact(root, manifest, { sourceSha, hyperdriveId }) {
  const rootEntries = await readdir(root, { withFileTypes: true })
  if (rootEntries.length !== 2 || rootEntries.some((entry) => !['server', 'client'].includes(entry.name) || !entry.isDirectory() || entry.isSymbolicLink())) {
    throw new Error('ADMIN_RELEASE_ROOT_CONTENT_INVALID')
  }
  const workerPath = path.join(root, 'server', 'index.mjs')
  const stat = await lstat(workerPath)
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('ADMIN_RELEASE_ENTRYPOINT_INVALID')
  for (const directory of ['server', 'client']) {
    const directoryStat = await lstat(path.join(root, directory))
    if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) throw new Error('ADMIN_RELEASE_DIRECTORY_INVALID')
  }
  async function rejectCandidateWranglerConfig(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error('ENVIRONMENT_WORKER_ARTIFACT_SYMLINK_FORBIDDEN')
      if (/^wrangler\.(jsonc?|toml)$/i.test(entry.name)) throw new Error('ADMIN_RELEASE_CANDIDATE_CONFIG_FORBIDDEN')
      if (entry.isDirectory()) await rejectCandidateWranglerConfig(path.join(dir, entry.name))
    }
  }
  await Promise.all(['server', 'client'].map((dir) => rejectCandidateWranglerConfig(path.join(root, dir))))
  const [{ sha256: bundleSha256 }, { sha256: assetsSha256 }] = await Promise.all(
    ['server', 'client'].map((dir) => digestEnvironmentWorkerArtifact(path.join(root, dir))),
  )
  return validateAdminReleaseProfile(manifest, { sourceSha, hyperdriveId, bundleSha256, assetsSha256 })
}

// Target identity and remaining deployment settings must be supplied by a
// separately reviewed publisher; never copy arbitrary candidate configuration.
export function reconstructAdminCapabilities(hyperdriveId) {
  if (!ID.test(hyperdriveId || '')) throw new Error('ADMIN_RELEASE_EXPECTED_IDENTITY_INVALID')
  return {
    hyperdrive: [{ binding: 'HYPERDRIVE_ADMIN_NO_CACHE', id: hyperdriveId }],
    vars: { RUNTIME_ROLE: 'production', WRITE_FREEZE_MODE: 'false', PRISMA_REQUEST_SCOPE_REQUIRED: 'true' },
  }
}
