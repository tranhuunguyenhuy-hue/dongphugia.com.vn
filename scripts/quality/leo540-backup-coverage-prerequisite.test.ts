import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const migration = readFileSync(resolve(
  root,
  'supabase/migrations/20260828183200_leo540_backup_coverage_prerequisite.sql',
), 'utf8')
const hardening = readFileSync(resolve(
  root,
  'supabase/migrations/20261016090000_leo560_preview_rls_hardening.sql',
), 'utf8')

const expectedTables = [
  'admin_sessions',
  'crawl_import_decisions',
  'crawl_product_snapshots',
  'crawl_runs',
  'product_families',
  'product_family_catalogue_gaps',
  'product_family_configuration_groups',
  'product_family_memberships',
  'publishing_credentials',
]

describe('LEO-540 backup coverage prerequisite', () => {
  it('orders the minimal prerequisite before unchanged LEO-560 hardening', () => {
    expect(migration).toContain("project_name = 'dongphugia-runtime'")
    expect(migration).toContain("region = 'ap-southeast-1'")
    expect(migration).toContain("environment = 'preview'")
    expect(migration).toContain("data_class = 'production-derived-reduced-runtime'")
    expect(migration).toContain('LEO540_BACKUP_TARGET_CONTRACT_FAILED')
    expect(migration.indexOf('leo540_backup_select')).toBeLessThan(migration.length)
    for (const table of expectedTables) {
      expect(migration).toContain(`'${table}'`)
      expect(hardening).toContain(`'${table}'`)
    }
    expect(migration).toContain('grant usage on schema dpg_app to dpg_backup')
    expect(migration).toContain('grant select on table dpg_app.%I to dpg_backup')
    expect(migration).toContain('create policy leo540_backup_select')
  })

  it('keeps backup access read-only, exact-table, and fail-closed', () => {
    expect(migration).toContain('not rolcanlogin')
    expect(migration).toContain('not rolsuper')
    expect(migration).toContain('pg_auth_members')
    expect(migration).toContain('LEO540_BACKUP_TABLE_PRECONDITION_FAILED')
    expect(migration).toContain('LEO540_BACKUP_POSTCONDITION_FAILED')
    expect(migration).not.toMatch(/grant\s+(insert|update|delete|truncate|references|trigger)/i)
    expect(migration).not.toMatch(/grant\s+select\s+on\s+table\s+dpg_app\.(?!%I)/i)
    expect(migration).not.toMatch(/\b(public|anon|authenticated|service_role|dpg_runtime)\b[^\n]*\b(select|insert|update|delete)\b/i)
  })
})
