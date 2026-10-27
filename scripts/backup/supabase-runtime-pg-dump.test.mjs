import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('Supabase runtime dump boundary', () => {
  it('pins the client, verifies TLS and streams snapshot formats without exposing connection material', async () => {
    const source = await readFile('scripts/backup/supabase-runtime-pg-dump.mjs', 'utf8')
    expect(source).toContain('postgres:17.6-bookworm@sha256:')
    expect(source).toContain("!name.startsWith('SUPABASE_REHOME_')")
    expect(source).toContain('PGPASSFILE=/run/dpg/.pgpass')
    expect(source).toContain('PGSSLMODE=verify-full')
    expect(source).toContain('PGSSLROOTCERT=/run/dpg/root.crt')
    expect(source).toContain("'--schema=dpg_app', '--schema=dpg_control'")
    expect(source).toContain('--affected-state-snapshot')
    expect(source).toContain('--global-roles-snapshot')
    expect(source).toContain('--no-role-passwords')
    expect(source).toContain("'inherit', 'pipe'")
    expect(source).not.toContain('SUPABASE_REHOME_DATABASE_URL}`')
  })
})
