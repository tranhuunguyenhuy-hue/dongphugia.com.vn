import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

import {
  ADOPTED_CHECKPOINT_MIGRATIONS,
  EXPECTED_RUNTIME_MIGRATIONS,
  executeRuntimeMigrations,
  stripOuterTransaction,
  validateDatabaseSize,
} from './supabase-runtime-migrations.mjs'

async function expectedLedgerPrefix(length) {
  return Promise.all(EXPECTED_RUNTIME_MIGRATIONS.slice(0, length).map(async (filename) => {
    const bytes = await readFile(`supabase/migrations/${filename}`)
    return {
      version: filename.slice(0, 14),
      filename,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    }
  }))
}

function migrationReadClient(ledgerRows) {
  const statements = []
  const client = {
    async query(sql) {
      statements.push(sql)
      if (sql.includes('pg_database_size(current_database())')) {
        return { rows: [{ current_size_bytes: '1000', hard_ceiling_bytes: '367001600' }] }
      }
      if (sql.includes("to_regclass('dpg_control.runtime_migration_ledger')")) {
        return { rows: [{ present: true }] }
      }
      if (sql.includes('from dpg_control.runtime_migration_ledger')) {
        return { rows: ledgerRows }
      }
      return { rows: [] }
    },
  }
  return { client, statements }
}

describe('Supabase runtime migration runner contract', () => {
  it('pins the exact adopted checkpoint and complete ordered migration set', async () => {
    const actual = (await readdir('supabase/migrations'))
      .filter((name) => name.endsWith('.sql'))
      .sort()

    expect(ADOPTED_CHECKPOINT_MIGRATIONS).toHaveLength(7)
    expect(ADOPTED_CHECKPOINT_MIGRATIONS.at(-1)).toBe('20260828163113_leo541_runtime_api.sql')
    expect(EXPECTED_RUNTIME_MIGRATIONS).toEqual(actual)
    expect(EXPECTED_RUNTIME_MIGRATIONS.indexOf('20260828183200_leo540_backup_coverage_prerequisite.sql'))
      .toBe(EXPECTED_RUNTIME_MIGRATIONS.indexOf('20260828183000_leo542_backup_role_prerequisite.sql') + 1)
    expect(EXPECTED_RUNTIME_MIGRATIONS.indexOf('20260828183200_leo540_backup_coverage_prerequisite.sql'))
      .toBeLessThan(EXPECTED_RUNTIME_MIGRATIONS.indexOf('20261016090000_leo560_preview_rls_hardening.sql'))
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

  it('fails closed at the 350 MiB database-size ceiling', () => {
    expect(validateDatabaseSize('367001599', '367001600')).toBe(367001599n)
    expect(() => validateDatabaseSize('367001600', '367001600'))
      .toThrow('database_size_hard_limit_reached')
    expect(() => validateDatabaseSize('367001601', '367001600'))
      .toThrow('database_size_hard_limit_reached')
    expect(() => validateDatabaseSize('1', '367001599'))
      .toThrow('database_size_contract_mismatch')
    expect(() => validateDatabaseSize(null, '367001600'))
      .toThrow('database_size_unavailable')
    expect(() => validateDatabaseSize('', '367001600'))
      .toThrow('database_size_unavailable')
  })

  it('refuses a non-prefix ledger before executing migration SQL', async () => {
    const missingMigration = EXPECTED_RUNTIME_MIGRATIONS[1]
    const ledgerRows = await expectedLedgerPrefix(EXPECTED_RUNTIME_MIGRATIONS.length)
    ledgerRows.splice(1, 1)
    const { client, statements } = migrationReadClient(ledgerRows)
    const missingMigrationSql = stripOuterTransaction(await readFile(
      `supabase/migrations/${missingMigration}`,
      'utf8',
    ))

    await expect(executeRuntimeMigrations(client, 'apply'))
      .rejects.toThrow('migration_ledger_non_prefix')
    expect(statements.some((sql) => sql.trim() === missingMigrationSql.trim())).toBe(false)
  })

  it.each([0, ADOPTED_CHECKPOINT_MIGRATIONS.length - 1])(
    'refuses an existing ledger with only %i adopted checkpoint entries',
    async (ledgerLength) => {
      const ledgerRows = await expectedLedgerPrefix(ledgerLength)
      const { client, statements } = migrationReadClient(ledgerRows)
      const nextMigration = EXPECTED_RUNTIME_MIGRATIONS[ledgerLength]
      const nextMigrationSql = stripOuterTransaction(await readFile(
        `supabase/migrations/${nextMigration}`,
        'utf8',
      ))

      await expect(executeRuntimeMigrations(client, 'apply'))
        .rejects.toThrow('migration_checkpoint_incomplete')
      expect(statements.some((sql) => sql.trim() === nextMigrationSql.trim())).toBe(false)
    },
  )

  it('keeps database failures sanitized and never logs database error text', async () => {
    const runner = await readFile('scripts/backup/supabase-runtime-migrations.mjs', 'utf8')
    expect(runner).toContain('reason=database_operation_failed')
    expect(runner).toContain('pg_database_size(current_database())')
    expect(runner).toContain('force row level security')
    expect(runner).toContain('create policy runtime_migration_admin')
    expect(runner).toContain('grant select, insert on table dpg_control.runtime_migration_ledger to postgres')
    expect(runner).toContain("execFileSync('bash', ['scripts/backup/attest-supabase-runtime-checkpoint.sh']")
    expect(runner).not.toMatch(/error\.(detail|hint|where|query|stack)/)
  })
})
