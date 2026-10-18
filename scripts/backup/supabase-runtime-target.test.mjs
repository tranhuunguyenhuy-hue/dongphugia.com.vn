import { describe, expect, it } from 'vitest'

import { parseSupabaseRuntimeTarget } from './supabase-runtime-target.mjs'

describe('Supabase runtime target URL', () => {
  it('accepts only the exact direct or Singapore session-pooler identity', () => {
    expect(parseSupabaseRuntimeTarget(
      'postgresql://postgres:secret@db.bonxyxluzlxfkdetryoo.supabase.co:5432/postgres',
    )).toMatchObject({
      host: 'db.bonxyxluzlxfkdetryoo.supabase.co',
      user: 'postgres',
      database: 'postgres',
      port: 5432,
    })
    expect(parseSupabaseRuntimeTarget(
      'postgresql://postgres.bonxyxluzlxfkdetryoo:secret@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres',
    )).toMatchObject({
      host: 'aws-0-ap-southeast-1.pooler.supabase.com',
      user: 'postgres.bonxyxluzlxfkdetryoo',
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
})
