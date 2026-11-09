import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261106220000_phase2_admin_cms_category_read.sql'), 'utf8')

describe('Phase 2 CMS category migration', () => {
  it('keeps the category listing invoker-only, capability gated and staff-only', () => {
    expect(migration).toContain("leo542_admin_can('blog:read')")
    expect(migration).toContain('security invoker')
    expect(migration).toContain('from public, anon, service_role')
    expect(migration).toContain('to authenticated')
    expect(migration).toContain("where is_active")
  })

  it('temporarily grants schema CREATE only for function creation and verifies revocation', () => {
    expect(migration).toContain('grant create on schema public to dpg_migration')
    expect(migration).toContain('revoke create on schema public from dpg_migration')
    expect(migration).toContain("has_schema_privilege('dpg_migration', 'public', 'CREATE')")
  })
})
