import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const config = readFileSync(resolve(process.cwd(), 'supabase/config.toml'), 'utf8')
const boundary = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260827204635_leo539_security_boundary.sql',
  ),
  'utf8',
)
const controlRls = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260827204730_leo539_control_rls_hardening.sql',
  ),
  'utf8',
)
const validation = readFileSync(
  resolve(process.cwd(), 'supabase/tests/leo539_security_boundary.sql'),
  'utf8',
)
const runbook = readFileSync(
  resolve(process.cwd(), 'docs/deploy/supabase-runtime-security-boundary.md'),
  'utf8',
)
const docsIndex = readFileSync(resolve(process.cwd(), 'docs/README.md'), 'utf8')

describe('LEO-539 Supabase runtime security boundary', () => {
  it('locks the exact target and non-Production environment', () => {
    for (const value of [
      'dongphugia-runtime',
      'ap-southeast-1',
      "environment = 'preview'",
      "data_class = 'synthetic-only'",
      'not production_data_allowed',
      'not production_credentials_allowed',
      'not production_writes_allowed',
    ]) {
      expect(boundary).toContain(value)
    }
    expect(runbook).toContain('tlmgudfhsyzayiazuugf')
    expect(docsIndex).toContain('deploy/supabase-runtime-security-boundary.md')
  })

  it('creates only secret-free NOLOGIN capability roles', () => {
    for (const role of ['dpg_migration', 'dpg_runtime', 'dpg_readonly']) {
      expect(boundary).toContain(`create role ${role}`)
    }
    expect(boundary.match(/\bnologin\b/g)).toHaveLength(3)
    expect(boundary.match(/\bnobypassrls\b/g)).toHaveLength(3)
    expect(boundary).not.toMatch(/\bpassword\b\s+/i)
    expect(boundary).not.toMatch(/postgres(?:ql)?:\/\//i)
    expect(boundary).not.toMatch(/service[_-]?role[_-]?key/i)
  })

  it('keeps Data API and Auth configuration fail closed', () => {
    expect(config).toContain('auto_expose_new_tables = false')
    expect(config).toContain('enable_anonymous_sign_ins = false')
    expect(config.match(/enable_signup = false/g)?.length).toBeGreaterThanOrEqual(2)
    expect(config).toContain('minimum_password_length = 12')
    expect(boundary).toContain('revoke all on schema dpg_app')
    expect(boundary).toContain('grant usage on schema dpg_app to authenticated')
    expect(boundary).not.toContain('grant usage on schema dpg_app to anon')
  })

  it('defines forced owner-scoped RLS and read-only separation', () => {
    expect(boundary).toContain('force row level security')
    expect(boundary).toContain('(select auth.uid()) = owner_id')
    expect(boundary).toContain('for update')
    expect(boundary).toContain('with check')
    expect(boundary).toContain('grant select on table dpg_app.leo539_rls_probe to dpg_readonly')
    expect(boundary).not.toMatch(/grant\s+all/i)
    expect(controlRls).toContain('force row level security')
    expect(controlRls).toContain('to dpg_migration, dpg_readonly')
  })

  it('enforces the accepted Free-tier hard stop and rollback-only tests', () => {
    for (const value of [
      '262144000',
      '314572800',
      '367001600',
      'LEO-539 free-tier hard stop',
    ]) {
      expect(boundary).toContain(value)
    }
    expect(validation).toContain('begin;')
    expect(validation).toContain('rollback;')
    expect(validation).toContain('cross-owner update assertion failed')
    expect(validation).toContain('auth.users')
    expect(validation).toContain('storage.objects')
  })
})
