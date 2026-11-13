import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { digestEnvironmentWorkerArtifact } from './environment-worker-artifact-digest.mjs'
import { reconstructAdminCapabilities, validateAdminReleaseProfile, verifyAdminHyperdriveMetadata, verifyAdminReleaseArtifact } from './admin-release-profile.mjs'
import { prepareAdminRelease } from './prepare-admin-release.mjs'

const sourceSha = 'a'.repeat(40)
const hyperdriveId = 'b'.repeat(32)
const hashes = { worker: 'c'.repeat(64), publicServer: 'd'.repeat(64), adminServer: 'e'.repeat(64), assets: 'f'.repeat(64) }
const valid = () => ({ contract: 'dpg:combined-public-admin-worker:v1', sourceSha, entrypoint: 'combined/worker.mjs', hosts: { public: ['dongphugia.vn', 'www.dongphugia.vn'], adminPath: '/admin' }, schema: 'dpg_app', bindings: { ASSETS: { type: 'assets' }, HYPERDRIVE_ADMIN_NO_CACHE: { type: 'hyperdrive', cache: 'off' } }, vars: { APP_ENV: 'production', APP_ORIGIN: 'https://www.dongphugia.vn', APP_BUILD_TARGET: 'public', RUNTIME_ROLE: 'production', WRITE_FREEZE_MODE: 'false', PRISMA_REQUEST_SCOPE_REQUIRED: 'true' }, hashes: { ...hashes } })

