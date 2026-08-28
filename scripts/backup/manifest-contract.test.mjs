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

const valid = () => ({ formatVersion: 1, target: structuredClone(target), schema: structuredClone(schema), data: structuredClone(data) })

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

  it('compares schema and data manifests without comparing database size', () => {
    const expected = valid()
    const actual = valid()
    actual.databaseSizeBytes = 123

    expect(compareRuntimeManifests(expected, actual)).toEqual([])
    actual.data[0].rowCount = 2
    expect(compareRuntimeManifests(expected, actual)).toEqual(['data row counts changed'])
  })
})
