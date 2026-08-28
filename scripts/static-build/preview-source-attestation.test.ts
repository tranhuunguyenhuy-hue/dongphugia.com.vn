import { describe, expect, it } from 'vitest'
import { assertPreviewSourceAttestation } from './preview-source-attestation.mts'

const validAttestation = {
  currentUser: 'dpg_readonly',
  transactionReadOnly: 'on',
  targetContract: {
    project_name: 'dongphugia-runtime',
    region: 'ap-southeast-1',
    environment: 'preview',
    data_class: 'production-derived-reduced-runtime',
    production_data_allowed: true,
    production_credentials_allowed: false,
    production_writes_allowed: false,
  },
  freeTierGuard: {
    status: 'WITHIN_BUDGET',
    database_bytes: 102.95 * 1024 * 1024,
    hard_stop_350_mib_bytes: 367_001_600,
  },
  missingSelectTables: [],
}

describe('Preview source attestation', () => {
  it('accepts the exact isolated Preview target contract', () => {
    expect(assertPreviewSourceAttestation(validAttestation)).toMatchObject({
      project: 'dongphugia-runtime',
      region: 'ap-southeast-1',
      environment: 'preview',
      effectiveRole: 'dpg_readonly',
      transactionReadOnly: true,
      productionWritesAllowed: false,
    })
  })

  it('fails closed when any required table lacks SELECT access', () => {
    expect(() => assertPreviewSourceAttestation({
      ...validAttestation,
      missingSelectTables: ['product_families'],
    })).toThrow('missing SELECT grants: product_families')
  })
})