describe('proposed integrated Admin profile', () => {
  it('accepts the exact bounded declaration', () => expect(validateAdminReleaseProfile(valid(), { sourceSha, hashes })).toBe(true))
  it.each([
    ['unknown binding', (m: ReturnType<typeof valid>) => { Object.assign(m.bindings, { EXTRA: { type: 'secret_text' } }) }],
    ['candidate-selected ID', (m: ReturnType<typeof valid>) => { Object.assign(m.bindings.HYPERDRIVE_ADMIN_NO_CACHE, { id: hyperdriveId }) }],
    ['cache enabled', (m: ReturnType<typeof valid>) => { m.bindings.HYPERDRIVE_ADMIN_NO_CACHE.cache = 'on' }],
    ['unknown variable', (m: ReturnType<typeof valid>) => { Object.assign(m.vars, { DATABASE_URL: 'x' }) }],
    ['unscoped request', (m: ReturnType<typeof valid>) => { m.vars.PRISMA_REQUEST_SCOPE_REQUIRED = 'false' }],
    ['wrong schema', (m: ReturnType<typeof valid>) => { m.schema = 'public' }],
    ['wrong host', (m: ReturnType<typeof valid>) => { m.hosts.adminPath = '/other' }],
    ['wrong source', (m: ReturnType<typeof valid>) => { m.sourceSha = 'f'.repeat(40) }],
    ['wrong digest', (m: ReturnType<typeof valid>) => { m.hashes.adminServer = 'f'.repeat(64) }],
    ['extra field', (m: ReturnType<typeof valid>) => { Object.assign(m, { extra: true }) }],
  ])('rejects %s', (_name, mutate) => {
    const manifest = valid(); mutate(manifest)
    expect(() => validateAdminReleaseProfile(manifest, { sourceSha, hashes })).toThrow('ADMIN_RELEASE_PROFILE_INVALID')
  })
  it('constructs capability from reviewed input only', () => {
    expect(reconstructAdminCapabilities(hyperdriveId).hyperdrive).toEqual([{ binding: 'HYPERDRIVE_ADMIN_NO_CACHE', id: hyperdriveId }])
    expect(() => reconstructAdminCapabilities('')).toThrow('ADMIN_RELEASE_EXPECTED_IDENTITY_INVALID')
  })
  it('requires the reviewed Hyperdrive origin and disabled cache', () => {
    const target = { id: hyperdriveId, host: 'db.example.invalid', database: 'postgres', user: 'dpg_admin_runtime_login' }
    const config = { id: hyperdriveId, caching: { disabled: true }, origin: { ...target, scheme: 'postgres' } }
    expect(verifyAdminHyperdriveMetadata(config, target)).toBe(true)
    expect(() => verifyAdminHyperdriveMetadata({ ...config, caching: { disabled: false } }, target)).toThrow('ADMIN_RELEASE_HYPERDRIVE_TARGET_INVALID')
    expect(() => verifyAdminHyperdriveMetadata({ ...config, origin: { ...config.origin, user: 'postgres' } }, target)).toThrow('ADMIN_RELEASE_HYPERDRIVE_TARGET_INVALID')
    expect(() => verifyAdminHyperdriveMetadata(config, { ...target, host: '' })).toThrow('ADMIN_RELEASE_EXPECTED_IDENTITY_INVALID')
  })
  it('hashes all trees, rejects modifications, symlinks and candidate config', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'dpg-admin-artifact-'))
    try {
      const combined = path.join(root, 'combined')
      for (const dir of ['public/server/ssr', 'admin/server/ssr', 'assets/__admin']) await mkdir(path.join(combined, dir), { recursive: true })
      for (const file of ['worker.mjs', 'public/server/index.mjs', 'admin/server/index.mjs', 'public/server/ssr/chunk.mjs', 'admin/server/ssr/chunk.mjs', 'assets/__admin/app.js']) await writeFile(path.join(combined, file), file)
      const manifest = valid()
      manifest.hashes.worker = createHash('sha256').update('worker.mjs').digest('hex')
      for (const [key, dir] of [['publicServer', 'public/server'], ['adminServer', 'admin/server'], ['assets', 'assets']] as const) manifest.hashes[key] = (await digestEnvironmentWorkerArtifact(path.join(combined, dir))).sha256
      await writeFile(path.join(root, 'manifest.json'), JSON.stringify(manifest))
      expect(await verifyAdminReleaseArtifact(root, manifest, { sourceSha })).toBe(true)
      const artifactSha256 = (await digestEnvironmentWorkerArtifact(root)).sha256
      const expectedHyperdrive = { id: hyperdriveId, host: 'db.example.invalid', database: 'postgres', user: 'dpg_admin_runtime_login' }
      const hyperdrive = { id: hyperdriveId, caching: { disabled: true }, origin: { ...expectedHyperdrive, scheme: 'postgres' } }
      const input = { root, sourceSha, artifactSha256, accountId: 'd54f3402b9d112ab64d6135e0e3f1fb1', expectedHyperdrive, hyperdrive }
      const config = await prepareAdminRelease(input)
      expect(config.name).toBe('dongphugia-v1-public-production')
      expect(config.hyperdrive).toEqual([{ binding: 'HYPERDRIVE_ADMIN_NO_CACHE', id: hyperdriveId }])
      await expect(prepareAdminRelease({ ...input, accountId: 'other' })).rejects.toThrow('ADMIN_RELEASE_TRUSTED_IDENTITY_INVALID')
      await expect(prepareAdminRelease({ ...input, artifactSha256: 'a'.repeat(64) })).rejects.toThrow('ADMIN_RELEASE_ARTIFACT_DIGEST_MISMATCH')
      await expect(prepareAdminRelease({ ...input, hyperdrive: { ...hyperdrive, caching: { disabled: false } } })).rejects.toThrow('ADMIN_RELEASE_HYPERDRIVE_TARGET_INVALID')
      for (const file of ['worker.mjs', 'public/server/ssr/chunk.mjs', 'admin/server/ssr/chunk.mjs', 'assets/__admin/app.js']) {
        await writeFile(path.join(combined, file), 'tampered')
        await expect(verifyAdminReleaseArtifact(root, manifest, { sourceSha })).rejects.toThrow('ADMIN_RELEASE_PROFILE_INVALID')
        await writeFile(path.join(combined, file), file)
      }
      await writeFile(path.join(combined, 'admin/server/wrangler.json'), '{}')
      await expect(verifyAdminReleaseArtifact(root, manifest, { sourceSha })).rejects.toThrow('ADMIN_RELEASE_CANDIDATE_CONFIG_FORBIDDEN')
      await rm(path.join(combined, 'admin/server/wrangler.json'))
      await symlink('app.js', path.join(combined, 'assets/__admin/alias.js'))
      await expect(verifyAdminReleaseArtifact(root, manifest, { sourceSha })).rejects.toThrow('ENVIRONMENT_WORKER_ARTIFACT_SYMLINK_FORBIDDEN')
    } finally { await rm(root, { recursive: true, force: true }) }
  })
})
