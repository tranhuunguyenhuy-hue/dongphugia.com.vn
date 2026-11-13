import { describe, expect, it } from 'vitest'
import {
  assertDisposableLocalDatabase,
  assertDryRunOnly,
  assertSameLocalDatabase,
  DISPOSABLE_DATABASE_NAME,
} from './local-target-guard.mjs'

describe('local recovery target guard', () => {
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
