import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = process.cwd()
const backup = readFileSync(resolve(root, 'scripts/backup/create-encrypted-backup.sh'), 'utf8')
const restore = readFileSync(resolve(root, 'scripts/backup/rehearse-isolated-restore.sh'), 'utf8')
const manifestSql = readFileSync(resolve(root, 'scripts/backup/runtime-manifest.sql'), 'utf8')
const validationSql = readFileSync(resolve(root, 'scripts/backup/validate-runtime.sql'), 'utf8')

describe('LEO-540 backup and restore public contracts', () => {
  it('creates a logical encrypted archive from only the approved schemas', () => {
    expect(backup).toContain('--format=custom')
    expect(backup).toContain('--schema=dpg_app --schema=dpg_control')
    expect(backup).toContain('age --encrypt --recipient "$AGE_RECIPIENT"')
    expect(backup).toContain('sha256sum')
    expect(backup).toContain('plaintext_workspace_not_tmpfs')
    expect(backup).toContain('BACKUP_RETENTION_DAYS')
    expect(backup).toContain("current_user = 'dpg_backup'")
    expect(backup).toContain("session_user = 'dpg_backup_login'")
    expect(backup).toContain("current_setting('transaction_read_only') = 'on'")
    expect(backup).not.toContain('age --decrypt')
    expect(backup).not.toContain('pg_dumpall')
  })

  it('verifies checksums and isolation before restoring', () => {
    const checksum = restore.indexOf('sha256sum -c')
    const decrypt = restore.indexOf('age --decrypt')
    const container = restore.indexOf('--network none')
    const restoreStream = restore.indexOf('pg_restore')
    const compare = restore.indexOf('manifest-contract.mjs" compare')

    expect(checksum).toBeGreaterThan(-1)
    expect(decrypt).toBeGreaterThan(checksum)
    expect(container).toBeGreaterThan(decrypt)
    expect(restoreStream).toBeGreaterThan(container)
    expect(compare).toBeGreaterThan(restoreStream)
    expect(restore).toContain('--read-only')
    expect(restore).toContain('--tmpfs /var/lib/postgresql/data')
    expect(restore).toContain('--tmpfs /tmp')
    expect(restore).toContain('--tmpfs /var/run/postgresql')
    expect(restore).toContain("test \"$(docker inspect --format '{{.HostConfig.NetworkMode}}' \"$container_name\")\" = 'none'")
    expect(restore).not.toContain('DATABASE_URL')
  })

  it('keeps manifests and validation row-free at the output boundary', () => {
    expect(manifestSql).not.toMatch(/SELECT\s+\*\s+FROM/i)
    expect(manifestSql).toContain("'rowCount'")
    expect(manifestSql).toContain("'sha256'")
    expect(validationSql).toContain('LEO540_RUNTIME_VALIDATION status=PASS')
    expect(validationSql).not.toContain('RAISE NOTICE')
    expect(validationSql).not.toContain('RAISE INFO')
  })
})
