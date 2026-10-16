import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  CANONICAL_V1_RESTORE_COUNT_TABLES,
  compareRuntimeManifestDetails,
  compareRuntimeManifests,
  RESTORE_COUNT_TABLES,
  validateRuntimeManifest,
} from './manifest-contract.mjs'

const target = {
  projectName: 'dongphugia-runtime',
  region: 'ap-southeast-1',
  environment: 'preview',
  dataClass: 'production-derived-reduced-runtime',
  productionDataAllowed: true,
  productionCredentialsAllowed: false,
  productionWritesAllowed: false,
  hardDatabaseCeilingBytes: 367001600,
}

const schema = {
  schemas: ['dpg_app', 'dpg_v1', 'dpg_control'],
  tables: [{ identity: 'dpg_app.products', columns: [{ name: 'id', type: 'integer' }] }],
  indexes: [],
  constraints: [],
  views: [],
  functions: [],
  triggers: [],
  policies: [],
}

const data = [
  { tableName: 'products', rowCount: 1, sha256: 'a'.repeat(64), sourceAuthority: 'codex_production_readonly' },
]

const restoreCounts = RESTORE_COUNT_TABLES.map((tableName) => ({
  tableName,
  rowCount: tableName === 'blog_categories' ? 6
    : tableName === 'blog_posts' ? 26
      : tableName === 'product_images' ? 110321
        : tableName === 'publishing_blog_post_media' ? 95
          : tableName === 'products' ? 17755
            : 0,
}))
const canonicalV1RestoreCounts = CANONICAL_V1_RESTORE_COUNT_TABLES.map((tableName) => ({
  tableName,
  rowCount: 0,
}))

const valid = () => ({
  formatVersion: 2,
  target: structuredClone(target),
  schema: structuredClone(schema),
  data: structuredClone(data),
  restoreCounts: structuredClone(restoreCounts),
  canonicalV1RestoreCounts: structuredClone(canonicalV1RestoreCounts),
})

describe('LEO-540 runtime manifest contract', () => {
  it('accepts the exact isolated runtime target and sanitized manifests', () => {
    expect(validateRuntimeManifest(valid())).toEqual([])
  })

  it('rejects a target drift and sensitive manifest fields', () => {
    const manifest = valid()
    manifest.target.projectName = 'production'
    manifest.data[0].password = 'must-not-be-present'

    expect(validateRuntimeManifest(manifest)).toEqual([
      'target project identity changed',
      'manifest contains a prohibited sensitive field',
    ])
  })

  it('accepts backup-time count changes when the exact restore matches that artifact', () => {
    const expected = valid()
    const actual = valid()
    expected.restoreCounts.find((entry) => entry.tableName === 'products').rowCount = 18000
    actual.restoreCounts.find((entry) => entry.tableName === 'products').rowCount = 18000
    actual.databaseSizeBytes = 123

    expect(compareRuntimeManifests(expected, actual)).toEqual([])
  })

  it('rejects one restored aggregate count that differs from the exact backup manifest', () => {
    const expected = valid()
    const actual = valid()
    actual.restoreCounts.find((entry) => entry.tableName === 'blog_posts').rowCount += 1

    expect(compareRuntimeManifests(expected, actual)).toEqual(['restore aggregate counts changed'])
  })

  it('still compares the source data manifest independently of restore counts', () => {
    const expected = valid()
    const actual = valid()
    actual.data[0].rowCount = 2
    expect(compareRuntimeManifests(expected, actual)).toEqual(['data row counts changed'])
  })

  it('reports only sanitized table identities for data hash mismatches', () => {
    const expected = valid()
    const actual = valid()
    expected.data[0].tableName = 'dpg_v1.categories'
    actual.data[0].tableName = 'dpg_v1.categories'
    actual.data[0].sha256 = 'b'.repeat(64)

    expect(compareRuntimeManifestDetails(expected, actual)).toEqual({
      violations: ['data row hashes changed'],
      tables: ['dpg_v1.categories'],
    })
  })

  it('prints mismatch table identities without printing row hashes', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'leo540-manifest-'))
    const expected = valid()
    const actual = valid()
    expected.data[0].tableName = 'dpg_v1.categories'
    actual.data[0].tableName = 'dpg_v1.categories'
    actual.data[0].sha256 = 'b'.repeat(64)
    const expectedPath = join(workspace, 'expected.json')
    const actualPath = join(workspace, 'actual.json')
    writeFileSync(expectedPath, JSON.stringify(expected))
    writeFileSync(actualPath, JSON.stringify(actual))

    try {
      const result = spawnSync(process.execPath, [
        resolve('scripts/backup/manifest-contract.mjs'),
        'compare',
        expectedPath,
        actualPath,
      ], { encoding: 'utf8' })

      expect(result.status).toBe(1)
      expect(result.stderr).toContain('categories=data_hashes tables=dpg_v1.categories')
      expect(result.stderr).not.toContain(expected.data[0].sha256)
      expect(result.stderr).not.toContain(actual.data[0].sha256)
    } finally {
      rmSync(workspace, { recursive: true, force: true })
    }
  })
})
