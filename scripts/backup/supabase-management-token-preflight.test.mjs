import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('Supabase Management token preflight workflow', () => {
  it('is owner-only, exact-main, and uses the protected read-only environment', async () => {
    const workflow = await readFile('.github/workflows/supabase-management-token-preflight.yml', 'utf8')

    expect(workflow).toContain('workflow_dispatch:')
    expect(workflow).toContain("github.repository == 'tranhuunguyenhuy-hue/dongphugia.com.vn'")
    expect(workflow).toContain("github.ref == 'refs/heads/main'")
    expect(workflow).toContain("github.actor == 'tranhuunguyenhuy-hue'")
    expect(workflow).toContain('github.run_attempt == 1')
    expect(workflow).toContain('environment: runtime-backup')
    expect(workflow).toContain('persist-credentials: false')
    expect(workflow).toContain('test "$(git rev-parse HEAD)" = "$GITHUB_SHA"')
  })

  it('tests only read-only organization and exact-project endpoints without database access', async () => {
    const workflow = await readFile('.github/workflows/supabase-management-token-preflight.yml', 'utf8')

    expect(workflow).toContain('secrets.SUPABASE_MANAGEMENT_TOKEN')
    expect(workflow).toContain('/v1/organizations/$SUPABASE_ORGANIZATION_SLUG')
    expect(workflow).toContain('/v1/organizations/$SUPABASE_ORGANIZATION_SLUG/projects?search=dongphugia-runtime&limit=100')
    expect(workflow).toContain('curl --config - --silent --show-error')
    expect(workflow).toContain("'.plan == \"free\"'")
    expect(workflow).toContain('.status == "ACTIVE_HEALTHY"')
    expect(workflow).toContain('http_status=%s')
    expect(workflow).not.toContain('SUPABASE_REHOME_DATABASE_URL')
    expect(workflow).not.toContain('SUPABASE_RUNTIME_MIGRATION_URL')
    expect(workflow).not.toContain('psql')
    expect(workflow).not.toContain('supabase-runtime-migrations.mjs')
    expect(workflow).not.toContain('issues: write')
    expect(workflow).not.toContain('deployments: write')
    expect(workflow).not.toMatch(/curl[^\n]*--request\s+(POST|PUT|PATCH|DELETE)/i)
    expect(workflow).not.toMatch(/echo[^\n]*SUPABASE_MANAGEMENT_TOKEN\b/i)
  })

  it('documents the minimum Management API permission scope for bootstrap', async () => {
    const guide = await readFile('docs/deploy/supabase-backup-role-bootstrap.md', 'utf8')
    expect(guide).toContain('Organization Settings (Read)')
    expect(guide).toContain('Organization Projects (Read)')
    expect(guide).toContain('does not need account-wide project access or database permissions')
    expect(guide).toContain('never reads a database URL, connects to Postgres, consumes a bootstrap')
  })
})
