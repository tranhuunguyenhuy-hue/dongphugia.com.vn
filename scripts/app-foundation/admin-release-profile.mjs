// Isolated preparation only: this module is not wired into a publisher.
import { createHash } from 'node:crypto'
import { lstat, readFile } from 'node:fs/promises'
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
    || manifest.entrypoint !== 'worker.mjs'
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
  const workerPath = path.join(root, 'worker.mjs')
  const stat = await lstat(workerPath)
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('ADMIN_RELEASE_ENTRYPOINT_INVALID')
  const assetsStat = await lstat(path.join(root, 'assets'))
  if (!assetsStat.isDirectory() || assetsStat.isSymbolicLink()) throw new Error('ADMIN_RELEASE_ASSETS_INVALID')
  const bundleSha256 = createHash('sha256').update(await readFile(workerPath)).digest('hex')
  const { sha256: assetsSha256 } = await digestEnvironmentWorkerArtifact(path.join(root, 'assets'))
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
