import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const workflow = readFileSync(
    resolve(process.cwd(), '.github/workflows/runtime-backup.yml'),
    'utf8',
)
const restoreScript = readFileSync(
    resolve(process.cwd(), 'scripts/backup/rehearse-isolated-restore.sh'),
    'utf8',
)
const postgresImagePinPath = resolve(process.cwd(), 'scripts/backup/postgres-image-pin.sh')
const postgresImagePinHelper = readFileSync(postgresImagePinPath, 'utf8')
const catalogueRestore = readFileSync(
    resolve(process.cwd(), 'scripts/backup/restore-catalogue-runtime.sh'),
    'utf8',
)
const qualityWorkflow = readFileSync(resolve(process.cwd(), '.github/workflows/quality.yml'), 'utf8')
const rehomeWorkflow = readFileSync(
    resolve(process.cwd(), '.github/workflows/supabase-runtime-rehome.yml'),
    'utf8',
)
const approvedPostgresImage =
    'postgres:17.6-bookworm@sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3'
const historicalBackupPostgresImage =
    'postgres:17.6-bookworm@sha256:45cd22f8d32e189d245403954882f88e7a8714301fda80dab6da90f1265b25a3'
const arm64ChildPostgresImage =
    'postgres:17.6-bookworm@sha256:5d11ffb37e58a7c9a2285359e50f7674e216c99b9114e47b0e7f21187c11252c'

function runPostgresImageResolver(postgresImage?: string) {
    const env = { ...process.env }
    delete env.POSTGRES_IMAGE
    if (postgresImage !== undefined) env.POSTGRES_IMAGE = postgresImage
    return spawnSync(
        'bash',
        ['-c', 'source "$1" && dpg_resolve_postgres_image', 'postgres-image-pin-test', postgresImagePinPath],
        { encoding: 'utf8', env },
    )
}

