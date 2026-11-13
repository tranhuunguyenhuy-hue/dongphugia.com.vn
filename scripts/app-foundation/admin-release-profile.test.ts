import { describe, expect, it } from 'vitest'
import { validateAdminReleaseProfile } from './admin-release-profile.mjs'

const sourceSha = 'a'.repeat(40)
const hyperdriveId = 'b'.repeat(32)
const bundleSha256 = 'c'.repeat(64)
const assetsSha256 = 'd'.repeat(64)
const expected = { sourceSha, hyperdriveId, bundleSha256, assetsSha256 }
const valid = () => ({
  contract: 'dpg:combined-public-admin-worker:v1', sourceSha, entrypoint: 'worker.mjs',
  routes: { admin: '/admin', public: '/' }, schema: 'dpg_app',
  bundleSha256, assetsSha256,
  bindings: { ASSETS: { type: 'assets' }, HYPERDRIVE_ADMIN_NO_CACHE: { type: 'hyperdrive', id: hyperdriveId } },
  vars: { RUNTIME_ROLE: 'production', WRITE_FREEZE_MODE: 'false', PRISMA_REQUEST_SCOPE_REQUIRED: 'true' },
})

describe('proposed integrated Admin declaration', () => {
  it('accepts the exact bounded declaration', () => {
    expect(validateAdminReleaseProfile(valid(), expected)).toBe(true)
  })
  it.each([
    ['unknown binding', (m: ReturnType<typeof valid>) => { Object.assign(m.bindings, { EXTRA: { type: 'secret_text' } }) }],
    ['unknown variable', (m: ReturnType<typeof valid>) => { Object.assign(m.vars, { DATABASE_URL: 'x' }) }],
    ['wrong Hyperdrive', (m: ReturnType<typeof valid>) => { m.bindings.HYPERDRIVE_ADMIN_NO_CACHE.id = 'e'.repeat(32) }],
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
})
