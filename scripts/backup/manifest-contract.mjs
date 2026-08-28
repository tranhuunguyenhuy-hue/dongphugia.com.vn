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
  if (violation.includes('schema')) return 'schema'
  if (violation.includes('data')) return 'data'
  if (violation.includes('sensitive')) return 'sensitivity'
  if (violation.includes('manifest')) return 'manifest'
  return 'contract'
}

export function validateRuntimeManifest(manifest) {
  const violations = []
  if (!manifest || typeof manifest !== 'object') return ['manifest is not an object']
  if (manifest.formatVersion !== 1) violations.push('manifest format changed')
  if (manifest.target?.projectName !== EXPECTED_TARGET.projectName) violations.push('target project identity changed')
  if (JSON.stringify(canonical(manifest.target)) !== JSON.stringify(canonical(EXPECTED_TARGET))) {
    if (!violations.includes('target project identity changed')) violations.push('target project identity changed')
  }
  if (!manifest.schema || !Array.isArray(manifest.data)) violations.push('schema or data manifest is missing')
  if (containsProhibitedKey(manifest)) violations.push('manifest contains a prohibited sensitive field')
  for (const entry of manifest.data ?? []) {
    if (!entry || typeof entry.tableName !== 'string' || !Number.isInteger(entry.rowCount) || entry.rowCount < 0
      || !/^[a-f0-9]{64}$/.test(entry.sha256) || typeof entry.sourceAuthority !== 'string') {
      violations.push('data manifest entry is invalid')
      break
    }
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