function runRestorePreflight(envOverrides: Record<string, string>) {
    const testDirectory = mkdtempSync(join(tmpdir(), 'restore-preflight-test-'))
    const binDirectory = join(testDirectory, 'bin')
    const backupDirectory = join(testDirectory, 'empty-backup')
    const dockerPath = join(binDirectory, 'docker')
    const dockerLogPath = join(testDirectory, 'docker.log')
    mkdirSync(binDirectory)
    mkdirSync(backupDirectory)
    writeFileSync(
        dockerPath,
        [
            '#!/usr/bin/env bash',
            'set -euo pipefail',
            'printf "%s\\n" "$*" >> "$DOCKER_TEST_LOG"',
            'if [[ "$1" == context && "$2" == show ]]; then printf "default\\n"; exit 0; fi',
            'if [[ "$1" == context && "$2" == inspect ]]; then printf "%s\\n" "$DOCKER_TEST_ENDPOINT"; exit 0; fi',
            'exit 1',
        ].join('\n'),
    )
    chmodSync(dockerPath, 0o755)

    const env = {
        ...process.env,
        PATH: binDirectory + ':' + (process.env.PATH ?? ''),
        BACKUP_DIR: backupDirectory,
        AGE_IDENTITY: 'test-only-placeholder',
        DOCKER_TEST_ENDPOINT: 'ssh://remote.invalid',
        DOCKER_TEST_LOG: dockerLogPath,
    }
    delete env.POSTGRES_IMAGE
    delete env.DOCKER_HOST
    delete env.DOCKER_CONTEXT
    Object.assign(env, envOverrides)

    try {
        const result = spawnSync(
            'bash',
            [resolve(process.cwd(), 'scripts/backup/rehearse-isolated-restore.sh')],
            { encoding: 'utf8', env },
        )
        return {
            ...result,
            dockerCalls: existsSync(dockerLogPath) ? readFileSync(dockerLogPath, 'utf8') : '',
        }
    } finally {
        rmSync(testDirectory, { recursive: true, force: true })
    }
}

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

    it('accepts only an exact merged PR whose merge identity is bound into the artifact', () => {
        expect(workflow).toContain('fetch-depth: 0')
        expect(workflow).toContain("candidate_merge_sha=\"$(jq -r '.merge_commit_sha // empty' \"$pr_json\")\"")
        expect(workflow).toContain('git merge-base --is-ancestor "$candidate_merge_sha" "$control_sha"')
        expect(workflow).toContain('merge_commit_reachable')
        expect(workflow).toContain("candidate_mode='exact-merged-pr-head'")
        expect(workflow).toContain('candidate_merge_sha: ${{ steps.mode.outputs.candidate_merge_sha }}')
        expect(workflow).toContain('CANDIDATE_MERGE_SHA: ${{ needs.preflight.outputs.candidate_merge_sha }}')
        expect(workflow).toContain('"$WORKFLOW_RUN_ID" "$CANDIDATE_MERGE_SHA"')
    })

    it('requires the protected Environment for backup, restore, and alert jobs', () => {
        expect(workflow.match(/environment: runtime-backup/g)).toHaveLength(3)
        expect(workflow).toContain('pull-requests: read')
        expect(workflow).toContain('needs: [preflight, backup]')
    })

    it('keeps every protected executable trusted to main and never loads candidate code', () => {
        expect(workflow).toContain('ref: refs/heads/main')
        expect(workflow).toContain('bash scripts/backup/create-encrypted-backup.sh')
        expect(workflow).toContain('bash scripts/backup/rehearse-isolated-restore.sh')
        expect(workflow).toContain('exact-pr-artifact-identity.mjs')
        expect(workflow).not.toContain('git archive')
        expect(workflow).not.toContain('extract-exact-candidate-sources.sh')
        expect(workflow).not.toContain('CANDIDATE_SOURCE_ROOT')
        expect(workflow).not.toContain('BACKUP_SOURCE_ROOT')
        expect(workflow).not.toContain('RESTORE_SOURCE_ROOT')
        expect(workflow).not.toMatch(/candidate.*(?:bash|node|\.sh|\.mjs)/i)
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

    it('keeps the historical AMD64 backup pin and uses the new index for catalogue recovery', () => {
        expect(workflow).toContain(historicalBackupPostgresImage)
        expect(postgresImagePinHelper).toContain(approvedPostgresImage)
        expect(catalogueRestore).toContain(approvedPostgresImage)
        expect(qualityWorkflow).toContain('image: ' + approvedPostgresImage)
        expect(qualityWorkflow).toContain('POSTGRES_SNAPSHOT_INTEGRATION_IMAGE: ' + approvedPostgresImage)
        expect(rehomeWorkflow).toContain('POSTGRES_IMAGE: ' + approvedPostgresImage)
        expect(postgresImagePinHelper).not.toContain(historicalBackupPostgresImage)
        expect(catalogueRestore).not.toContain(historicalBackupPostgresImage)
        expect(qualityWorkflow).not.toContain(historicalBackupPostgresImage)
        expect(rehomeWorkflow).not.toContain(historicalBackupPostgresImage)
        expect(workflow).toContain('environment: runtime-backup')
        expect(workflow).toContain('actions/download-artifact@v4')
    })

    it('fails closed when the pinned PostgreSQL image is not already local', () => {
        expect(restoreScript).toContain('source "$repo_root/scripts/backup/postgres-image-pin.sh"')
        expect(restoreScript).toContain('reason=postgres_image_reference_invalid')
        expect(restoreScript.indexOf('dpg_resolve_postgres_image')).toBeLessThan(
            restoreScript.indexOf('docker image inspect'),
        )
        expect(restoreScript).toContain('docker image inspect "$postgres_image"')
        expect(restoreScript).toContain('reason=postgres_image_not_cached')
        expect(restoreScript).toContain('reason=docker_remote_daemon_disallowed')
        expect(restoreScript.indexOf('docker_remote_daemon_disallowed')).toBeLessThan(
            restoreScript.indexOf('docker image inspect'),
        )
        expect(restoreScript).toContain('--pull=never')
        expect(restoreScript).not.toContain('docker pull "$postgres_image"')
    })

    it.each([
        ['DOCKER_HOST', { DOCKER_HOST: 'tcp://remote.invalid:2375' }],
        ['DOCKER_CONTEXT', { DOCKER_CONTEXT: 'remote' }],
        ['conflicting DOCKER_HOST and DOCKER_CONTEXT', {
            DOCKER_HOST: 'tcp://remote.invalid:2375',
            DOCKER_CONTEXT: 'local',
        }],
    ])('rejects remote daemons selected through %s before image or backup access', (_label, overrides) => {
        const result = runRestorePreflight(overrides)

        expect(result.status).not.toBe(0)
        expect(result.stdout ?? '').toContain('reason=docker_remote_daemon_disallowed')
        expect(result.stdout ?? '').not.toContain('stage=decryption')
        expect(result.dockerCalls).not.toContain('image inspect')
    })

    it('uses the approved digest when POSTGRES_IMAGE is unset or exactly matches', () => {
        const unset = runPostgresImageResolver()
        const exact = runPostgresImageResolver(approvedPostgresImage)

        expect(unset.status).toBe(0)
        expect(unset.stdout?.trim()).toBe(approvedPostgresImage)
        expect(exact.status).toBe(0)
        expect(exact.stdout?.trim()).toBe(approvedPostgresImage)
    })

    it.each([
        ['empty override', ''],
        ['historical AMD64 child', historicalBackupPostgresImage],
        ['standalone ARM64 child', arm64ChildPostgresImage],
        ['mutable tag', 'postgres:17.6-bookworm'],
        ['wrong digest', 'postgres:17.6-bookworm@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
        ['shell-substitution override', '$(printf wrong-image)'],
    ])('rejects %s without resolving it as a command', (_label, override) => {
        const result = runPostgresImageResolver(override)

        expect(result.status).not.toBe(0)
        expect(result.stdout ?? '').toBe('')
    })
})
