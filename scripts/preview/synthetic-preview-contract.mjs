import { createHash } from 'node:crypto'

export const SYNTHETIC_PREVIEW_TARGET = Object.freeze({
  projectRef: 'uybumsnyqpwcidjxmfsv',
  projectName: 'dongphugia-phase2-preview-290',
  region: 'ap-southeast-1',
  environment: 'preview_synthetic',
  dataClass: 'synthetic-with-approved-public-fixtures',
  productionDataAllowed: false,
  productionCredentialsAllowed: false,
  productionWritesAllowed: false,
  hardDatabaseCeilingBytes: 367001600,
})

export const SYNTHETIC_PREVIEW_MIGRATIONS = Object.freeze([
  { version: '20261104154854', name: 'phase2_guest_order_intake', path: 'supabase/migrations/20261104154854_phase2_guest_order_intake.sql' },
  { version: '20261104190000', name: 'phase2_admin_order_inbox', path: 'supabase/migrations/20261104190000_phase2_admin_order_inbox.sql' },
  { version: '20261106144139', name: 'phase2_admin_order_confirmation', path: 'supabase/migrations/20261106144139_phase2_admin_order_confirmation.sql' },
  { version: '20261106210000', name: 'phase2_admin_sales_search', path: 'supabase/migrations/20261106210000_phase2_admin_sales_search.sql' },
  { version: '20261106213000', name: 'phase2_admin_catalogue_editor', path: 'supabase/migrations/20261106213000_phase2_admin_catalogue_editor.sql' },
  { version: '20261106220000', name: 'phase2_admin_cms_category_read', path: 'supabase/migrations/20261106220000_phase2_admin_cms_category_read.sql' },
  { version: '20261110170000', name: 'phase2_preview_synthetic_publication_guard', path: 'supabase/preview_migrations/20261110170000_phase2_preview_synthetic_publication_guard.sql' },
  { version: '20261110180000', name: 'phase2_preview_synthetic_seed', path: 'supabase/preview_migrations/20261110_phase2_synthetic_seed.sql' },
])

export const SYNTHETIC_PREVIEW_CONTRACT_MIGRATION = Object.freeze({
  version: '20261110150000',
  name: 'phase2_synthetic_preview_contract',
  path: 'supabase/preview_migrations/20261110150000_phase2_synthetic_preview_contract.sql',
})

const TARGET_GUARD_VERSION = new Set(['20261104154854', '20261104190000'])

export function assertSyntheticPreviewDatabaseUrl(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('DPG_SYNTHETIC_PREVIEW_DATABASE_URL_REQUIRED')
  }

  let parsed
  try {
    parsed = new URL(value)
  } catch {
    throw new Error('DPG_SYNTHETIC_PREVIEW_DATABASE_URL_INVALID')
  }

  const expectedHost = `db.${SYNTHETIC_PREVIEW_TARGET.projectRef}.supabase.co`
  const sslmode = parsed.searchParams.get('sslmode')
  if (
    !['postgres:', 'postgresql:'].includes(parsed.protocol) ||
    parsed.hostname !== expectedHost ||
    parsed.port !== '5432' ||
    parsed.pathname !== '/postgres' ||
    parsed.username !== 'postgres' ||
    !parsed.password ||
    !['require', 'verify-ca', 'verify-full'].includes(sslmode ?? '')
  ) {
    throw new Error('DPG_SYNTHETIC_PREVIEW_DATABASE_TARGET_REJECTED')
  }

  return Object.freeze({
    projectRef: SYNTHETIC_PREVIEW_TARGET.projectRef,
    host: expectedHost,
    database: 'postgres',
    sslmode,
  })
}

function replaceExactlyOnce(source, original, replacement, code) {
  const count = source.split(original).length - 1
  if (count !== 1) throw new Error(code)
  return source.replace(original, replacement)
}

export function adaptPhase2MigrationForSyntheticPreview({ version, name, sql }) {
  const expected = SYNTHETIC_PREVIEW_MIGRATIONS.find((entry) => entry.version === version)
  if (!expected || expected.name !== name || typeof sql !== 'string' || sql.length === 0) {
    throw new Error('DPG_SYNTHETIC_PREVIEW_MIGRATION_NOT_ALLOWLISTED')
  }

  if (!TARGET_GUARD_VERSION.has(version)) return sql

  const opening = 'do $target_preflight$'
  const closing = '$target_preflight$;'
  const start = sql.indexOf(opening)
  const end = sql.indexOf(closing, start + opening.length)
  if (start < 0 || end < 0 || sql.indexOf(opening, start + opening.length) >= 0) {
    throw new Error('DPG_SYNTHETIC_PREVIEW_TARGET_GUARD_DRIFT')
  }

  const guardEnd = end + closing.length
  let guard = sql.slice(start, guardEnd)
  guard = replaceExactlyOnce(guard, "project_name = 'dongphugia-runtime'", `project_name = '${SYNTHETIC_PREVIEW_TARGET.projectName}'`, 'DPG_SYNTHETIC_PREVIEW_PROJECT_GUARD_DRIFT')
  guard = replaceExactlyOnce(guard, "environment = 'preview'", `environment = '${SYNTHETIC_PREVIEW_TARGET.environment}'`, 'DPG_SYNTHETIC_PREVIEW_ENVIRONMENT_GUARD_DRIFT')
  guard = replaceExactlyOnce(guard, "data_class = 'production-derived-reduced-runtime'", `data_class = '${SYNTHETIC_PREVIEW_TARGET.dataClass}'`, 'DPG_SYNTHETIC_PREVIEW_DATA_CLASS_GUARD_DRIFT')
  guard = replaceExactlyOnce(guard, 'and production_data_allowed', 'and not production_data_allowed', 'DPG_SYNTHETIC_PREVIEW_PRODUCTION_DATA_GUARD_DRIFT')

  const adapted = `${sql.slice(0, start)}${guard}${sql.slice(guardEnd)}`
  if (adapted === sql) throw new Error('DPG_SYNTHETIC_PREVIEW_MIGRATION_NOT_ADAPTED')
  return adapted
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

export function assertSyntheticPreviewLedger(rows, expectedEntries) {
  if (!Array.isArray(rows)) throw new Error('DPG_SYNTHETIC_PREVIEW_LEDGER_INVALID')
  const byVersion = new Map()
  for (const row of rows) {
    if (byVersion.has(row.source_version)) throw new Error('DPG_SYNTHETIC_PREVIEW_LEDGER_DUPLICATE')
    byVersion.set(row.source_version, row)
  }

  for (const row of byVersion.values()) {
    const expected = expectedEntries.find((entry) => entry.version === row.source_version)
    if (
      !expected ||
      row.source_name !== expected.name ||
      row.source_sha256 !== expected.sha256 ||
      row.target_project_ref !== SYNTHETIC_PREVIEW_TARGET.projectRef
    ) throw new Error('DPG_SYNTHETIC_PREVIEW_LEDGER_MISMATCH')
  }

  return byVersion
}
