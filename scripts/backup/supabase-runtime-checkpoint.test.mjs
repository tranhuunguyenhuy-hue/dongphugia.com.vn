import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('Supabase runtime checkpoint adoption', () => {
  it('replays the exact seven migrations and separates read-only from rollback-only acceptance', async () => {
    const [script, acceptance, behavior] = await Promise.all([
      readFile('scripts/backup/attest-supabase-runtime-checkpoint.sh', 'utf8'),
      readFile('supabase/tests/supabase_runtime_adoption_checkpoint.sql', 'utf8'),
      readFile('supabase/tests/supabase_runtime_adoption_behavior.sql', 'utf8'),
    ])

    expect(script.match(/2026\d+_[a-z0-9_]+\.sql/g)).toHaveLength(7)
    expect(script).toContain('--network none')
    expect(script).toContain('supabase-runtime-pg-dump.mjs')
    expect(script).toContain('schema_equivalence')
    expect(script).toContain('supabase_runtime_adoption_checkpoint.sql')
    expect(script).toContain('CHECKPOINT_ATTESTATION_MODE')
    expect(acceptance).toContain('SUPABASE_CHECKPOINT_MEMBERSHIP_FAILED')
    expect(acceptance).toContain('SUPABASE_CHECKPOINT_ROLE_SETTING_FAILED')
    expect(acceptance).toContain('SUPABASE_CHECKPOINT_SEED_DRIFT_FAILED')
    expect(acceptance).toContain('SUPABASE_CHECKPOINT_UNEXPECTED_ROWS')
    expect(acceptance).toContain('rolconnlimit as connection_limit')
    expect(acceptance).toContain('repeatable read read only')
    expect(acceptance).not.toMatch(/\binsert\s+into\b/i)
    expect(behavior).toContain('SUPABASE_CHECKPOINT_CROSS_OWNER_VISIBILITY_FAILED')
    expect(behavior).toContain('isolation level serializable')
    expect(behavior.trimEnd()).toMatch(/rollback;$/)
    expect(acceptance.trimEnd()).toMatch(/rollback;$/)
  })
})
