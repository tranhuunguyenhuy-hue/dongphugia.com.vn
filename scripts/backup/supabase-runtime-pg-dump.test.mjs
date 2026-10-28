import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('Supabase runtime dump boundary', () => {
  it('pins the client, verifies TLS and streams snapshot formats without exposing connection material', async () => {
    const source = await readFile('scripts/backup/supabase-runtime-pg-dump.mjs', 'utf8')
    const workflow = await readFile('.github/workflows/supabase-runtime-issue160-recovery-once.yml', 'utf8')
    const scriptImage = source.match(/const POSTGRES_IMAGE = '([^']+)'/)?.[1]
    const workflowImage = workflow.match(/^  POSTGRES_IMAGE: (.+)$/m)?.[1]
    expect(scriptImage).toMatch(/^postgres:17\.6-bookworm@sha256:[0-9a-f]{64}$/)
    expect(scriptImage).toBe(workflowImage)
    expect(source).toContain("!name.startsWith('SUPABASE_REHOME_')")
    expect(source).toContain('PGPASSFILE=/run/dpg/.pgpass')
    expect(source).toContain('PGSSLMODE=verify-full')
    expect(source).toContain('PGSSLROOTCERT=/run/dpg/root.crt')
    expect(source).toContain("'--schema=dpg_v1', '--schema=dpg_v1_api'")
    expect(source).toContain('--affected-state-snapshot')
    expect(source).toContain('--affected-public-schema-snapshot')
    expect(source).toContain('--auth-extension-schema-acls')
    expect(source).toContain('--global-roles-snapshot')
    expect(source).toContain('--no-role-passwords')
    expect(source).toContain('--schema-only-equivalence')
    expect(source).toContain('--data-only-equivalence')
    expect(source).toContain('--role-state-manifest')
    expect(source).toContain("'inherit', 'pipe'")
    expect(source).not.toContain('SUPABASE_REHOME_DATABASE_URL}`')
  })
})
