import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  attestTarget,
  parseTargetConnection,
  sanitizeDatabaseError,
} from './postgres-target'

afterEach(() => vi.unstubAllEnvs())

describe('PostgreSQL target contract', () => {
  it('accepts only the exact isolated Staging loopback identity', () => {
    vi.stubEnv('ISOLATED_STAGING_POSTGRES', '1')
    const config = parseTargetConnection(
      'isolated-staging',
      'postgresql://dpg_staging_migrator:secret@127.0.0.1:54321/dpg_isolated_staging',
    )
    expect(config).toMatchObject({
      host: '127.0.0.1',
      port: 54321,
      user: 'dpg_staging_migrator',
      database: 'dpg_isolated_staging',
      ssl: false,
    })
  })

  it.each([
    'postgresql://dpg_staging_migrator:secret@db.example/dpg_isolated_staging',
    'postgresql://dpg_staging_migrator:secret@127.0.0.1/dpg_production',
    'postgresql://dpg_staging_migrator:secret@127.0.0.1/dpg_isolated_staging?host=production.internal',
  ])('rejects a non-isolated or overridden target: %s', (url) => {
    vi.stubEnv('ISOLATED_STAGING_POSTGRES', '1')
    expect(() => parseTargetConnection('isolated-staging', url)).toThrow('TARGET_VALIDATION_FAILED')
  })

  it('rejects the wrong provider before connection', () => {
    vi.stubEnv('DISPOSABLE_POSTGRES', '1')
    expect(() => parseTargetConnection('disposable', 'file:./db.sqlite')).toThrow('not PostgreSQL')
  })

  it('attests marker, role, version and app role and returns only an opaque fingerprint', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [{
        database_name: 'dpg_isolated_staging',
        role_name: 'dpg_staging_migrator',
        marker: 'dongphugia:isolated-staging:v1',
        server_version: '16.10 (Debian 16.10-1.pgdg13+1)',
        server_address: '172.18.0.2',
        app_role_exists: true,
      }] }),
    }
    const attestation = await attestTarget(client, 'isolated-staging')
    expect(attestation).toMatchObject({
      database: 'dpg_isolated_staging',
      user: 'dpg_staging_migrator',
      marker: 'dongphugia:isolated-staging:v1',
      serverVersion: '16.10 (Debian 16.10-1.pgdg13+1)',
    })
    expect(attestation.fingerprint).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.stringify(attestation)).not.toContain('172.18.0.2')
  })

  it('sanitizes database errors to SQLSTATE only', () => {
    expect(sanitizeDatabaseError({ code: '23505', detail: 'secret row' })).toBe('postgresql_error:23505')
    expect(sanitizeDatabaseError({ code: 'password=secret' })).toBe('postgresql_error:unknown')
  })
})
