import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const workflow = readFileSync(
    resolve(process.cwd(), '.github/workflows/backup-restore-rehearsal.yml'),
    'utf8',
)

describe('backup restore rehearsal workflow contract', () => {
    it('is manual-only and restricted to protected main', () => {
        expect(workflow).toContain('workflow_dispatch:')
        expect(workflow).not.toMatch(/^\s*(push|pull_request):/m)
        expect(workflow).toContain('test "$GITHUB_REF" = "refs/heads/main"')
        expect(workflow).toContain('environment: restore-rehearsal')
        expect(workflow).toContain('contents: read')
    })

    it('accepts only the temporary presigned-URL secret contract', () => {
        expect(workflow).toContain('RESTORE_REHEARSAL_DUMP_URL')
        expect(workflow).toContain('RESTORE_REHEARSAL_CHECKSUM_URL')
        expect(workflow).not.toMatch(/AWS_(ACCESS_KEY|SECRET|ROLE)|configure-aws-credentials|id-token:/)
        expect(workflow).not.toContain('actions/upload-artifact')
    })

    it('verifies the checksum before starting the isolated restore container', () => {
        const checksum = workflow.indexOf("stage='checksum_verification'")
        const container = workflow.indexOf("stage='container_start'")
        const restore = workflow.indexOf("stage='restore_stream'")

        expect(checksum).toBeGreaterThan(-1)
        expect(container).toBeGreaterThan(checksum)
        expect(restore).toBeGreaterThan(container)
        expect(workflow).toContain('sha256sum')
        expect(workflow).toContain('test "$expected_sha" = "$actual_sha"')
        expect(workflow).toContain('mktemp --directory /dev/shm/backup-restore-rehearsal.XXXXXX')
        expect(workflow).toContain("= 'tmpfs'")
        expect(workflow).toContain('curl --fail --silent --show-error --location "$RESTORE_REHEARSAL_DUMP_URL" --output "$archive_path"')
        expect(workflow).toContain('actual_sha="$(sha256sum "$archive_path"')
        expect(workflow).toContain('cat "$archive_path" |')
        expect(workflow.match(/curl --fail --silent --show-error --location "\$RESTORE_REHEARSAL_DUMP_URL"/g)).toHaveLength(1)
    })

    it('uses a network-disabled, tmpfs-only PostgreSQL restore target', () => {
        expect(workflow).toContain('--network none')
        expect(workflow).toContain('--read-only')
        expect(workflow).toContain('--tmpfs /var/lib/postgresql/data')
        expect(workflow).toContain('--tmpfs /tmp')
        expect(workflow).toContain('--tmpfs /var/run/postgresql')
        expect(workflow).toContain("test \"$bind_mount_count\" = '0'")
        expect(workflow).toContain('pg_restore -U postgres -d restorecheck')
        expect(workflow).toContain('pg_catalog.pg_tables')
        expect(workflow).toContain('pg_catalog.pg_indexes')
        expect(workflow).not.toContain('postgresql://')
        expect(workflow).not.toContain('DATABASE_URL')
    })
})
