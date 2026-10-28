import { describe, expect, it } from 'vitest'

import { parseSupabaseRuntimeTarget } from './supabase-runtime-target.mjs'

describe('Supabase runtime target URL', () => {
  it('accepts only the exact direct or Singapore session-pooler identity', () => {
    expect(parseSupabaseRuntimeTarget(
      'postgresql://dpg_snapshot_login:secret@db.bonxyxluzlxfkdetryoo.supabase.co:5432/postgres',
    )).toMatchObject({
      host: 'db.bonxyxluzlxfkdetryoo.supabase.co',
      user: 'dpg_snapshot_login',
      database: 'postgres',
      port: 5432,
      purpose: 'snapshot',
      setRole: 'dpg_snapshot_readonly',
      options: '-c role=dpg_snapshot_readonly -c default_transaction_read_only=on',
    })
    expect(parseSupabaseRuntimeTarget(
      'postgresql://dpg_snapshot_login.bonxyxluzlxfkdetryoo:secret@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres',
    )).toMatchObject({
      host: 'aws-0-ap-southeast-1.pooler.supabase.com',
      user: 'dpg_snapshot_login.bonxyxluzlxfkdetryoo',
    })
    expect(parseSupabaseRuntimeTarget(
      'postgresql://dpg_migration_login:secret@db.bonxyxluzlxfkdetryoo.supabase.co:5432/postgres',
      'migration',
    )).toMatchObject({
      purpose: 'migration',
      setRole: 'dpg_migration',
      options: '-c role=dpg_migration',
    })
    expect(parseSupabaseRuntimeTarget(
      'postgresql://dpg_catalogue_restore_login:secret@db.bonxyxluzlxfkdetryoo.supabase.co:5432/postgres',
      'catalogue_restore',
    )).toMatchObject({
      purpose: 'catalogue_restore',
      setRole: 'dpg_catalogue_restore',
      options: '-c role=dpg_catalogue_restore',
    })
  })

  it.each([
    'postgresql://postgres:secret@db.bonxyxluzlxfkdetryoo.supabase.co:5432/postgres?host=production.invalid',
    'postgresql://postgres:secret@db.bonxyxluzlxfkdetryoo.supabase.co:5432/postgres?dbname=other',
    'postgresql://postgres:secret@db.bonxyxluzlxfkdetryoo.supabase.co:5432/postgres?options=-csearch_path%3Dpublic',
    'postgresql://postgres:secret@db.bonxyxluzlxfkdetryoo.supabase.co:6543/postgres',
    'postgresql://postgres:secret@db.other.supabase.co:5432/postgres',
  ])('rejects authority overrides and non-exact targets without echoing the URL', (value) => {
    expect(() => parseSupabaseRuntimeTarget(value)).toThrow('supabase_runtime_target_invalid')
  })

  it('does not allow the administrator identity for migration or catalogue writes', () => {
    const administrator = 'postgresql://postgres:secret@db.bonxyxluzlxfkdetryoo.supabase.co:5432/postgres'
    expect(() => parseSupabaseRuntimeTarget(administrator, 'migration'))
      .toThrow('supabase_runtime_target_invalid')
    expect(() => parseSupabaseRuntimeTarget(administrator, 'catalogue_restore'))
      .toThrow('supabase_runtime_target_invalid')
    expect(() => parseSupabaseRuntimeTarget(administrator))
      .toThrow('supabase_runtime_target_invalid')
  })
})
