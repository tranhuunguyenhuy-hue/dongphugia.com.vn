import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const backupMigration = readFileSync(resolve(root, 'supabase/migrations/20260828183714_leo542_backup_coverage_prerequisite.sql'), 'utf8')
const sequenceMigration = readFileSync(resolve(root, 'supabase/migrations/20260828184629_leo542_backup_sequence_coverage_prerequisite.sql'), 'utf8')
const migration = readFileSync(resolve(root, 'supabase/migrations/20260828185021_leo542_admin_publishing_runtime.sql'), 'utf8')
const rollback = readFileSync(resolve(root, 'docs/deploy/leo542-admin-publishing-rollback.sql'), 'utf8')
const config = readFileSync(resolve(root, 'supabase/config.toml'), 'utf8')
const functions = ['admin-commerce','admin-content','admin-blog','admin-products','admin-audit','publishing-posts','publishing-media']
  .map((name) => readFileSync(resolve(root, `supabase/functions/${name}/index.ts`), 'utf8')).join('\n')

describe('LEO-542 Phase A security contract', () => {
  it('keeps the backup prerequisite exact and read-only', () => {
    expect(backupMigration).toContain('grant select on table dpg_app.runtime_idempotency_records to dpg_backup')
    expect(backupMigration).toContain('grant select on table dpg_app.runtime_audit_events to dpg_backup')
    expect(backupMigration).toContain('for select to dpg_backup')
    expect(backupMigration).not.toMatch(/grant (insert|update|delete|truncate|references|trigger)/i)
    expect(sequenceMigration).toContain('grant select on sequence dpg_app.runtime_audit_events_id_seq to dpg_backup')
    expect(sequenceMigration).not.toMatch(/grant usage|grant .* on sequence (?!dpg_app\.runtime_audit_events_id_seq)/i)
  })

  it('keeps the exact target and four-table RLS scope', () => {
    expect(migration).toContain("project_name = 'dongphugia-runtime'")
    expect(migration).toContain("region = 'ap-southeast-1'")
    expect(migration).toContain("environment = 'preview'")
    for (const table of ['publishing_idempotency_records','publishing_rate_limit_windows','publishing_audit_events','audit_logs']) {
      expect(migration).toContain(`alter table dpg_app.${table} enable row level security`)
      expect(migration).toContain(`alter table dpg_app.${table} force row level security`)
    }
    for (const table of ['admin_sessions','publishing_credentials','crawl_runs','product_families']) {
      expect(migration).not.toMatch(new RegExp(`alter table dpg_app\\.${table} (enable|force) row level security`))
    }
  })

  it('uses caller JWTs and no service role or database credential in Edge code', () => {
    expect(functions).toContain('requireAuthenticatedClient')
    expect(functions).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL|password_hash/i)
    for (const name of ['admin-audit','admin-blog','admin-commerce','admin-content','admin-products','publishing-media','publishing-posts']) {
      expect(config).toMatch(new RegExp(`\\[functions\\.${name}\\][\\s\\S]*?verify_jwt = true`))
    }
    expect(migration).toContain('security invoker')
    expect(migration.match(/security definer/g)?.length).toBe(3)
    expect(migration).not.toMatch(/user_metadata|raw_user_meta_data/i)
  })

  it('has no canonical delete RPC and a bounded non-destructive rollback', () => {
    expect(functions).not.toMatch(/method===['"]DELETE|method === ['"]DELETE/)
    expect(migration).not.toMatch(/delete from dpg_app\.(blog_posts|products|orders|quote_requests|customers)/i)
    expect(rollback).not.toMatch(/drop table|delete from|truncate|disable row level security/i)
    expect(rollback).toContain('leo542_acceptance_force_rollback')
  })
})
