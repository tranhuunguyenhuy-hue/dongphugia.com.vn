import { describe, expect, it } from 'vitest'

import { compareRuntimeManifests } from './manifest-contract.mjs'
import { CANONICAL_V1_RESTORE_COUNT_TABLES, RESTORE_COUNT_TABLES } from './manifest-contract.mjs'
import { validateRuntimeSemantics } from './runtime-validation-contract.mjs'

const semanticReport = () => ({
  requiredTablesPresent: true,
  duplicateSkuCount: 0,
  brokenBlogLinkCount: 0,
  ms885FamilyCount: 1,
  ms885MembershipCount: 18,
  ms885OpenGapCount: 2,
  ms885AcceptedGapMatchCount: 2,
  ms885UnexpectedOpenGapCount: 0,
  ms885BadMembershipCount: 0,
  ms885ExcludedMembershipCount: 0,
  v1MediaAssetCount: 0,
  v1MediaVariantCount: 0,
  v1PendingMediaCount: 0,
  v1ReadyMediaCount: 0,
  v1TombstonedMediaCount: 0,
  v1ProductCount: 0,
  v1ProductFamilyCount: 0,
  v1FamilyMembershipCount: 0,
  v1StaffUserCount: 0,
  v1StaffRoleCount: 0,
  v1QuoteCount: 0,
  v1OrderCount: 0,
  v1PaymentTransactionCount: 0,
  v1OrphanMediaReferenceCount: 0,
  v1MediaKeyViolationCount: 0,
  v1PrimaryMediaViolationCount: 0,
  v1ReadyWithoutProviderVerificationCount: 0,
  v1ReadyImageVariantViolationCount: 0,
})

const manifest = () => ({
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
  schema: {
    schemas: ['dpg_app', 'dpg_v1', 'dpg_control'],
    tables: [],
    indexes: [],
    constraints: [],
    views: [],
    functions: [],
    triggers: [],
    policies: [],
  },
  data: [],
  restoreCounts: [
    ...RESTORE_COUNT_TABLES.map((tableName) => ({ tableName, rowCount: 0 })),
  ],
  canonicalV1RestoreCounts: CANONICAL_V1_RESTORE_COUNT_TABLES
    .map((tableName) => ({ tableName, rowCount: 0 })),
})

describe('LEO-540 restored runtime semantic contract', () => {
  it('accepts the canonical semantic invariants', () => {
    expect(validateRuntimeSemantics(semanticReport())).toEqual([])
  })

  it('rejects a duplicate SKU even when artifact counts match', () => {
    const report = semanticReport()
    report.duplicateSkuCount = 1

    expect(validateRuntimeSemantics(report)).toContain('duplicate SKU invariant failed')
  })

  it('rejects a broken Blog or managed-media relationship', () => {
    const report = semanticReport()
    report.brokenBlogLinkCount = 1

    expect(validateRuntimeSemantics(report)).toContain('Blog relationship invariant failed')
  })

  it('rejects altered MS885 canonical family state', () => {
    const report = semanticReport()
    report.ms885MembershipCount = 17
    report.ms885OpenGapCount = 3

    expect(validateRuntimeSemantics(report)).toEqual([
      'MS885 membership invariant failed',
      'MS885 catalogue gap invariant failed',
    ])
  })

  it('does not let a matching manifest bless semantic corruption', () => {
    const expected = manifest()
    const actual = manifest()
    const report = semanticReport()
    report.ms885ExcludedMembershipCount = 1

    expect(compareRuntimeManifests(expected, actual)).toEqual([])
    expect(validateRuntimeSemantics(report)).toEqual(['MS885 excluded member invariant failed'])
  })
})
