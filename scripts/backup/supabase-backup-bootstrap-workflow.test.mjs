import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('Supabase backup capability bootstrap workflow', () => {
  it('is manually dispatched from exact main and bound to the durable Owner scope', async () => {
    const workflow = await readFile('.github/workflows/supabase-backup-role-bootstrap.yml', 'utf8')

    expect(workflow).toContain('workflow_dispatch:')
    expect(workflow).toContain('approved_source_sha:')
    expect(workflow).toMatch(/expected_ledger_prefix:[\s\S]*default: absent[\s\S]*type: choice/)
    expect(workflow).toMatch(/options:[\s\S]*- absent[\s\S]*- '7'[\s\S]*- '8'[\s\S]*- '9'/)
    expect(workflow).toContain("test \"$GITHUB_REF\" = 'refs/heads/main'")
    expect(workflow).toContain("test \"$GITHUB_ACTOR\" = 'tranhuunguyenhuy-hue'")
    expect(workflow).toContain('APPROVAL_MARKER:')
    expect(workflow).toContain('tranhuunguyenhuy-hue')
    expect(workflow).toContain("ISSUE_NUMBER: '270'")
    expect(workflow).toContain('environment: runtime-backup')
    expect(workflow).toContain('bonxyxluzlxfkdetryoo')
    expect(workflow).toContain('ymjvuwefhqqlymwlocqn')
    expect(workflow).toContain('SUPABASE_MANAGEMENT_TOKEN')
    expect(workflow).toContain('SUPABASE_REHOME_DATABASE_URL')
    expect(workflow).toContain('any(.[]; .ref == $ref and .organization_slug == $org')
    expect(workflow).toContain('supabase-runtime-migrations.mjs bootstrap-backup')
    expect(workflow).not.toContain('supabase-runtime-migrations.mjs apply')
    expect(workflow).not.toContain('BACKUP_AGE_PRIVATE_KEY')
    expect(workflow).not.toContain('dpg_backup_login')
    expect(workflow).not.toMatch(/pg_restore|MODE: apply|CLOUDFLARE_API_TOKEN|production_database_url/i)
  })

  it('documents the two existing migrations and excludes credentials and Phase 2 schema', async () => {
    const guide = await readFile('docs/deploy/supabase-backup-role-bootstrap.md', 'utf8')

    expect(guide).toContain('20260828183000_leo542_backup_role_prerequisite.sql')
    expect(guide).toContain('20260828183200_leo540_backup_coverage_prerequisite.sql')
    expect(guide).toContain('dpg_control.runtime_migration_ledger')
    expect(guide).toContain('does not create `dpg_backup_login`')
    expect(guide).toContain('Phase 2')
    expect(guide).toContain('checksum/private-copy verification, and restore rehearsal')
  })
})
