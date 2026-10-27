import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const workflowPath = '.github/workflows/c-actions-original-authentic-recovery-once.yml'

describe('one-time original authentic recovery', () => {
  it('stages only the pinned source artifact using synthetic fixtures', () => {
    const result = spawnSync('python3', ['-B', 'scripts/backup/c_actions_original_source_test.py'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    })
    expect(result.status, result.stderr).toBe(0)
  })

  it('requires the protected exact-main one-shot and keeps secret use after source validation', async () => {
    const workflow = await readFile(workflowPath, 'utf8')
    const sourceHelper = await readFile('scripts/backup/c_actions_original_source.py', 'utf8')
    const source = workflow.indexOf('c_actions_original_source.py')
    const containerPreflight = workflow.indexOf('MODE=container-preflight')
    const secret = workflow.indexOf('BACKUP_AGE_PRIVATE_KEY')

    expect(workflow).toContain('workflow_dispatch:')
    expect(workflow).toContain("github.repository == 'tranhuunguyenhuy-hue/dongphugia.com.vn'")
    expect(workflow).toContain("github.ref == 'refs/heads/main'")
    expect(workflow).toContain("github.actor == 'tranhuunguyenhuy-hue'")
    expect(workflow).toContain('github.run_number == 1')
    expect(workflow).toContain('github.run_attempt == 1')
    expect(workflow).toContain('environment: runtime-backup')
    expect(workflow).toContain('EXPECTED_AGE_RECIPIENT')
    expect(sourceHelper).toContain('2026-10-30T14:27:48Z')
    expect(workflow).toContain('MODE=rehearsal')
    expect(source).toBeGreaterThan(-1)
    expect(containerPreflight).toBeGreaterThan(source)
    expect(secret).toBeGreaterThan(source)
    expect(secret).toBeGreaterThan(containerPreflight)
    expect(workflow).not.toMatch(/SUPABASE|CLOUDFLARE|upload-artifact|actions: write|contents: write/i)
    expect(workflow).not.toContain('B11_RECOVERY_AGE_IDENTITY')
  })

  it('runs the restore in a non-root, swap-limited, read-only, network-isolated container', async () => {
    const restore = await readFile('scripts/backup/restore-catalogue-runtime.sh', 'utf8')
    const staging = await readFile('scripts/backup/c-actions-container-staging.sh', 'utf8')

    expect(restore).toContain('--user "$postgres_uid:$postgres_gid"')
    expect(restore).toContain('--memory-swap "$pg_memory"')
    expect(restore).toContain('--cap-drop ALL')
    expect(restore).toContain('--security-opt no-new-privileges=true')
    expect(restore).toContain('--network none --read-only')
    expect(restore).toContain('container_isolation_unproved')
    expect(restore).toContain("if [[ \"$MODE\" == 'container-preflight' ]]")
    expect(restore).not.toContain('docker exec --user 0')
    expect(staging).toContain('docker exec --user postgres -i')
    expect(restore).toContain('source_database_bytes=$source_bytes target_database_bytes=$target_bytes')
  })
})
