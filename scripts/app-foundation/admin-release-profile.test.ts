import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { digestEnvironmentWorkerArtifact } from './environment-worker-artifact-digest.mjs'
import { reconstructAdminCapabilities, validateAdminReleaseProfile, verifyAdminReleaseArtifact } from './admin-release-profile.mjs'

const sourceSha = 'a'.repeat(40)
const hyperdriveId = 'b'.repeat(32)
const bundleSha256 = 'c'.repeat(64)
const assetsSha256 = 'd'.repeat(64)
const expected = { sourceSha, hyperdriveId, bundleSha256, assetsSha256 }
const valid = () => ({
  contract: 'dpg:combined-public-admin-worker:v1', sourceSha, entrypoint: 'worker.mjs',
  routes: { admin: '/admin', public: '/' }, schema: 'dpg_app',
  bundleSha256, assetsSha256,
  bindings: { ASSETS: { type: 'assets' }, HYPERDRIVE_ADMIN_NO_CACHE: { type: 'hyperdrive' } },
  vars: { RUNTIME_ROLE: 'production', WRITE_FREEZE_MODE: 'false', PRISMA_REQUEST_SCOPE_REQUIRED: 'true' },
})

describe('proposed integrated Admin declaration', () => {
  it('accepts the exact bounded declaration', () => {
    expect(validateAdminReleaseProfile(valid(), expected)).toBe(true)
  })
  it.each([
    ['unknown binding', (m: ReturnType<typeof valid>) => { Object.assign(m.bindings, { EXTRA: { type: 'secret_text' } }) }],
    ['unknown variable', (m: ReturnType<typeof valid>) => { Object.assign(m.vars, { DATABASE_URL: 'x' }) }],
    ['candidate-selected Hyperdrive', (m: ReturnType<typeof valid>) => { Object.assign(m.bindings.HYPERDRIVE_ADMIN_NO_CACHE, { id: 'e'.repeat(32) }) }],
    ['unscoped request', (m: ReturnType<typeof valid>) => { m.vars.PRISMA_REQUEST_SCOPE_REQUIRED = 'false' }],
    ['wrong schema', (m: ReturnType<typeof valid>) => { m.schema = 'public' }],
    ['extra route', (m: ReturnType<typeof valid>) => { Object.assign(m.routes, { other: '/api' }) }],
    ['bad digest', (m: ReturnType<typeof valid>) => { m.bundleSha256 = 'x' }],
    ['wrong source', (m: ReturnType<typeof valid>) => { m.sourceSha = 'f'.repeat(40) }],
    ['extra field', (m: ReturnType<typeof valid>) => { Object.assign(m, { extra: true }) }],
  ])('rejects %s', (_name, mutate) => {
    const manifest = valid()
    mutate(manifest)
    expect(() => validateAdminReleaseProfile(manifest, expected)).toThrow('ADMIN_RELEASE_PROFILE_INVALID')
  })
  it('requires a concrete expected Hyperdrive identity', () => {
    expect(() => validateAdminReleaseProfile(valid(), { ...expected, hyperdriveId: '' })).toThrow('ADMIN_RELEASE_EXPECTED_IDENTITY_INVALID')
  })
  it('reconstructs capabilities from trusted identity only', () => {
    expect(reconstructAdminCapabilities(hyperdriveId).hyperdrive).toEqual([{ binding: 'HYPERDRIVE_ADMIN_NO_CACHE', id: hyperdriveId }])
    expect(() => reconstructAdminCapabilities('')).toThrow('ADMIN_RELEASE_EXPECTED_IDENTITY_INVALID')
  })
  it('recomputes bytes and rejects tampering and symlinks', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'dpg-admin-artifact-'))
    try {
      await mkdir(path.join(root, 'assets'))
      await writeFile(path.join(root, 'worker.mjs'), 'worker')
      await writeFile(path.join(root, 'assets', 'app.js'), 'asset')
      const manifest = valid()
      manifest.bundleSha256 = createHash('sha256').update('worker').digest('hex')
      manifest.assetsSha256 = (await digestEnvironmentWorkerArtifact(path.join(root, 'assets'))).sha256
      expect(await verifyAdminReleaseArtifact(root, manifest, { sourceSha, hyperdriveId })).toBe(true)
      await writeFile(path.join(root, 'worker.mjs'), 'changed')
      await expect(verifyAdminReleaseArtifact(root, manifest, { sourceSha, hyperdriveId })).rejects.toThrow('ADMIN_RELEASE_PROFILE_INVALID')
      await writeFile(path.join(root, 'worker.mjs'), 'worker')
      await symlink('app.js', path.join(root, 'assets', 'alias.js'))
      await expect(verifyAdminReleaseArtifact(root, manifest, { sourceSha, hyperdriveId })).rejects.toThrow('ENVIRONMENT_WORKER_ARTIFACT_SYMLINK_FORBIDDEN')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
