import { readFile } from 'node:fs/promises'

export const EXPECTED_TARGET = {
  projectName: 'dongphugia-runtime',
  region: 'ap-southeast-1',
  environment: 'preview',
  dataClass: 'production-derived-reduced-runtime',
  productionDataAllowed: true,
  productionCredentialsAllowed: false,
  productionWritesAllowed: false,
  hardDatabaseCeilingBytes: 367001600,
}

const PROHIBITED_KEY = /password|secret|token|private.?key|database.?url|connection.?string|row.?data|payload|content|dump/i
export const RESTORE_COUNT_TABLES = [
  'blog_categories',
  'blog_post_tags',
  'blog_posts',
  'blog_tags',
  'product_images',
  'products',
  'publishing_blog_post_media',
]
export const CANONICAL_V1_RESTORE_COUNT_TABLES = [
  'dpg_v1.staff_users',
  'dpg_v1.staff_user_roles',
  'dpg_v1.role_capabilities',
  'dpg_v1.media_assets',
  'dpg_v1.media_variants',
  'dpg_v1.brands',
  'dpg_v1.categories',
  'dpg_v1.product_families',
  'dpg_v1.product_family_configuration_groups',
  'dpg_v1.products',
  'dpg_v1.product_family_memberships',
  'dpg_v1.product_source_provenance',
  'dpg_v1.collections',
  'dpg_v1.collection_products',
  'dpg_v1.attribute_definitions',
  'dpg_v1.attribute_options',
  'dpg_v1.category_attribute_policies',
  'dpg_v1.product_attribute_values',
  'dpg_v1.product_attribute_multi_options',
  'dpg_v1.product_media',
  'dpg_v1.product_documents',
  'dpg_v1.content_entries',
  'dpg_v1.content_blocks',
  'dpg_v1.content_product_references',
  'dpg_v1.content_category_references',
  'dpg_v1.content_brand_references',
  'dpg_v1.quote_requests',
  'dpg_v1.quote_request_lines',
  'dpg_v1.quotes',
  'dpg_v1.quote_lines',
  'dpg_v1.quote_shares',
  'dpg_v1.orders',
  'dpg_v1.order_lines',
  'dpg_v1.payment_transactions',
  'dpg_v1.commerce_idempotency_records',
  'dpg_v1.service_idempotency_records',
]
const EXPECTED_SCHEMA_NAMES = ['dpg_app', 'dpg_v1', 'dpg_control']

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
  }
  return value
}

function containsProhibitedKey(value) {
  if (Array.isArray(value)) return value.some(containsProhibitedKey)
  if (!value || typeof value !== 'object') return false
  return Object.entries(value).some(([key, child]) => PROHIBITED_KEY.test(key) || containsProhibitedKey(child))
}

function violationCategory(violation) {
  if (violation.includes('target')) return 'target'
  if (violation.includes('data manifest entry')) return 'data_entry'
  if (violation.includes('data table set')) return 'data_tables'
  if (violation.includes('data row counts')) return 'data_counts'
  if (violation.includes('data row hashes')) return 'data_hashes'
  if (violation.includes('data source authority')) return 'data_authority'
  if (violation.includes('restore aggregate counts')) return 'restore_counts'
  if (violation.includes('schema')) return 'schema'
  if (violation.includes('data')) return 'data'
  if (violation.includes('sensitive')) return 'sensitivity'
  if (violation.includes('manifest')) return 'manifest'
  return 'contract'
}

