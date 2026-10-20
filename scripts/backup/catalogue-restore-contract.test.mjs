import { describe, expect, it } from 'vitest'

import {
  CATALOGUE_TABLES,
  CATALOGUE_RESTORE_ORDER,
  MIGRATION_SEED_TABLES,
  buildRehearsalTargetCheckSql,
  buildCatalogueSnapshotSql,
  buildCatalogueValidationSql,
  catalogueTableArguments,
  compareCatalogueManifests,
  validateCatalogueSourceManifest,
} from './catalogue-restore-contract.mjs'

const expectedTables = [
  'brands',
  'catalog_taxons',
  'categories',
  'colors',
  'external_taxonomy_mappings',
  'filter_definitions',
  'materials',
  'origins',
  'product_attribute_values',
  'product_descriptions',
  'product_documents',
  'product_feature_values',
  'product_features',
  'product_images',
  'product_package_items',
  'product_relationships',
  'product_secondary_subcategories',
  'product_source_mappings',
  'product_spec_values',
  'product_sub_types',
  'product_taxon_assignments',
  'product_types',
  'product_variant_groups',
  'products',
  'spec_definitions',
  'spec_options',
  'subcategories',
]

const expectedRestoreOrder = [
  'brands', 'catalog_taxons', 'categories', 'colors', 'materials', 'origins',
  'product_variant_groups', 'subcategories', 'product_types', 'product_sub_types',
  'spec_definitions', 'spec_options', 'products', 'external_taxonomy_mappings',
  'filter_definitions', 'product_attribute_values', 'product_descriptions',
  'product_documents', 'product_features', 'product_feature_values', 'product_images',
  'product_package_items', 'product_relationships', 'product_secondary_subcategories',
  'product_source_mappings', 'product_spec_values', 'product_taxon_assignments',
]

const hash = (character) => character.repeat(64)

function sourceManifest() {
  return {
    formatVersion: 2,
    target: {
      projectName: 'dongphugia-runtime',
      region: 'ap-southeast-1',
      environment: 'preview',
      dataClass: 'production-derived-reduced-runtime',
      productionDataAllowed: true,
      productionCredentialsAllowed: false,
      productionWritesAllowed: false,
      hardDatabaseCeilingBytes: 367001600,
    },
    artifactIdentity: {
      prNumber: 156,
      candidateSha: 'd300eb696a94acfa557fbaf7a8c0e66876dafb63',
      controlSha: 'ce64e8cc7caf91b8bf2e4e2315d49e21bacdfffc',
      mergeSha: '59d9ea02dbceb5a3b83d00f929a8ee3a8f70cc35',
      workflowRunId: '38915575745',
      backupTimestamp: '2026-10-16T14:27:48Z',
      manifestVersion: 2,
    },
    data: [
      ...expectedTables.map((tableName, index) => ({
        tableName,
        rowCount: index,
        sha256: hash(index % 2 === 0 ? 'a' : 'b'),
        sourceAuthority: 'codex_production_readonly',
      })),
      { tableName: 'blog_posts', rowCount: 17, sha256: hash('c'), sourceAuthority: 'owner-blog-readonly' },
      { tableName: 'admin_users', rowCount: 1, sha256: hash('d'), sourceAuthority: 'owner-reconciliation-readonly' },
      { tableName: 'dpg_v1.staff_users', rowCount: 1, sha256: hash('e'), sourceAuthority: 'canonical_dpg_v1' },
    ],
  }
}

function catalogueManifest(overrides = {}) {
  return {
    contract: 'dongphugia:catalogue-filtered-restore:v1',
    tables: expectedTables.map((tableName, index) => ({
      tableName,
      rowCount: index,
      sha256: hash(index % 2 === 0 ? 'a' : 'b'),
    })),
    excludedRows: [],
    ...overrides,
  }
}

