import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('Supabase runtime psql credential boundary', () => {
  it('keeps the database URL out of psql argv and uses a tmpfs pgpass file', async () => {
    const [wrapper, restore, workflow] = await Promise.all([
      readFile('scripts/backup/supabase-runtime-psql.mjs', 'utf8'),
      readFile('scripts/backup/restore-catalogue-runtime.sh', 'utf8'),
      readFile('.github/workflows/supabase-runtime-rehome.yml', 'utf8'),
    ])

    expect(wrapper).toContain("name !== 'SUPABASE_REHOME_DATABASE_URL'")
    expect(wrapper).toContain("PGPASSFILE: pgpass")
    expect(wrapper).toContain("PGSSLMODE: 'require'")
    expect(wrapper).toContain('TMPFS_MAGIC')
    expect(wrapper).toContain("spawn('psql', psqlArgs")
    expect(restore).not.toContain('psql "$SUPABASE_REHOME_DATABASE_URL"')
    expect(workflow).not.toContain('psql "$SUPABASE_REHOME_DATABASE_URL"')
  })
})
