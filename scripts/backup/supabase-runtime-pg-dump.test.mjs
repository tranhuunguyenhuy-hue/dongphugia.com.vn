import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('Supabase runtime checkpoint dump boundary', () => {
  it('uses the pinned PostgreSQL client and keeps the database URL out of argv and child env', async () => {
    const source = await readFile('scripts/backup/supabase-runtime-pg-dump.mjs', 'utf8')
    expect(source).toContain('postgres:17.6-bookworm@sha256:')
    expect(source).toContain("name !== 'SUPABASE_REHOME_DATABASE_URL'")
    expect(source).toContain('PGPASSFILE=/run/dpg/.pgpass')
    expect(source).toContain("'--schema=dpg_app', '--schema=dpg_control'")
    expect(source).not.toContain('SUPABASE_REHOME_DATABASE_URL}`')
  })
})
