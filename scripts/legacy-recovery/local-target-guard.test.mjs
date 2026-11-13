import { describe, expect, it } from 'vitest'
import {
  assertDisposableLocalDatabase,
  assertLocalAdminFullPreviewDatabase,
  assertLocalAdminPreviewDatabase,
  assertLocalAdminPreviewServerIdentity,
  assertDryRunOnly,
  assertSameLocalDatabase,
  DISPOSABLE_DATABASE_NAME,
  LOCAL_ADMIN_PREVIEW_DATABASE_NAME,
  LOCAL_ADMIN_FULL_PREVIEW_DATABASE_NAME,
} from './local-target-guard.mjs'

describe('local recovery target guard', () => {
  it('accepts only the fixed loopback preview database without credentials', () => {
    expect(assertLocalAdminPreviewDatabase(
      `postgresql://postgres@127.0.0.1:55439/${LOCAL_ADMIN_PREVIEW_DATABASE_NAME}?schema=public`,
    )).toEqual({
      hostname: '127.0.0.1',
      database: LOCAL_ADMIN_PREVIEW_DATABASE_NAME,
      port: '55439',
      username: 'postgres',
      schema: 'public',
    })
  })

  it('rejects tunnels, hosted targets, passwords, other database names and schemas', () => {
    const rejected = [
      `postgresql://postgres@database.example:55439/${LOCAL_ADMIN_PREVIEW_DATABASE_NAME}?schema=public`,
      `postgresql://postgres:secret@127.0.0.1:55439/${LOCAL_ADMIN_PREVIEW_DATABASE_NAME}?schema=public`,
      `postgresql://postgres@127.0.0.1:55440/${LOCAL_ADMIN_PREVIEW_DATABASE_NAME}?schema=public`,
      'postgresql://postgres@127.0.0.1:55439/dpg_legacy_recovery_disposable?schema=public',
      `postgresql://postgres@127.0.0.1:55439/${LOCAL_ADMIN_PREVIEW_DATABASE_NAME}?schema=dpg_app`,
      `postgresql://postgres@127.0.0.1:55439/${LOCAL_ADMIN_PREVIEW_DATABASE_NAME}?host=database.example`,
    ]
    for (const target of rejected) {
      expect(() => assertLocalAdminPreviewDatabase(target)).toThrow('LOCAL_ADMIN_PREVIEW_DATABASE_REQUIRED')
    }
  })

  it('accepts the separate full-catalogue local database and rejects it from the reduced preview guard', () => {
    const url = `postgresql://postgres@127.0.0.1:55439/${LOCAL_ADMIN_FULL_PREVIEW_DATABASE_NAME}?schema=public`
    expect(assertLocalAdminFullPreviewDatabase(url).database).toBe(LOCAL_ADMIN_FULL_PREVIEW_DATABASE_NAME)
    expect(() => assertLocalAdminPreviewDatabase(url)).toThrow('LOCAL_ADMIN_PREVIEW_DATABASE_REQUIRED')
  })

  it('requires the connected database server itself to be the expected local PostgreSQL 17 cluster', () => {
    const target = assertLocalAdminPreviewDatabase(
      `postgresql://postgres@127.0.0.1:55439/${LOCAL_ADMIN_PREVIEW_DATABASE_NAME}?schema=public`,
    )
    const identity = {
      serverAddress: '127.0.0.1',
      serverPort: 55439,
      databaseName: LOCAL_ADMIN_PREVIEW_DATABASE_NAME,
      serverVersionNum: 170011,
      dataDirectory: '/tmp/dpg-legacy-admin-pg-preview',
      expectedDataDirectory: '/tmp/dpg-legacy-admin-pg-preview',
    }
    expect(assertLocalAdminPreviewServerIdentity(target, identity)).toBe(true)
    expect(() => assertLocalAdminPreviewServerIdentity(target, { ...identity, serverAddress: '203.0.113.4' }))
      .toThrow('LOCAL_ADMIN_PREVIEW_POSTGRES_SERVER_IDENTITY_MISMATCH')
    expect(() => assertLocalAdminPreviewServerIdentity(target, { ...identity, serverVersionNum: 160011 }))
      .toThrow('LOCAL_ADMIN_PREVIEW_POSTGRES_SERVER_IDENTITY_MISMATCH')
    expect(() => assertLocalAdminPreviewServerIdentity(target, { ...identity, dataDirectory: '/tmp/other' }))
      .toThrow('LOCAL_ADMIN_PREVIEW_POSTGRES_SERVER_IDENTITY_MISMATCH')
  })

  it('accepts only the named loopback disposable database', () => {
    expect(assertDisposableLocalDatabase(
      `postgresql://postgres@127.0.0.1:55439/${DISPOSABLE_DATABASE_NAME}?schema=public`,
    )).toEqual({
      hostname: '127.0.0.1',
      database: DISPOSABLE_DATABASE_NAME,
      port: '55439',
      username: 'postgres',
      schema: 'public',
    })
    expect(assertDisposableLocalDatabase(
      `postgresql://postgres@localhost/${DISPOSABLE_DATABASE_NAME}`,
    ).schema).toBe('public')
  })

  it('rejects remote hosts, alternate databases, connection overrides and duplicate schema options', () => {
    const rejected = [
      'postgresql://user@database.example/dpg_legacy_recovery_disposable',
      'postgresql://user@127.0.0.1/production',
      'postgresql://user@127.0.0.1/dpg_legacy_recovery_disposable?host=database.example',
      'postgresql://user@127.0.0.1/dpg_legacy_recovery_disposable?schema=public&schema=private',
    ]
    for (const target of rejected) {
      expect(() => assertDisposableLocalDatabase(target)).toThrow('LOCAL_DISPOSABLE_DATABASE_REQUIRED')
    }
  })

  it('requires the same direct target and dry-run-only mode', () => {
    const target = assertDisposableLocalDatabase(
      `postgresql://postgres@127.0.0.1:55439/${DISPOSABLE_DATABASE_NAME}?schema=public`,
    )
    expect(() => assertSameLocalDatabase(target, { ...target, schema: 'other' }))
      .toThrow('LOCAL_DIRECT_URL_MISMATCH')
    expect(() => assertDryRunOnly(['--dry-run'])).not.toThrow()
    expect(() => assertDryRunOnly([])).toThrow('DRY_RUN_FLAG_REQUIRED')
    expect(() => assertDryRunOnly(['--dry-run', '--apply'])).toThrow('WRITE_MODE_NOT_IMPLEMENTED')
  })
})
