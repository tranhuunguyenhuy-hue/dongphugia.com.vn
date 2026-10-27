import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('Supabase runtime psql credential boundary', () => {
  it('keeps the database URL out of psql argv and uses a tmpfs pgpass file', async () => {
    const [wrapper, restore, workflow] = await Promise.all([
      readFile('scripts/backup/supabase-runtime-psql.mjs', 'utf8'),
      readFile('scripts/backup/restore-catalogue-runtime.sh', 'utf8'),
      readFile('.github/workflows/supabase-runtime-rehome.yml', 'utf8'),
    ])

    expect(wrapper).toContain("!name.startsWith('SUPABASE_REHOME_')")
    expect(wrapper).toContain('validateSupabaseRuntimeRootCertificate')
    expect(wrapper).toContain("PGPASSFILE: pgpass")
    expect(wrapper).toContain("PGSSLMODE: 'verify-full'")
    expect(wrapper).toContain('PGSSLROOTCERT: rootCertificatePath')
    expect(wrapper).toContain('TMPFS_MAGIC')
    expect(wrapper).toContain("spawn('psql', psqlArgs")
    expect(wrapper).not.toContain("PGSSLMODE: 'require'")
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