describe('catalogue-only restore contract', () => {
  it('pins the complete product catalogue allowlist and no sensitive surface', () => {
    expect(CATALOGUE_TABLES).toEqual(expectedTables)
    expect([...CATALOGUE_RESTORE_ORDER].sort()).toEqual(expectedTables)
    expect(catalogueTableArguments()).toEqual(
      expectedRestoreOrder.flatMap((table) => ['--table', table]),
    )
    expect(CATALOGUE_TABLES).not.toEqual(expect.arrayContaining([
      'admin_users', 'admin_sessions', 'customers', 'orders', 'order_items',
      'quote_requests', 'quote_items', 'blog_posts', 'publishing_machine_identities',
    ]))
    expect(MIGRATION_SEED_TABLES).toEqual([
      'product_families', 'product_family_configuration_groups',
      'product_family_catalogue_gaps', 'product_family_memberships',
    ])
  })

  it('accepts only the exact retained source artifact identity', () => {
    expect(validateCatalogueSourceManifest(sourceManifest(), {
      prNumber: 156,
      candidateSha: 'd300eb696a94acfa557fbaf7a8c0e66876dafb63',
      controlSha: 'ce64e8cc7caf91b8bf2e4e2315d49e21bacdfffc',
      mergeSha: '59d9ea02dbceb5a3b83d00f929a8ee3a8f70cc35',
      workflowRunId: '38915575745',
    })).toEqual([])

    const drifted = sourceManifest()
    drifted.artifactIdentity.workflowRunId = '38915575746'
    expect(validateCatalogueSourceManifest(drifted, {
      prNumber: 156,
      candidateSha: 'd300eb696a94acfa557fbaf7a8c0e66876dafb63',
      controlSha: 'ce64e8cc7caf91b8bf2e4e2315d49e21bacdfffc',
      mergeSha: '59d9ea02dbceb5a3b83d00f929a8ee3a8f70cc35',
      workflowRunId: '38915575745',
    })).toEqual(['source artifact identity changed'])
  })

  it('reports only mismatched table names and never hashes or row data', () => {
    const actual = catalogueManifest()
    actual.tables.find((entry) => entry.tableName === 'products').rowCount += 1
    actual.tables.find((entry) => entry.tableName === 'product_images').sha256 = hash('f')

    expect(compareCatalogueManifests(catalogueManifest(), actual)).toEqual({
      violations: ['catalogue row counts changed', 'catalogue row hashes changed'],
      tables: ['product_images', 'products'],
    })
  })

  it('fails when any excluded surface contains rows', () => {
    const actual = catalogueManifest({ excludedRows: ['blog_posts'] })
    expect(compareCatalogueManifests(catalogueManifest(), actual)).toEqual({
      violations: ['excluded rows are present'],
      tables: ['blog_posts'],
    })
  })

  it('builds row-free SQL that validates every allowed table and dynamically rejects exclusions', () => {
    const validationSql = buildCatalogueValidationSql(catalogueManifest())
    const snapshotSql = buildCatalogueSnapshotSql()

    for (const table of expectedTables) {
      expect(validationSql).toContain(`dpg_app.${table}`)
      expect(snapshotSql).toContain(`dpg_app.${table}`)
    }
    for (const sql of [validationSql, snapshotSql]) {
      expect(sql).toContain('to_jsonb(item)::text COLLATE "C"')
      expect(sql).toContain('excludedRows')
      expect(sql).toContain("n.nspname = 'dpg_app'")
      expect(sql).not.toMatch(/select\s+\*\s+from/i)
      expect(sql).not.toMatch(/admin_users.*email|blog_posts.*content|customers.*phone/i)
      for (const table of MIGRATION_SEED_TABLES) expect(sql).toContain(`'${table}'`)
    }
    expect(validationSql).toContain('CATALOGUE_MANIFEST_MISMATCH table=products')
    expect(validationSql).toContain('CATALOGUE_EXCLUDED_ROWS table=%')
  })

  it('checks every noncatalogue target schema, seeds, sequences and large objects', () => {
    const sql = buildRehearsalTargetCheckSql()
    expect(sql).toContain("n.nspname <> 'information_schema'")
    expect(sql).toContain("n.nspname !~ '^pg_'")
    expect(sql).toContain("c.relkind in ('r', 'p', 'm', 'f')")
    expect(sql).toContain('pg_largeobject_metadata')
    expect(sql).toContain("c.relkind = 'S'")
    expect(sql).toContain('last_value <> $1')
    expect(sql).toContain('CATALOGUE_REHEARSAL_EXCLUDED_ROWS')
    expect(sql).toContain('CATALOGUE_REHEARSAL_EXCLUDED_SEQUENCE')
    expect(sql).not.toMatch(/select\s+\*\s+from/i)
  })
})
