import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { buildPsqlChildEnvironment } from './supabase-runtime-psql.mjs'

describe('Supabase runtime psql credential boundary', () => {
  it('passes psql only its connection environment and harmless locale settings', () => {
    const childEnvironment = buildPsqlChildEnvironment({
      PATH: '/usr/bin:/bin',
      LANG: 'C.UTF-8',
      BACKUP_AGE_PRIVATE_KEY: 'private-key-placeholder',
      SUPABASE_MANAGEMENT_TOKEN: 'management-token-placeholder',
      SUPABASE_REHOME_DATABASE_URL: 'postgresql://redacted.invalid',
      PGPASSWORD: 'password-placeholder',
      GITHUB_TOKEN: 'github-token-placeholder',
      NODE_OPTIONS: '--require=unexpected',
    }, {
      host: 'db.bonxyxluzlxfkdetryoo.supabase.co',
      port: 5432,
      database: 'postgres',
      user: 'dpg_snapshot_login',
      options: '-c role=dpg_snapshot_readonly -c default_transaction_read_only=on',
    }, '/dev/shm/.pgpass', '/dev/shm/root.crt')

    expect(childEnvironment).toMatchObject({
      PATH: '/usr/bin:/bin',
      LANG: 'C.UTF-8',
      PGUSER: 'dpg_snapshot_login',
      PGSSLMODE: 'verify-full',
      PGOPTIONS: '-c role=dpg_snapshot_readonly -c default_transaction_read_only=on',
    })
    for (const name of [
      'BACKUP_AGE_PRIVATE_KEY', 'SUPABASE_MANAGEMENT_TOKEN', 'SUPABASE_REHOME_DATABASE_URL',
      'PGPASSWORD', 'GITHUB_TOKEN', 'NODE_OPTIONS',
    ]) expect(childEnvironment).not.toHaveProperty(name)
  })

  it('keeps the database URL out of psql argv and uses a tmpfs pgpass file', async () => {
    const [wrapper, restore, workflow, identity, snapshot] = await Promise.all([
      readFile('scripts/backup/supabase-runtime-psql.mjs', 'utf8'),
      readFile('scripts/backup/restore-catalogue-runtime.sh', 'utf8'),
      readFile('.github/workflows/supabase-runtime-rehome.yml', 'utf8'),
      readFile('scripts/backup/supabase-runtime-snapshot-identity.sql', 'utf8'),
      readFile('scripts/backup/supabase-runtime-snapshot.sh', 'utf8'),
    ])

    expect(wrapper).toContain("['PATH', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TZ']")
    expect(wrapper).toContain('validateSupabaseRuntimeRootCertificate')
    expect(wrapper).toContain("PGPASSFILE: pgpass")
    expect(wrapper).toContain("PGSSLMODE: 'verify-full'")
    expect(wrapper).toContain('PGSSLROOTCERT: rootCertificatePath')
    expect(wrapper).toContain('TMPFS_MAGIC')
    expect(wrapper).toContain('supabase-runtime-snapshot-identity.sql')
    expect(wrapper).toContain("spawn('psql', psqlArgs")
    expect(wrapper).not.toContain("PGSSLMODE: 'require'")
    expect(identity).toContain("session_user <> 'dpg_snapshot_login'")
    expect(identity).toContain("current_user <> 'dpg_snapshot_readonly'")
    expect(identity).toContain('and rolbypassrls')
    expect(identity).toContain("current_database(), 'TEMP'")
    expect(identity).toContain('SUPABASE_RUNTIME_SNAPSHOT_WRITE_PRIVILEGE_PRESENT')
    expect(snapshot.indexOf('snapshot_identity_invalid')).toBeLessThan(snapshot.indexOf('identity_value='))
    expect(restore).not.toContain('psql "$SUPABASE_REHOME_DATABASE_URL"')
    expect(workflow).not.toContain('psql "$SUPABASE_REHOME_DATABASE_URL"')
  })

  it('uses a checked CA bundle for every database client and keeps it off child environments', async () => {
    const [target, migrations, dump] = await Promise.all([
      readFile('scripts/backup/supabase-runtime-tls.mjs', 'utf8'),
      readFile('scripts/backup/supabase-runtime-migrations.mjs', 'utf8'),
      readFile('scripts/backup/supabase-runtime-pg-dump.mjs', 'utf8'),
    ])
    expect(target).toContain('new X509Certificate')
    expect(target).toContain('rejectUnauthorized: true')
    expect(target).toContain('servername: host')
    expect(migrations).toContain('supabaseRuntimeTlsOptions(target.host)')
    expect(dump).toContain('PGSSLMODE=verify-full')
    expect(dump).toContain('PGSSLROOTCERT=/run/dpg/root.crt')
  })
})
