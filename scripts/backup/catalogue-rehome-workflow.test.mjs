import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const workflowPath = '.github/workflows/supabase-runtime-rehome.yml'
const restorePath = 'scripts/backup/restore-catalogue-runtime.sh'
const preflightPath = 'scripts/backup/catalogue-rehome-preflight.sql'

describe('Supabase runtime catalogue re-home workflow', () => {
  it('is manual, protected-main-only, exact-artifact-bound, and read-only by default', async () => {
    const workflow = await readFile(workflowPath, 'utf8')

    expect(workflow).toContain('workflow_dispatch:')
    expect(workflow).toMatch(/operation:[\s\S]*default: preflight[\s\S]*type: choice/)
    expect(workflow).toContain('- migrate')
    expect(workflow).toContain('- restore')
    expect(workflow).toContain("test \"$GITHUB_REF\" = 'refs/heads/main'")
    expect(workflow).toContain("ISSUE_NUMBER: '158'")
    expect(workflow).toContain("BACKUP_RUN_ID: '38915575745'")
    expect(workflow).toContain("BACKUP_ARTIFACT_NAME: 'leo540-runtime-backup-38915575745'")
    expect(workflow).toContain('environment: runtime-backup')
    expect(workflow).toContain('SUPABASE_REHOME_DATABASE_URL')
    expect(workflow).toContain('SUPABASE_MANAGEMENT_TOKEN')
    expect(workflow).toContain('ymjvuwefhqqlymwlocqn')
    expect(workflow).toContain('bonxyxluzlxfkdetryoo')
    expect(workflow).toContain("inputs.operation == 'migrate'")
    expect(workflow).toContain("inputs.operation == 'restore'")
    expect(workflow).toContain('supabase-runtime-migrations.mjs apply')
    expect(workflow).toContain('supabase-runtime-migrations.mjs status')
    expect(workflow).toContain('leo560_preview_rls_hardening.sql')
    expect(workflow).toContain('leo565_media_foundation.sql')
    expect(workflow).toContain('BACKUP_AGE_PRIVATE_KEY')
    expect(workflow).toContain('MODE: rehearsal')
    expect(workflow).toContain('MODE: preflight')
    expect(workflow).toContain('MODE: apply')
    expect(workflow.indexOf('MODE: rehearsal')).toBeLessThan(workflow.indexOf('MODE: apply'))
    expect(workflow).not.toMatch(/CLOUDFLARE_API_TOKEN|wrangler|api\.cloudflare\.com|production_database_url/i)
  })

  it('rehearses the exact filtered restore in network-isolated PostgreSQL before remote use', async () => {
    const restore = await readFile(restorePath, 'utf8')

    expect(restore).toContain("mode must be rehearsal, preflight, or apply")
    expect(restore).toContain('sha256sum -c')
    expect(restore).toContain('manifest-contract.mjs" validate')
    expect(restore).toContain('"$contract" validate-source')
    expect(restore).toContain('age --decrypt')
    expect(restore).toContain('findmnt --noheadings --output FSTYPE')
    expect(restore).toContain("!= 'tmpfs'")
    expect(restore).toContain('supabase-runtime-target.mjs')
    expect(restore).toContain('unset PGHOST PGHOSTADDR PGDATABASE PGUSER')
    expect(restore).toContain('sensitive_failure remote_apply')
    expect(restore).toContain('--network none')
    expect(restore).toContain('pg_restore -U postgres -d source')
    expect(restore).toContain('pg_restore -U postgres -d target --schema-only')
    expect(restore).toContain('"$contract" table-args')
    expect(restore).toContain('pg_restore --data-only --no-owner --no-privileges')
    expect(restore).toContain('"$contract" compare')
  })

  it('keeps remote mutation empty-target-only, transactional, size-guarded, and catalogue-only', async () => {
    const [restore, preflight] = await Promise.all([
      readFile(restorePath, 'utf8'),
      readFile(preflightPath, 'utf8'),
    ])

    expect(restore).toContain('begin transaction isolation level serializable;')
    expect(restore).toContain("\\i '$preflight_sql'")
    expect(restore).toContain("\\i '$restore_sql'")
    expect(restore).toContain("\\i '$validation_sql'")
    expect(restore).toContain('commit;')
    expect(restore).toContain('SUPABASE_REHOME_DATABASE_URL')
    expect(restore).not.toMatch(/SUPABASE_RUNTIME_DATABASE_URL|production/i)

    expect(preflight).toContain("project_name = 'dongphugia-runtime'")
    expect(preflight).toContain("region = 'ap-southeast-1'")
    expect(preflight).toContain("environment = 'preview'")
    expect(preflight).toContain("to_regclass('dpg_v1.products') is null")
    expect(preflight).toContain('runtime_migration_ledger')
    expect(preflight).toContain('CATALOGUE_REHOME_RLS_INCOMPLETE')
    expect(preflight).toContain('CATALOGUE_REHOME_V1_DATA_NOT_EMPTY')
    expect(preflight).toContain('auth.users')
    expect(preflight).toContain('storage.objects')
    expect(preflight).toContain('CATALOGUE_REHOME_TARGET_NOT_EMPTY table=%')
    expect(preflight).toContain('assert_free_tier_headroom')
    expect(preflight).not.toMatch(/truncate|delete\s+from|drop\s+table/i)
  })
})
