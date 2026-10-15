import { createHash } from 'node:crypto'
import type { ClientConfig } from 'pg'

export const LEO560_TARGET_REF = 'tlmgudfhsyzayiazuugf'
export const LEO560_TARGET_PROJECT = 'dongphugia-runtime'
export const LEO560_TARGET_REGION = 'ap-southeast-1'
export const LEO560_SOURCE_BUCKET = 'dongphugia-newprod-raw-503344933326-ap-southeast-1'
export const LEO560_SOURCE_KEY = 'raw/legacy-production/2026-08-29/dongphugia-target-public-20260829T191902Z.dump'
export const LEO560_SOURCE_VERSION_ID = 'CSyMYJz1glatK32aWl2K8pukzxzXl69c'

export const CATALOGUE_TABLES = [
  'brands',
  'categories',
  'products',
  'product_source_provenance',
  'attribute_definitions',
  'attribute_options',
  'category_attribute_policies',
  'product_attribute_values',
  'product_attribute_multi_options',
] as const

export const EXPECTED_CATALOGUE_COUNTS = {
  brands: 65,
  categories: 35,
  products: 16_337,
  product_source_provenance: 16_337,
  attribute_definitions: 235,
  attribute_options: 463,
  category_attribute_policies: 509,
  product_attribute_values: 119_436,
  product_attribute_multi_options: 0,
} as const

const DIRECT_HOST = `db.${LEO560_TARGET_REF}.supabase.co`
const POOLER_HOST = /^aws-[0-9]+-ap-southeast-1\.pooler\.supabase\.com$/

function fail(message: string): never {
  throw new Error(`LEO560_SHADOW_IMPORT_FAILED:${message}`)
}

function decode(value: string, label: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    fail(`${label}_encoding_invalid`)
  }
}

export function parseSupabasePreviewTarget(raw: string | undefined): ClientConfig {
  if (!raw) fail('target_url_missing')
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    fail('target_url_invalid')
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) fail('target_protocol_invalid')
  if (url.hash) fail('target_url_fragment_forbidden')
  const host = url.hostname.toLowerCase()
  const direct = host === DIRECT_HOST
  const pooled = POOLER_HOST.test(host)
  if (!direct && !pooled) fail('target_host_not_allowlisted')
  const user = decode(url.username, 'target_user')
  const password = decode(url.password, 'target_password')
  const database = decode(url.pathname.replace(/^\//, ''), 'target_database')
  if (!password || database !== 'postgres') fail('target_identity_incomplete')
  if (direct && user !== 'postgres') fail('target_user_invalid')
  if (pooled && user !== `postgres.${LEO560_TARGET_REF}`) fail('target_pooler_user_invalid')
  const port = Number(url.port || (pooled ? 6543 : 5432))
  if ((direct && port !== 5432) || (pooled && ![5432, 6543].includes(port))) {
    fail('target_port_invalid')
  }
  for (const key of url.searchParams.keys()) if (key !== 'sslmode') fail('target_query_override_forbidden')
  if (url.searchParams.has('sslmode') && url.searchParams.get('sslmode') !== 'require') {
    fail('target_sslmode_invalid')
  }
  return {
    host,
    port,
    database,
    user,
    password,
    ssl: { rejectUnauthorized: true },
    application_name: 'leo560-catalogue-shadow-import',
    connectionTimeoutMillis: 10_000,
    statement_timeout: 300_000,
    query_timeout: 300_000,
    keepAlive: true,
  }
}

export function assertApprovedExecutionEnvironment(env: NodeJS.ProcessEnv) {
  if (env.LEO560_SHADOW_IMPORT_APPROVED !== '1') fail('approval_flag_missing')
  if (!/^[0-9a-f]{40}$/.test(env.LEO560_APPROVED_SOURCE_SHA ?? '')) fail('approved_source_sha_invalid')
  if (!/^[0-9]+$/.test(env.LEO560_BACKUP_RUN_ID ?? '')) fail('backup_run_id_invalid')
  if (!/^[0-9]+$/.test(env.LEO560_APPROVAL_ISSUE ?? '') || env.LEO560_APPROVAL_ISSUE !== '152') {
    fail('approval_issue_invalid')
  }
}

export function assertExactSnapshotUrl(raw: string | undefined) {
  if (!raw) fail('snapshot_url_missing')
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    fail('snapshot_url_invalid')
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) fail('snapshot_url_identity_invalid')
  const virtualHosts = new Set([
    `${LEO560_SOURCE_BUCKET}.s3.ap-southeast-1.amazonaws.com`,
    `${LEO560_SOURCE_BUCKET}.s3.amazonaws.com`,
  ])
  const pathStyle = url.hostname === 's3.ap-southeast-1.amazonaws.com'
  const expectedPath = virtualHosts.has(url.hostname)
    ? `/${LEO560_SOURCE_KEY}`
    : `/${LEO560_SOURCE_BUCKET}/${LEO560_SOURCE_KEY}`
  if ((!virtualHosts.has(url.hostname) && !pathStyle) || url.pathname !== expectedPath) {
    fail('snapshot_object_not_allowlisted')
  }
  if (url.searchParams.get('versionId') !== LEO560_SOURCE_VERSION_ID) fail('snapshot_version_id_mismatch')
  if (url.searchParams.get('X-Amz-Algorithm') !== 'AWS4-HMAC-SHA256'
    || !url.searchParams.get('X-Amz-Credential')
    || !url.searchParams.get('X-Amz-Date')
    || !url.searchParams.get('X-Amz-Signature')) {
    fail('snapshot_signature_contract_invalid')
  }
  const expires = Number(url.searchParams.get('X-Amz-Expires'))
  if (!Number.isInteger(expires) || expires < 1 || expires > 3600) fail('snapshot_expiry_contract_invalid')
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const object = value as Record<string, unknown>
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`
}

export function digestRows(rows: unknown[]) {
  const hash = createHash('sha256')
  for (const row of rows) hash.update(canonicalJson(row)).update('\n')
  return hash.digest('hex')
}
