import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const workflowPath = '.github/workflows/offline-catalogue-rehearsal.yml'
const restorePath = 'scripts/backup/restore-catalogue-runtime.sh'
const runbookPath = 'docs/deploy/offline-catalogue-rehearsal.md'

describe('offline filtered catalogue rehearsal workflow', () => {
  it('is manual-only, main-only, read-only, and routed to the dedicated isolated runner', async () => {
    const workflow = await readFile(workflowPath, 'utf8')
    const triggerBlock = workflow.slice(workflow.indexOf('on:\n'), workflow.indexOf('\npermissions:'))
    const triggerNames = [...triggerBlock.matchAll(/^  ([a-z_]+):/gm)].map((match) => match[1])

    expect(triggerNames).toEqual(['workflow_dispatch'])
    expect(workflow).toContain("if: github.ref == 'refs/heads/main'")
    expect(workflow).toContain("test \"$GITHUB_EVENT_NAME\" = 'workflow_dispatch'")
    expect(workflow).toContain("test \"$GITHUB_REF\" = 'refs/heads/main'")
    expect(workflow).toContain('test "$APPROVED_MAIN_SHA" = "$GITHUB_SHA"')
    expect(workflow).toContain('runs-on: [self-hosted, linux, dpg-offline-pg17]')
    expect(workflow).toContain('environment: runtime-backup')
    expect(workflow).toContain('actions: read')
    expect(workflow).toContain('contents: read')
    expect(workflow).not.toMatch(/^\s+(id-token|issues|pull-requests|deployments):\s+write/m)
  })

  it('proves the trusted host egress policy and tmpfs/image preconditions before scoping the age identity', async () => {
    const workflow = await readFile(workflowPath, 'utf8')
    const attestation = workflow.indexOf('/usr/local/sbin/dpg-offline-runner-attest')
    const tmpfs = workflow.indexOf('findmnt --noheadings --output FSTYPE --target /dev/shm')
    const imageCheck = workflow.indexOf('docker image inspect "$POSTGRES_IMAGE"')
    const secret = workflow.indexOf('secrets.BACKUP_AGE_PRIVATE_KEY')

    expect(attestation).toBeGreaterThan(-1)
    expect(tmpfs).toBeGreaterThan(attestation)
    expect(imageCheck).toBeGreaterThan(tmpfs)
    expect(secret).toBeGreaterThan(imageCheck)
    expect(workflow).toContain('--profile dongphugia-catalogue-rehearsal --require-supabase-egress-deny')
    expect(workflow).toContain('test "$(stat -c %U "$verifier")" = root')
    expect(workflow).toContain('test ! -w "$verifier"')
  })

  it('pins and validates the exact encrypted source artifact before decrypting it', async () => {
    const workflow = await readFile(workflowPath, 'utf8')
    expect(workflow).toContain("BACKUP_RUN_ID: '38915575745'")
    expect(workflow).toContain("BACKUP_ARTIFACT_ID: '12052107648'")
    expect(workflow).toContain('BACKUP_ARTIFACT_NAME: leo540-runtime-backup-38915575745')
    expect(workflow).toContain('sha256:348431a2837ae5c3f473d80f5ca8807242e5bb1e164caf71f740a4bb76049e57')
    expect(workflow).toContain('BACKUP_CONTROL_SHA: ce64e8cc7caf91b8bf2e4e2315d49e21bacdfffc')
    expect(workflow).toContain('gh run download "$BACKUP_RUN_ID" --name "$BACKUP_ARTIFACT_NAME"')
    expect(workflow).toContain('sha256sum -c')
    expect(workflow).toContain('manifest-contract.mjs validate')
    expect(workflow).toContain('catalogue-restore-contract.mjs validate-source')
  })

  it('passes only the age identity to the rehearsal step and never calls remote services or uploads evidence', async () => {
    const workflow = await readFile(workflowPath, 'utf8')
    const secretReferences = workflow.match(/\$\{\{\s*secrets\.[A-Z0-9_]+\s*\}\}/g) ?? []
    expect(secretReferences).toEqual(['${{ secrets.BACKUP_AGE_PRIVATE_KEY }}'])
    expect(workflow).toContain('AGE_IDENTITY: ${{ secrets.BACKUP_AGE_PRIVATE_KEY }}')
    expect(workflow).toContain('MODE: rehearsal')
    expect(workflow).not.toMatch(/SUPABASE_REHOME_DATABASE_URL|SUPABASE_MANAGEMENT_TOKEN|api\.supabase\.com|wrangler|CLOUDFLARE_API_TOKEN|AWS_/i)
    expect(workflow).not.toMatch(/upload-artifact|gh issue|issues: write/i)
    expect(workflow).toContain("jq -r '.tables[] | [.tableName, (.rowCount | tostring)] | @tsv'")
    expect(workflow).not.toMatch(/\.tables\[\].*sha256|\.tables\[\].*hash/i)
  })

  it('reuses the pinned network-none restore contract and publishes only aggregate restore metrics', async () => {
    const [restore, workflow, runbook] = await Promise.all([
      readFile(restorePath, 'utf8'),
      readFile(workflowPath, 'utf8'),
      readFile(runbookPath, 'utf8'),
    ])
    expect(restore).toContain('--network none')
    expect(restore).toContain('findmnt --noheadings --output FSTYPE')
    expect(restore).toContain("test \"$server_version_num\" = '170006'")
    expect(restore).toContain('test "$empty_target_objects" = \'0\'')
    expect(restore).toContain('"$contract" table-args')
    expect(restore).toContain('"$contract" compare')
    expect(restore).toContain("select pg_database_size('target')")
    expect(restore).toContain('duration_seconds=')
    expect(workflow).toContain('if: always()')
    expect(workflow).toContain('Remove artifact and evidence from tmpfs')
    expect(restore).toContain('CATALOGUE_REHOME status=PASS mode=rehearsal')
    expect(runbook).toContain('GitHub-hosted runners are not accepted')
    expect(runbook).toContain('dpg-offline-runner-attest')
    expect(runbook).toContain('NOT PROVEN')
  })
})
