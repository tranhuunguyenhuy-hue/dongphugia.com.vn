import { describe, expect, it } from 'vitest'
import { isOrderIntakeDatabaseUrl } from './database-url'

const ref = 'bonxyxluzlxfkdetryoo'

describe('order intake database URL', () => {
  it('accepts a dedicated custom role over direct TLS', () => {
    expect(isOrderIntakeDatabaseUrl(
      `postgresql://dpg_order_intake_login:secret@db.${ref}.supabase.co:5432/postgres?sslmode=require`,
    )).toBe(true)
  })

  it('accepts the dedicated role via Supavisor session or transaction mode', () => {
    for (const port of ['5432', '6543']) {
      expect(isOrderIntakeDatabaseUrl(
        `postgresql://dpg_order_intake_login.${ref}:secret@aws-0-ap-southeast-1.pooler.supabase.com:${port}/postgres?sslmode=require`,
      )).toBe(true)
    }
  })

  it('rejects superuser, lookalike role, arbitrary host, and insecure hosted URLs', () => {
    const urls = [
      `postgresql://postgres:secret@db.${ref}.supabase.co/postgres?sslmode=require`,
      `postgresql://dpg_order_intake_login_extra:secret@db.${ref}.supabase.co/postgres?sslmode=require`,
      `postgresql://dpg_order_intake_login:secret@attacker.example/postgres?sslmode=require`,
      `postgresql://dpg_order_intake_login:secret@db.${ref}.supabase.co/postgres?sslmode=disable`,
      `postgresql://dpg_order_intake_login:secret@db.${ref}.supabase.co:6543/postgres?sslmode=require`,
      `postgresql://dpg_order_intake_login:secret@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require`,
      `postgresql://dpg_order_intake_login:secret@db.${ref}.supabase.co/postgres?sslmode=require&options=unsafe`,
      `postgresql://dpg_order_intake_login@db.${ref}.supabase.co/postgres?sslmode=require`,
    ]
    for (const url of urls) expect(isOrderIntakeDatabaseUrl(url)).toBe(false)
  })

  it('allows only explicit loopback local test URLs', () => {
    const local = 'postgresql://dpg_order_intake_login:local@127.0.0.1:5432/postgres?sslmode=disable'
    expect(isOrderIntakeDatabaseUrl(local)).toBe(false)
    expect(isOrderIntakeDatabaseUrl(local, { allowLocal: true })).toBe(true)
    expect(isOrderIntakeDatabaseUrl(
      'postgresql://postgres:local@127.0.0.1:5432/postgres?sslmode=disable',
      { allowLocal: true },
    )).toBe(false)
  })
})
