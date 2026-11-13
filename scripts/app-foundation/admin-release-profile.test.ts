import { describe, expect, it } from 'vitest'
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
  contract: 'dpg:combined-public-admin-worker:v1', sourceSha, entrypoint: 'server/index.mjs',
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
      await mkdir(path.join(root, 'server', 'ssr'), { recursive: true })
      await mkdir(path.join(root, 'client'))
      await writeFile(path.join(root, 'server', 'index.mjs'), 'worker')
      await writeFile(path.join(root, 'client', 'app.js'), 'asset')
      const manifest = valid()
      await writeFile(path.join(root, 'server', 'ssr', 'chunk.mjs'), 'chunk')
      manifest.bundleSha256 = (await digestEnvironmentWorkerArtifact(path.join(root, 'server'))).sha256
      manifest.assetsSha256 = (await digestEnvironmentWorkerArtifact(path.join(root, 'client'))).sha256
      expect(await verifyAdminReleaseArtifact(root, manifest, { sourceSha, hyperdriveId })).toBe(true)
      await writeFile(path.join(root, 'untracked.mjs'), 'extra')
      await expect(verifyAdminReleaseArtifact(root, manifest, { sourceSha, hyperdriveId })).rejects.toThrow('ADMIN_RELEASE_ROOT_CONTENT_INVALID')
      await rm(path.join(root, 'untracked.mjs'))
      await writeFile(path.join(root, 'server', 'index.mjs'), 'changed')
      await expect(verifyAdminReleaseArtifact(root, manifest, { sourceSha, hyperdriveId })).rejects.toThrow('ADMIN_RELEASE_PROFILE_INVALID')
      await writeFile(path.join(root, 'server', 'index.mjs'), 'worker')
      await writeFile(path.join(root, 'server', 'ssr', 'chunk.mjs'), 'changed')
      await expect(verifyAdminReleaseArtifact(root, manifest, { sourceSha, hyperdriveId })).rejects.toThrow('ADMIN_RELEASE_PROFILE_INVALID')
      await writeFile(path.join(root, 'server', 'ssr', 'chunk.mjs'), 'chunk')
      await writeFile(path.join(root, 'client', 'app.js'), 'changed')
      await expect(verifyAdminReleaseArtifact(root, manifest, { sourceSha, hyperdriveId })).rejects.toThrow('ADMIN_RELEASE_PROFILE_INVALID')
      await writeFile(path.join(root, 'client', 'app.js'), 'asset')
      await writeFile(path.join(root, 'server', 'wrangler.json'), '{}')
      await expect(verifyAdminReleaseArtifact(root, manifest, { sourceSha, hyperdriveId })).rejects.toThrow('ADMIN_RELEASE_CANDIDATE_CONFIG_FORBIDDEN')
      await rm(path.join(root, 'server', 'wrangler.json'))
      await symlink('app.js', path.join(root, 'client', 'alias.js'))
      await expect(verifyAdminReleaseArtifact(root, manifest, { sourceSha, hyperdriveId })).rejects.toThrow('ENVIRONMENT_WORKER_ARTIFACT_SYMLINK_FORBIDDEN')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
