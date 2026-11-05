import { X509Certificate } from 'node:crypto'
import { createSecureContext } from 'node:tls'
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


describe('Supabase database TLS trust', () => {
  it('trusts the pinned official CA while retaining certificate and hostname verification', () => {
    const { ssl } = parseSupabaseRuntimeTarget(
      'postgresql://postgres.bonxyxluzlxfkdetryoo:secret@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres',
    )
    expect(ssl.rejectUnauthorized).toBe(true)
    expect(ssl.checkServerIdentity).toBeUndefined()
    const certificate = new X509Certificate(ssl.ca)
    expect(certificate.ca).toBe(true)
    expect(certificate.fingerprint256).toBe('80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA')
    expect(() => createSecureContext(ssl)).not.toThrow()
  })
})
