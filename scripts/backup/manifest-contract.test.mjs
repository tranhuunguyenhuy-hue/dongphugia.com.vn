import { describe, expect, it } from 'vitest'

import {
  compareRuntimeManifests,
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
  schemas: ['dpg_app', 'dpg_control'],
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

const restoreCounts = [
  { tableName: 'blog_categories', rowCount: 6 },
  { tableName: 'blog_post_tags', rowCount: 0 },
  { tableName: 'blog_posts', rowCount: 26 },
  { tableName: 'blog_tags', rowCount: 0 },
  { tableName: 'product_images', rowCount: 110321 },
  { tableName: 'products', rowCount: 17755 },
  { tableName: 'publishing_blog_post_media', rowCount: 95 },
]

const valid = () => ({
  formatVersion: 2,
  target: structuredClone(target),
  schema: structuredClone(schema),
  data: structuredClone(data),
  restoreCounts: structuredClone(restoreCounts),
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
})