export function validateRuntimeManifest(manifest) {
  const violations = []
  if (!manifest || typeof manifest !== 'object') return ['manifest is not an object']
  if (manifest.formatVersion !== 2) violations.push('manifest format changed')
  if (manifest.target?.projectName !== EXPECTED_TARGET.projectName) violations.push('target project identity changed')
  if (JSON.stringify(canonical(manifest.target)) !== JSON.stringify(canonical(EXPECTED_TARGET))) {
    if (!violations.includes('target project identity changed')) violations.push('target project identity changed')
  }
  if (!manifest.schema || !Array.isArray(manifest.data)) violations.push('schema or data manifest is missing')
  if (JSON.stringify([...new Set(manifest.schema?.schemas ?? [])].sort())
    !== JSON.stringify([...EXPECTED_SCHEMA_NAMES].sort())) {
    violations.push('schema manifest changed')
  }
  if (containsProhibitedKey(manifest)) violations.push('manifest contains a prohibited sensitive field')
  for (const entry of manifest.data ?? []) {
    if (!entry || typeof entry.tableName !== 'string' || !Number.isInteger(entry.rowCount) || entry.rowCount < 0
      || !/^[a-f0-9]{64}$/.test(entry.sha256) || typeof entry.sourceAuthority !== 'string') {
      violations.push('data manifest entry is invalid')
      break
    }
  }
  if (!Array.isArray(manifest.restoreCounts)
    || manifest.restoreCounts.length !== RESTORE_COUNT_TABLES.length
    || new Set(manifest.restoreCounts.map((entry) => entry?.tableName)).size !== RESTORE_COUNT_TABLES.length
    || RESTORE_COUNT_TABLES.some((tableName) => !manifest.restoreCounts.some((entry) => entry?.tableName === tableName))
    || manifest.restoreCounts.some((entry) => !entry
      || typeof entry.tableName !== 'string'
      || !Number.isInteger(entry.rowCount)
      || entry.rowCount < 0)) {
    violations.push('restore aggregate counts are invalid')
  }
  if (!Array.isArray(manifest.canonicalV1RestoreCounts)
    || manifest.canonicalV1RestoreCounts.length !== CANONICAL_V1_RESTORE_COUNT_TABLES.length
    || new Set(manifest.canonicalV1RestoreCounts.map((entry) => entry?.tableName)).size
      !== CANONICAL_V1_RESTORE_COUNT_TABLES.length
    || CANONICAL_V1_RESTORE_COUNT_TABLES.some((tableName) => !manifest.canonicalV1RestoreCounts.some(
      (entry) => entry?.tableName === tableName,
    ))
    || manifest.canonicalV1RestoreCounts.some((entry) => !entry
      || typeof entry.tableName !== 'string'
      || !Number.isInteger(entry.rowCount)
      || entry.rowCount < 0)) {
    violations.push('canonical V1 restore aggregate counts are invalid')
  }
  return [...new Set(violations)]
}

export function compareRuntimeManifests(expected, actual) {
  const violations = [...validateRuntimeManifest(expected), ...validateRuntimeManifest(actual)]
  if (violations.length > 0) return [...new Set(violations)]
  if (JSON.stringify(canonical(expected.target)) !== JSON.stringify(canonical(actual.target))) violations.push('target manifest changed')
  if (JSON.stringify(canonical(expected.schema)) !== JSON.stringify(canonical(actual.schema))) violations.push('schema manifest changed')
  if (expected.data.length !== actual.data.length
    || new Set(expected.data.map((entry) => entry.tableName)).size !== new Set(actual.data.map((entry) => entry.tableName)).size
    || expected.data.some((entry) => !actual.data.some((candidate) => candidate.tableName === entry.tableName))
    || actual.data.some((entry) => !expected.data.some((candidate) => candidate.tableName === entry.tableName))) {
    violations.push('data table set changed')
  }
  const actualDataByTable = new Map(actual.data.map((entry) => [entry.tableName, entry]))
  for (const entry of expected.data) {
    const actualEntry = actualDataByTable.get(entry.tableName)
    if (!actualEntry) continue
    if (entry.rowCount !== actualEntry.rowCount) violations.push('data row counts changed')
    if (entry.sha256 !== actualEntry.sha256) violations.push('data row hashes changed')
    if (entry.sourceAuthority !== actualEntry.sourceAuthority) violations.push('data source authority changed')
  }
  const actualRestoreCounts = new Map(actual.restoreCounts.map((entry) => [entry.tableName, entry.rowCount]))
  if (expected.restoreCounts.some((entry) => actualRestoreCounts.get(entry.tableName) !== entry.rowCount)) {
    violations.push('restore aggregate counts changed')
  }
  const actualCanonicalV1RestoreCounts = new Map(
    actual.canonicalV1RestoreCounts.map((entry) => [entry.tableName, entry.rowCount]),
  )
  if (expected.canonicalV1RestoreCounts.some(
    (entry) => actualCanonicalV1RestoreCounts.get(entry.tableName) !== entry.rowCount,
  )) {
    violations.push('canonical V1 restore aggregate counts changed')
  }
  return [...new Set(violations)]
}

async function main() {
  const [mode, expectedPath, actualPath] = process.argv.slice(2)
  if (!['validate', 'compare'].includes(mode)) throw new Error('usage: node scripts/backup/manifest-contract.mjs validate <manifest> | compare <expected> <actual>')
  const expected = JSON.parse(await readFile(expectedPath, 'utf8'))
  const violations = mode === 'validate'
    ? validateRuntimeManifest(expected)
    : compareRuntimeManifests(expected, JSON.parse(await readFile(actualPath, 'utf8')))
  if (violations.length > 0) {
    const categories = [...new Set(violations.map(violationCategory))].sort().join(',')
    process.stderr.write(`LEO540_MANIFEST status=FAIL violation_count=${violations.length} categories=${categories}\n`)
    process.exitCode = 1
    return
  }
  process.stdout.write(`LEO540_MANIFEST status=PASS mode=${mode}\n`)
}

if (process.argv[1]?.endsWith('/manifest-contract.mjs')) void main().catch((error) => {
  process.stderr.write(`LEO540_MANIFEST status=FAIL error=${error instanceof Error ? error.message.replaceAll(/\s+/g, '_') : 'unknown'}\n`)
  process.exitCode = 1
})
