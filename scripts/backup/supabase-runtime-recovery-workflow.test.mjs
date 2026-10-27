import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('Issue 160 protected recovery workflow', () => {
  it('pins one current Owner GO, the exact source artifact, and one workflow attempt', async () => {
    const workflow = await readFile('.github/workflows/supabase-runtime-issue160-recovery-once.yml', 'utf8')
    expect(workflow).toContain("OWNER_GO_COMMENT_ID: '6444168865'")
    expect(workflow).toContain("OWNER_UPDATE_COMMENT_ID: '6444628120'")
    expect(workflow).toContain('test "$GITHUB_RUN_NUMBER" = 1')
    expect(workflow).toContain('test "$GITHUB_RUN_ATTEMPT" = 1')
    expect(workflow).toContain("BACKUP_ARTIFACT_ID: '12052107648'")
    expect(workflow).toContain('BACKUP_ARTIFACT_SHA256:')
    expect(workflow).toContain("environment: runtime-backup")
    expect(workflow).toContain('cancel-in-progress: false')
    expect(workflow).not.toContain('continue-on-error: true')
    expect(workflow).not.toMatch(/permissions:[\s\S]{0,180}contents:\s*write/)
  })

  it('uploads a client-encrypted restorable snapshot before the first remote mutation', async () => {
    const workflow = await readFile('.github/workflows/supabase-runtime-issue160-recovery-once.yml', 'utf8')
    const snapshot = workflow.indexOf('Create and prove encrypted destination snapshot before writes')
    const snapshotUpload = workflow.indexOf('Persist only encrypted destination snapshot and sanitized receipt')
    const migration = workflow.indexOf('Apply verified canonical schema migrations once')
    const catalogue = workflow.indexOf('Execute the single catalogue sync transaction')
    expect(snapshot).toBeGreaterThan(-1)
    expect(snapshotUpload).toBeGreaterThan(snapshot)
    expect(migration).toBeGreaterThan(snapshotUpload)
    expect(catalogue).toBeGreaterThan(migration)
    expect(workflow).toContain('SUPABASE_REHOME_SNAPSHOT_AGE_IDENTITY')
    expect(workflow).toContain('SUPABASE_REHOME_SNAPSHOT_AGE_RECIPIENT')
    expect(workflow).toContain('SUPABASE_REHOME_ROOT_CA_CERTIFICATE')
    expect(workflow).toContain('retention-days: 30')
    expect(workflow).toContain('Recheck target is still empty and exact before catalogue write')
    expect(workflow).toContain("SUPABASE_FREE_DATABASE_SIZE_LIMIT_BYTES: '500000000'")
    expect(workflow).toContain('Prove Free-plan database headroom before catalogue write')
    expect(workflow).toContain('rehearsal-capacity.json')
    expect(workflow).toContain('reserved_headroom_bytes=$reserve_bytes')
    expect(workflow.indexOf('stage=pre-migration'))
      .toBeLessThan(workflow.indexOf('Apply verified canonical schema migrations once'))
  })

  it('measures isolated database capacity and enforces the hard ceiling inside the write transaction', async () => {
    const restore = await readFile('scripts/backup/restore-catalogue-runtime.sh', 'utf8')
    expect(restore).toContain('filteredTargetDatabaseBytes')
    expect(restore).toContain('rehearsal-capacity.json')
    const guard = restore.indexOf('do $catalogue_size_guard$')
    expect(guard).toBeGreaterThan(-1)
    expect(restore.slice(guard)).toContain('pg_database_size(current_database()) >= 367001600')
    expect(restore.slice(guard)).toContain('commit;')
  })

  it('keeps the snapshot encrypted, verifies a tmpfs restore, and excludes role password hashes', async () => {
    const [script, dump] = await Promise.all([
      readFile('scripts/backup/supabase-runtime-snapshot.sh', 'utf8'),
      readFile('scripts/backup/supabase-runtime-pg-dump.mjs', 'utf8'),
    ])
    expect(script).toContain('/dev/shm')
    expect(script).toContain('--affected-state-snapshot')
    expect(script).toContain('--global-roles-snapshot')
    expect(dump).toContain('--no-role-passwords')
    expect(script).toContain('--network none')
    expect(script).toContain('pg_restore --format=custom')
    expect(script).toContain('isolated_database_restore_failed')
    expect(script).toContain('.custom.age')
    expect(script).toContain('.sql.age')
    expect(script).not.toMatch(/OUTPUT_DIR[^\n]*\.dump(?!\.age)/)
    expect(script).not.toContain('BACKUP_AGE_PRIVATE_KEY')
  })

  it('retains aggregate rehearsal evidence only until explicit job cleanup', async () => {
    const [restore, workflow] = await Promise.all([
      readFile('scripts/backup/restore-catalogue-runtime.sh', 'utf8'),
      readFile('.github/workflows/supabase-runtime-issue160-recovery-once.yml', 'utf8'),
    ])
    expect(restore).toContain('KEEP_OUTPUT_DIR')
    expect(workflow).toContain('KEEP_OUTPUT_DIR=true')
    expect(workflow).toContain('Remove protected temporary files')
    expect(workflow).toContain('if: always()')
  })
})
