import { readFile, readdir } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

import {
  ADOPTED_CHECKPOINT_MIGRATIONS,
  EXPECTED_RUNTIME_MIGRATIONS,
  stripOuterTransaction,
} from './supabase-runtime-migrations.mjs'

describe('Supabase runtime migration runner contract', () => {
  it('pins the exact adopted checkpoint and complete ordered migration set', async () => {
    const actual = (await readdir('supabase/migrations'))
      .filter((name) => name.endsWith('.sql'))
      .sort()

    expect(ADOPTED_CHECKPOINT_MIGRATIONS).toHaveLength(7)
    expect(ADOPTED_CHECKPOINT_MIGRATIONS.at(-1)).toBe('20260828163113_leo541_runtime_api.sql')
    expect(EXPECTED_RUNTIME_MIGRATIONS).toEqual(actual)
    expect(EXPECTED_RUNTIME_MIGRATIONS.at(-1)).toBe('20261016090000_leo560_preview_rls_hardening.sql')
  })

  it('normalizes only a single outer transaction so ledger recording stays atomic', async () => {
    for (const filename of EXPECTED_RUNTIME_MIGRATIONS) {
      const sql = await readFile(`supabase/migrations/${filename}`, 'utf8')
      const normalized = stripOuterTransaction(sql)
      expect(normalized).not.toMatch(/^\s*(begin|commit|rollback|start transaction)\s*;/im)
    }

    expect(() => stripOuterTransaction('begin;\nselect 1;\ncommit;\ncommit;'))
      .toThrow('migration_transaction_contract_changed')
  })

  it('keeps database failures sanitized and never logs database error text', async () => {
    const runner = await readFile('scripts/backup/supabase-runtime-migrations.mjs', 'utf8')
    expect(runner).toContain('reason=database_operation_failed')
    expect(runner).toContain('force row level security')
    expect(runner).toContain('create policy runtime_migration_admin')
    expect(runner).toContain('grant select, insert on table dpg_control.runtime_migration_ledger to postgres')
    expect(runner).toContain("execFileSync('bash', ['scripts/backup/attest-supabase-runtime-checkpoint.sh']")
    expect(runner).not.toMatch(/error\.(detail|hint|where|query|stack)/)
  })
})
