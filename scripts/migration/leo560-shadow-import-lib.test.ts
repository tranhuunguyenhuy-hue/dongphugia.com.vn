import { describe, expect, it } from 'vitest'
import {
  assertApprovedExecutionEnvironment,
  assertExactSnapshotUrl,
  digestRows,
  parseSupabasePreviewTarget,
} from './leo560-shadow-import-lib'

describe('LEO-560 catalogue shadow-import boundary', () => {
  it('accepts only the exact Singapore Supabase Preview identity', () => {
    expect(parseSupabasePreviewTarget(
      'postgresql://postgres:secret@db.tlmgudfhsyzayiazuugf.supabase.co:5432/postgres?sslmode=require',
    )).toMatchObject({
      host: 'db.tlmgudfhsyzayiazuugf.supabase.co',
      port: 5432,
      database: 'postgres',
      user: 'postgres',
    })
    expect(parseSupabasePreviewTarget(
      'postgresql://postgres.tlmgudfhsyzayiazuugf:secret@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres',
    )).toMatchObject({ user: 'postgres.tlmgudfhsyzayiazuugf', port: 6543 })
  })

  it('rejects other projects, regions, users, databases, and query overrides', () => {
    expect(() => parseSupabasePreviewTarget('postgresql://postgres:secret@db.other.supabase.co/postgres'))
      .toThrow('target_host_not_allowlisted')
    expect(() => parseSupabasePreviewTarget(
      'postgresql://postgres.other:secret@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres',
    )).toThrow('target_pooler_user_invalid')
    expect(() => parseSupabasePreviewTarget(
      'postgresql://postgres:secret@db.tlmgudfhsyzayiazuugf.supabase.co:5432/production',
    )).toThrow('target_identity_incomplete')
    expect(() => parseSupabasePreviewTarget(
      'postgresql://postgres:secret@db.tlmgudfhsyzayiazuugf.supabase.co:5432/postgres?options=-c%20role%3Dpostgres',
    )).toThrow('target_query_override_forbidden')
  })

  it('requires the exact approval issue and immutable execution inputs', () => {
    expect(() => assertApprovedExecutionEnvironment({
      LEO560_SHADOW_IMPORT_APPROVED: '1',
      LEO560_APPROVED_SOURCE_SHA: 'a'.repeat(40),
      LEO560_BACKUP_RUN_ID: '1234',
      LEO560_APPROVAL_ISSUE: '152',
    })).not.toThrow()
    expect(() => assertApprovedExecutionEnvironment({
      LEO560_SHADOW_IMPORT_APPROVED: '1',
      LEO560_APPROVED_SOURCE_SHA: 'a'.repeat(40),
      LEO560_BACKUP_RUN_ID: '1234',
      LEO560_APPROVAL_ISSUE: '151',
    })).toThrow('approval_issue_invalid')
  })

  it('hashes only canonicalized row structure', () => {
    expect(digestRows([{ b: 2, a: 1 }])).toBe(digestRows([{ a: 1, b: 2 }]))
  })

  it('requires a short-lived signature bound to the exact S3 object version', () => {
    const exact = 'https://dongphugia-newprod-raw-503344933326-ap-southeast-1.s3.ap-southeast-1.amazonaws.com/raw/legacy-production/2026-08-29/dongphugia-target-public-20260829T191902Z.dump?versionId=CSyMYJz1glatK32aWl2K8pukzxzXl69c&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=bounded&X-Amz-Date=20261015T000000Z&X-Amz-Expires=900&X-Amz-Signature=redacted'
    expect(() => assertExactSnapshotUrl(exact)).not.toThrow()
    expect(() => assertExactSnapshotUrl(exact.replace('CSyMYJz1glatK32aWl2K8pukzxzXl69c', 'other-version')))
      .toThrow('snapshot_version_id_mismatch')
    expect(() => assertExactSnapshotUrl(exact.replace('X-Amz-Expires=900', 'X-Amz-Expires=7200')))
      .toThrow('snapshot_expiry_contract_invalid')
    expect(() => assertExactSnapshotUrl(exact.replace('dongphugia-newprod-raw-503344933326-ap-southeast-1', 'other-bucket')))
      .toThrow('snapshot_object_not_allowlisted')
  })
})
