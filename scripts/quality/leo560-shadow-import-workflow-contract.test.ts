import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

describe('LEO-560 shadow-import workflow contract', () => {
  it('requires exact main, issue, backup/restore proof, and the protected environment', async () => {
    const workflow = await readFile(resolve(root, '.github/workflows/leo560-shadow-import.yml'), 'utf8')
    expect(workflow).toContain("test \"$GITHUB_REF_VALUE\" = 'refs/heads/main'")
    expect(workflow).toContain('issues/152')
    expect(workflow).toContain('Rehearse the encrypted backup in isolated PostgreSQL')
    expect(workflow).toContain('exact-pr-artifact-identity.mjs verify')
    expect(workflow).toContain('test "$(jq -r \'.head.sha\' "$pull_json")" = "$BACKUP_CANDIDATE_SHA"')
    expect(workflow).toContain('test "$(jq -r \'.merged\' "$pull_json")" = \'true\'')
    expect(workflow).toContain('git merge-base --is-ancestor "$pull_merge_sha" "$APPROVED_SOURCE_SHA"')
    expect(workflow).toContain('environment: runtime-backup')
    expect(workflow).toContain('retention-days: 14')
  })

  it('uses only protected secrets and verifies the exact immutable snapshot', async () => {
    const workflow = await readFile(resolve(root, '.github/workflows/leo560-shadow-import.yml'), 'utf8')
    expect(workflow).toContain('secrets.SUPABASE_RUNTIME_MIGRATION_URL')
    expect(workflow).toContain('secrets.SUPABASE_MANAGEMENT_TOKEN')
    expect(workflow).toContain('secrets.LEO560_SNAPSHOT_URL')
    expect(workflow).toContain('CSyMYJz1glatK32aWl2K8pukzxzXl69c')
    expect(workflow).toContain('86db472b7fa2aed53d287ef1f4eb2c817320e4650fcbd9b56d53a71a39d6edf1')
    expect(workflow).toContain('88499596')
    expect(workflow).toContain('leo560-verify-snapshot-url.ts')
    expect(workflow).not.toMatch(/AWS_(ACCESS_KEY|SECRET_ACCESS_KEY)|configure-aws-credentials|id-token:/)
    const jobEnvironment = workflow.split('    env:\n      LEO560_SHADOW_IMPORT_APPROVED:')[1]?.split('    steps:')[0] ?? ''
    expect(jobEnvironment).not.toMatch(/SUPABASE_RUNTIME_MIGRATION_URL|SUPABASE_MANAGEMENT_TOKEN|LEO560_SNAPSHOT_URL|AGE_RECIPIENT/)
  })

  it('keeps the write surface catalogue-only and removes plaintext material', async () => {
    const workflow = await readFile(resolve(root, '.github/workflows/leo560-shadow-import.yml'), 'utf8')
    expect(workflow).toContain('leo560-shadow-import.ts')
    expect(workflow).toContain('Product Family/Axis/Option')
    expect(workflow).toContain('Remove plaintext temporary material')
    expect(workflow).toContain('leo562-quarantine.json.age')
    expect(workflow).toContain('cloudflare-readonly-discovery.mjs')
    expect(workflow).toContain('.bindings | all(.type == "assets")')
    expect(workflow).toContain('.customDomains == []')
    expect(workflow).toContain('.routes == []')
    expect(workflow).not.toContain('supabase db push')
  })
})
