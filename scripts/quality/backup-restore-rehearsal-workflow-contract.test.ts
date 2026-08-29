import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const workflow = readFileSync(
    resolve(process.cwd(), '.github/workflows/runtime-backup.yml'),
    'utf8',
)
const candidateExtractor = readFileSync(
    resolve(process.cwd(), 'scripts/backup/extract-exact-candidate-sources.sh'),
    'utf8',
)

describe('backup restore rehearsal workflow contract', () => {
    it('is scheduled/manual and restricted to protected main', () => {
        expect(workflow).toContain('workflow_dispatch:')
        expect(workflow).toContain("cron: '17 2 * * 1-6'")
        expect(workflow).toContain("cron: '17 3 * * 0'")
        expect(workflow).not.toContain("cron: '17 2 * * *'")
        expect(workflow).toContain("github.event.schedule == '17 3 * * 0'")
        expect(workflow).toContain("github.event_name == 'workflow_dispatch' && inputs.rehearse_restore == true")
        expect(workflow).not.toMatch(/^\s*(push|pull_request):/m)
        expect(workflow).toContain('test "$GITHUB_REF" = "refs/heads/main"')
        expect(workflow).toContain('environment: runtime-backup')
        expect(workflow).toContain('contents: read')
        expect(workflow).toContain('retention-days: 14')
        expect(workflow).toContain('actions/upload-artifact@v4')
    })

    it('keeps scheduled and legacy manual behavior while adding exact-head inputs', () => {
        expect(workflow).toContain('pr_number:')
        expect(workflow).toContain('candidate_sha:')
        expect(workflow).toContain("mode=legacy-manual")
        expect(workflow).toContain("mode=scheduled")
        expect(workflow).toContain("github.event_name == 'schedule' && github.event.schedule == '17 3 * * 0'")
        expect(workflow).toContain("github.event_name == 'workflow_dispatch' && inputs.rehearse_restore == true")
        expect(workflow).toContain("test \"$GITHUB_REF\" = 'refs/heads/main'")
    })

    it('requires the protected Environment for backup, restore, and alert jobs', () => {
        expect(workflow.match(/environment: runtime-backup/g)).toHaveLength(3)
        expect(workflow).toContain('pull-requests: read')
        expect(workflow).toContain('needs: [preflight, backup]')
    })

    it('loads candidate code only from the exact SHA allowlist, never candidate workflow YAML', () => {
        expect(workflow).toContain('ref: refs/heads/main')
        expect(workflow).toContain('extract-exact-candidate-sources.sh')
        expect(workflow).toContain('exact-pr-artifact-identity.mjs')
        expect(candidateExtractor).toContain('git -C "$repo_root" archive --format=tar "$candidate_sha" -- "${archive_paths[@]}"')
        expect(candidateExtractor).toContain('scripts/backup/runtime-manifest.sql')
        expect(candidateExtractor).toContain('workflow_yaml=not_loaded')
        expect(candidateExtractor).not.toMatch(/git archive[\s\S]*\.github\/workflows/)
        expect(workflow).not.toContain('checkout@v4\n        with:\n          ref: ${{ inputs')
    })

    it('uses only Owner-configured existing target/key contracts', () => {
        expect(workflow).toContain('SUPABASE_RUNTIME_DATABASE_URL')
        expect(workflow).toContain('BACKUP_AGE_RECIPIENT')
        expect(workflow).toContain('BACKUP_AGE_PRIVATE_KEY')
        expect(workflow).toContain('BACKUP_FAILURE_WEBHOOK_URL')
        expect(workflow).not.toMatch(/AWS_(ACCESS_KEY|SECRET|ROLE)|configure-aws-credentials|id-token:/)
        expect(workflow).not.toContain('secretsmanager')
    })

    it('runs backup encryption before artifact upload and restore after download', () => {
        const encryption = workflow.indexOf('create-encrypted-backup.sh')
        const upload = workflow.indexOf('actions/upload-artifact@v4')
        const download = workflow.indexOf('actions/download-artifact@v4')
        const restore = workflow.indexOf('rehearse-isolated-restore.sh')

        expect(encryption).toBeGreaterThan(-1)
        expect(upload).toBeGreaterThan(encryption)
        expect(download).toBeGreaterThan(upload)
        expect(restore).toBeGreaterThan(download)
        expect(workflow).toContain('Logical archive: encrypted before artifact upload')
        expect(workflow).toContain('Manifest: schema metadata, row counts, and row hashes only')
        expect(workflow).toContain('Integrity: encrypted archive and manifest checksums verified')
    })

    it('declares failure alerting without leaking payloads', () => {
        expect(workflow).toContain('LEO540_ALERT status=FAILURE_SIGNALLED')
        expect(workflow).toContain('GitHub Actions job failure is the mandatory alert path.')
        expect(workflow).toContain('The alert payload contains no database row, credential, URL, or key.')
        expect(workflow).not.toContain('actions/upload-artifact@v3')
    })

    it('uses the isolated restore script and pinned PostgreSQL 17 image', () => {
        expect(workflow).toContain('postgres:17.6-bookworm@sha256:45cd22f8d32e189d245403954882f88e7a8714301fda80dab6da90f1265b25a3')
        expect(workflow).toContain('environment: runtime-backup')
        expect(workflow).toContain('actions/download-artifact@v4')
    })
})
