import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  adaptPhase2MigrationForSyntheticPreview,
  assertSyntheticPreviewDatabaseUrl,
  assertSyntheticPreviewLedger,
  SYNTHETIC_PREVIEW_MIGRATIONS,
  SYNTHETIC_PREVIEW_TARGET,
  sha256,
} from './synthetic-preview-contract.mjs'

describe('synthetic Preview target contract', () => {
  it('accepts only a TLS PostgreSQL URL for the exact disposable test project', () => {
    expect(assertSyntheticPreviewDatabaseUrl(
      'postgresql://postgres:pw@db.uybumsnyqpwcidjxmfsv.supabase.co:5432/postgres?sslmode=require',
    )).toMatchObject({ projectRef: SYNTHETIC_PREVIEW_TARGET.projectRef, database: 'postgres' })

    for (const url of [
      'postgresql://postgres:pw@db.bonxyxluzlxfkdetryoo.supabase.co:5432/postgres?sslmode=require',
      'postgresql://postgres:pw@db.uybumsnyqpwcidjxmfsv.supabase.co:5432/postgres',
      'postgresql://postgres:pw@db.uybumsnyqpwcidjxmfsv.supabase.co:5433/postgres?sslmode=require',
      'https://uybumsnyqpwcidjxmfsv.supabase.co',
    ]) expect(() => assertSyntheticPreviewDatabaseUrl(url)).toThrow('DPG_SYNTHETIC_PREVIEW_DATABASE_TARGET_REJECTED')
  })

  it('transforms only the exact two Phase 2 target guards and keeps the production runner untouched', async () => {
    const guardMigrations = SYNTHETIC_PREVIEW_MIGRATIONS.slice(0, 2)
    for (const migration of guardMigrations) {
      const source = await readFile(resolve(migration.path), 'utf8')
      const adapted = adaptPhase2MigrationForSyntheticPreview({
        version: migration.version,
        name: migration.name,
        sql: source,
      })
      expect(adapted).toContain("project_name = 'dongphugia-phase2-preview-290'")
      expect(adapted).toContain("environment = 'preview_synthetic'")
      expect(adapted).toContain("data_class = 'synthetic-with-approved-public-fixtures'")
      expect(adapted).toContain('and not production_data_allowed')
      expect(adapted).not.toContain("project_name = 'dongphugia-runtime'")
      expect(adapted.slice(adapted.indexOf('$target_preflight$;'))).toBe(source.slice(source.indexOf('$target_preflight$;')))
    }

    const untouched = await readFile(resolve(SYNTHETIC_PREVIEW_MIGRATIONS[2].path), 'utf8')
    expect(adaptPhase2MigrationForSyntheticPreview({
      version: SYNTHETIC_PREVIEW_MIGRATIONS[2].version,
      name: SYNTHETIC_PREVIEW_MIGRATIONS[2].name,
      sql: untouched,
    })).toBe(untouched)
  })

  it('fails closed when a migration changes its allowlisted identity or target guard shape', () => {
    expect(() => adaptPhase2MigrationForSyntheticPreview({
      version: '20261104154854', name: 'other', sql: "do $target_preflight$ begin end $target_preflight$;",
    })).toThrow('DPG_SYNTHETIC_PREVIEW_MIGRATION_NOT_ALLOWLISTED')
    expect(() => adaptPhase2MigrationForSyntheticPreview({
      version: '20261104154854', name: 'phase2_guest_order_intake', sql: 'do $target_preflight$ begin end $target_preflight$;',
    })).toThrow('DPG_SYNTHETIC_PREVIEW_PROJECT_GUARD_DRIFT')
  })

  it('accepts only exact-source-hash ledger records for this Preview project', () => {
    const expected = [{ version: '20261104154854', name: 'phase2_guest_order_intake', sha256: 'a'.repeat(64) }]
    expect(assertSyntheticPreviewLedger([{
      source_version: expected[0].version,
      source_name: expected[0].name,
      source_sha256: expected[0].sha256,
      target_project_ref: SYNTHETIC_PREVIEW_TARGET.projectRef,
    }], expected).size).toBe(1)
    expect(() => assertSyntheticPreviewLedger([{
      source_version: expected[0].version,
      source_name: expected[0].name,
      source_sha256: 'b'.repeat(64),
      target_project_ref: SYNTHETIC_PREVIEW_TARGET.projectRef,
    }], expected)).toThrow('DPG_SYNTHETIC_PREVIEW_LEDGER_MISMATCH')
    expect(sha256('source')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('keeps the synthetic transition explicit and fail-closed', async () => {
    const migration = await readFile(resolve('supabase/preview_migrations/20261110150000_phase2_synthetic_preview_contract.sql'), 'utf8')
    expect(migration).toContain("target.project_name <> 'dongphugia-runtime'")
    expect(migration).toContain("target.project_name = 'dongphugia-phase2-preview-290'")
    expect(migration).toContain("target.data_class <> 'production-derived-reduced-runtime'")
    expect(migration).toContain('DPG_SYNTHETIC_PREVIEW_DATA_BOUNDARY_FAILED')
    expect(migration).toContain("target_project_ref = 'uybumsnyqpwcidjxmfsv'")
    expect(migration).toContain('alter table dpg_control.target_contract')
    expect(migration).toContain('not production_data_allowed')
  })

  it('limits public order-price and publication exceptions to the two synthetic SKU rows', async () => {
    const guardEntry = SYNTHETIC_PREVIEW_MIGRATIONS.find(entry => entry.version === '20261110170000')
    const seedEntry = SYNTHETIC_PREVIEW_MIGRATIONS.find(entry => entry.version === '20261110180000')
    expect(guardEntry).toBeDefined()
    expect(seedEntry).toBeDefined()
    const [guard, seed] = await Promise.all([
      readFile(resolve(guardEntry.path), 'utf8'),
      readFile(resolve(seedEntry.path), 'utf8'),
    ])
    expect(guard).toContain("target.project_name = 'dongphugia-phase2-preview-290'")
    expect(guard).toContain("product.sku = 'DPG-290-SYN-A'")
    expect(guard).toContain("product.sku = 'DPG-290-SYN-B'")
    expect(guard).toContain("product.price = 100000")
    expect(guard).toContain("product.price = 120000")
    expect(guard).toContain("product.price_source = 'synthetic-preview'")
    expect(guard).toContain("source_system = 'synthetic-preview'")
    expect(guard).toContain('not p.prosecdef')
    expect(guard).toContain('phase2_preview_synthetic_product_eligible(v_product.id)')
    expect(guard).toContain('phase2_preview_synthetic_product_eligible(v_old.id)')
    expect(seed).toContain("'public', 'public', 'public', 'visible'")
    expect(seed).toContain("'priced', 'synthetic-preview', 'low'")
    expect(seed).toContain("'noindex', false")
    expect(seed).not.toContain('production-derived')
    expect(seed).not.toContain('price_confidence = \'high\'')
  })
})
