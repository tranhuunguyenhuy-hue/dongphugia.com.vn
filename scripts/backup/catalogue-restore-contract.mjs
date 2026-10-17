import { readFile } from 'node:fs/promises'

export const CATALOGUE_RESTORE_CONTRACT = 'dongphugia:catalogue-filtered-restore:v1'

export const CATALOGUE_TABLES = [
  'brands',
  'catalog_taxons',
  'categories',
  'colors',
  'external_taxonomy_mappings',
  'filter_definitions',
  'materials',
  'origins',
  'product_attribute_values',
  'product_descriptions',
  'product_documents',
  'product_feature_values',
  'product_features',
  'product_images',
  'product_package_items',
  'product_relationships',
  'product_secondary_subcategories',
  'product_source_mappings',
  'product_spec_values',
  'product_sub_types',
  'product_taxon_assignments',
  'product_types',
  'product_variant_groups',
  'products',
  'spec_definitions',
  'spec_options',
  'subcategories',
]

export const CATALOGUE_RESTORE_ORDER = [
  'brands',
  'catalog_taxons',
  'categories',
  'colors',
  'materials',
  'origins',
  'product_variant_groups',
  'subcategories',
  'product_types',
  'product_sub_types',
  'spec_definitions',
  'spec_options',
  'products',
  'external_taxonomy_mappings',
  'filter_definitions',
  'product_attribute_values',
  'product_descriptions',
  'product_documents',
  'product_features',
  'product_feature_values',
  'product_images',
  'product_package_items',
  'product_relationships',
  'product_secondary_subcategories',
  'product_source_mappings',
  'product_spec_values',
  'product_taxon_assignments',
]

const EXPECTED_TARGET = {
  projectName: 'dongphugia-runtime',
  region: 'ap-southeast-1',
  environment: 'preview',
  dataClass: 'production-derived-reduced-runtime',
  productionDataAllowed: true,
  productionCredentialsAllowed: false,
  productionWritesAllowed: false,
  hardDatabaseCeilingBytes: 367001600,
}

const SAFE_TABLE = /^[a-z][a-z0-9_]*$/
const SAFE_HASH = /^[a-f0-9]{64}$/
const SAFE_SHA = /^[a-f0-9]{40}$/

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
  }
  return value
}

function same(left, right) {
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right))
}

function validDataEntry(entry) {
  return entry
    && typeof entry.tableName === 'string'
    && /^(?:dpg_v1\.)?[a-z][a-z0-9_]*$/.test(entry.tableName)
    && Number.isInteger(entry.rowCount)
    && entry.rowCount >= 0
    && SAFE_HASH.test(entry.sha256)
    && typeof entry.sourceAuthority === 'string'
}

export function catalogueTableArguments() {
  return CATALOGUE_RESTORE_ORDER.flatMap((table) => ['--table', `dpg_app.${table}`])
}

function tableHashSelect(table) {
  return `select count(*)::bigint,
       encode(sha256(convert_to(
         coalesce(string_agg(to_jsonb(item)::text, E'\\n' order by to_jsonb(item)::text COLLATE "C"), ''),
         'UTF8'
       )), 'hex')
from dpg_app.${table} item`
}

function excludedTableLoop(body) {
  const allowlist = CATALOGUE_TABLES.map((table) => `'${table}'`).join(', ')
  return `for excluded_table in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'dpg_app'
      and c.relkind in ('r', 'p')
      and c.relname <> all(array[${allowlist}]::text[])
    order by c.relname
  loop
    execute format('select exists(select 1 from dpg_app.%I limit 1)', excluded_table)
      into excluded_has_rows;
    if excluded_has_rows then
      ${body}
    end if;
  end loop;`
}

export function buildCatalogueValidationSql(manifest) {
  const violations = validateCatalogueManifest(manifest)
  if (violations.length > 0) throw new Error('catalogue_manifest_invalid')
  const expected = new Map(manifest.tables.map((entry) => [entry.tableName, entry]))
  const checks = CATALOGUE_TABLES.map((table) => {
    const entry = expected.get(table)
    return `${tableHashSelect(table)} into actual_count, actual_hash;
  if actual_count <> ${entry.rowCount} or actual_hash <> '${entry.sha256}' then
    raise exception 'CATALOGUE_MANIFEST_MISMATCH table=${table}';
  end if;`
  }).join('\n\n  ')

  return `set local timezone = 'UTC';
do $catalogue_restore_validation$
declare
  actual_count bigint;
  actual_hash text;
  excluded_table text;
  excluded_has_rows boolean;
begin
  ${excludedTableLoop("raise exception 'CATALOGUE_EXCLUDED_ROWS table=%', excluded_table;")}

  ${checks}
end
$catalogue_restore_validation$;
select dpg_control.assert_free_tier_headroom(0);
-- excludedRows are validated dynamically and never populated with row data.
`
}

export function buildCatalogueSnapshotSql() {
  const inserts = CATALOGUE_TABLES.map((table) => `insert into catalogue_manifest_entries
select '${table}', row_count, sha256 from (${tableHashSelect(table)}) as snapshot(row_count, sha256);`).join('\n')

  return `begin transaction isolation level repeatable read read only;
set local timezone = 'UTC';
create temp table catalogue_manifest_entries (
  table_name text primary key,
  row_count bigint not null,
  sha256 char(64) not null
) on commit drop;
create temp table catalogue_excluded_rows (
  table_name text primary key
) on commit drop;

${inserts}

do $catalogue_excluded_snapshot$
declare
  excluded_table text;
  excluded_has_rows boolean;
begin
  ${excludedTableLoop('insert into catalogue_excluded_rows values (excluded_table);')}
end
$catalogue_excluded_snapshot$;

select jsonb_build_object(
  'contract', '${CATALOGUE_RESTORE_CONTRACT}',
  'tables', coalesce((
    select jsonb_agg(jsonb_build_object(
      'tableName', table_name,
      'rowCount', row_count,
      'sha256', sha256
    ) order by table_name)
    from catalogue_manifest_entries
  ), '[]'::jsonb),
  'excludedRows', coalesce((
    select jsonb_agg(table_name order by table_name)
    from catalogue_excluded_rows
  ), '[]'::jsonb)
)::text;
commit;
`
}

export function buildCatalogueSequenceSql() {
  const allowlist = CATALOGUE_TABLES.map((table) => `'${table}'`).join(', ')
  return `do $catalogue_sequence_reset$
declare
  table_name text;
  sequence_name text;
  maximum_id bigint;
begin
  foreach table_name in array array[${allowlist}]::text[]
  loop
    sequence_name := pg_get_serial_sequence(format('dpg_app.%I', table_name), 'id');
    if sequence_name is not null then
      execute format('select max(id)::bigint from dpg_app.%I', table_name) into maximum_id;
      if maximum_id is not null then
        perform setval(sequence_name::regclass, maximum_id, true);
      end if;
    end if;
  end loop;
end
$catalogue_sequence_reset$;
`
}

export function validateCatalogueSourceManifest(manifest, expectedIdentity) {
  const violations = []
  if (!manifest || typeof manifest !== 'object' || manifest.formatVersion !== 2) {
    return ['source manifest format changed']
  }
  if (!same(manifest.target, EXPECTED_TARGET)) violations.push('source target contract changed')

  const identity = manifest.artifactIdentity
  if (!identity
    || !Number.isInteger(identity.prNumber)
    || !SAFE_SHA.test(identity.candidateSha ?? '')
    || !SAFE_SHA.test(identity.controlSha ?? '')
    || !SAFE_SHA.test(identity.mergeSha ?? '')
    || !/^\d+$/.test(identity.workflowRunId ?? '')
    || identity.manifestVersion !== 2
    || identity.prNumber !== expectedIdentity.prNumber
    || identity.candidateSha !== expectedIdentity.candidateSha
    || identity.controlSha !== expectedIdentity.controlSha
    || identity.mergeSha !== expectedIdentity.mergeSha
    || identity.workflowRunId !== expectedIdentity.workflowRunId) {
    violations.push('source artifact identity changed')
  }

  if (!Array.isArray(manifest.data) || manifest.data.some((entry) => !validDataEntry(entry))) {
    violations.push('source data manifest is invalid')
  } else {
    const names = manifest.data.map((entry) => entry.tableName)
    if (CATALOGUE_TABLES.some((table) => names.filter((name) => name === table).length !== 1)) {
      violations.push('source catalogue table set changed')
    }
  }
  return [...new Set(violations)]
}

function validateCatalogueManifest(manifest) {
  const violations = []
  if (!manifest || manifest.contract !== CATALOGUE_RESTORE_CONTRACT || !Array.isArray(manifest.tables)) {
    return ['catalogue manifest format changed']
  }
  const names = manifest.tables.map((entry) => entry?.tableName)
  if (manifest.tables.length !== CATALOGUE_TABLES.length
    || CATALOGUE_TABLES.some((table) => names.filter((name) => name === table).length !== 1)
    || names.some((table) => !CATALOGUE_TABLES.includes(table))) {
    violations.push('catalogue table set changed')
  }
  if (manifest.tables.some((entry) => !entry
    || !SAFE_TABLE.test(entry.tableName ?? '')
    || !Number.isInteger(entry.rowCount)
    || entry.rowCount < 0
    || !SAFE_HASH.test(entry.sha256 ?? ''))) {
    violations.push('catalogue manifest entry is invalid')
  }
  if (!Array.isArray(manifest.excludedRows)
    || manifest.excludedRows.some((table) => typeof table !== 'string' || !SAFE_TABLE.test(table))) {
    violations.push('excluded row report is invalid')
  }
  return [...new Set(violations)]
}

export function compareCatalogueManifests(expected, actual) {
  const violations = [...validateCatalogueManifest(expected), ...validateCatalogueManifest(actual)]
  const tables = new Set()
  if (violations.length > 0) return { violations: [...new Set(violations)], tables: [] }

  if (actual.excludedRows.length > 0) {
    violations.push('excluded rows are present')
    for (const table of actual.excludedRows) tables.add(table)
  }

  const actualByTable = new Map(actual.tables.map((entry) => [entry.tableName, entry]))
  let countChanged = false
  let hashChanged = false
  for (const entry of expected.tables) {
    const actualEntry = actualByTable.get(entry.tableName)
    if (entry.rowCount !== actualEntry.rowCount) {
      countChanged = true
      tables.add(entry.tableName)
    }
    if (entry.sha256 !== actualEntry.sha256) {
      hashChanged = true
      tables.add(entry.tableName)
    }
  }
  if (countChanged) violations.push('catalogue row counts changed')
  if (hashChanged) violations.push('catalogue row hashes changed')

  return {
    violations: [...new Set(violations)],
    tables: [...tables].sort(),
  }
}

async function main() {
  const [mode, ...args] = process.argv.slice(2)
  if (mode === 'table-args') {
    process.stdout.write(`${catalogueTableArguments().filter((_, index) => index % 2 === 1).map((table) => `--table=${table}`).join('\n')}\n`)
    return
  }
  if (mode === 'snapshot-sql') {
    process.stdout.write(buildCatalogueSnapshotSql())
    return
  }
  if (mode === 'sequence-sql') {
    process.stdout.write(buildCatalogueSequenceSql())
    return
  }
  if (mode === 'validation-sql') {
    const manifest = JSON.parse(await readFile(args[0], 'utf8'))
    process.stdout.write(buildCatalogueValidationSql(manifest))
    return
  }
  if (mode === 'validate-source') {
    const [manifestPath, prNumber, candidateSha, controlSha, workflowRunId, mergeSha] = args
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    const violations = validateCatalogueSourceManifest(manifest, {
      prNumber: Number(prNumber), candidateSha, controlSha, workflowRunId, mergeSha,
    })
    if (violations.length > 0) throw new Error('source_manifest_contract_failed')
    process.stdout.write('CATALOGUE_REHOME_SOURCE status=PASS\n')
    return
  }
  if (mode === 'compare') {
    const [expectedPath, actualPath] = args
    const expected = JSON.parse(await readFile(expectedPath, 'utf8'))
    const actual = JSON.parse(await readFile(actualPath, 'utf8'))
    const result = compareCatalogueManifests(expected, actual)
    if (result.violations.length > 0) {
      const tables = result.tables.length > 0 ? result.tables.join(',') : 'none'
      process.stderr.write(`CATALOGUE_REHOME_COMPARE status=FAIL tables=${tables}\n`)
      process.exitCode = 1
      return
    }
    process.stdout.write('CATALOGUE_REHOME_COMPARE status=PASS\n')
    return
  }
  throw new Error('unsupported_mode')
}

if (process.argv[1]?.endsWith('/catalogue-restore-contract.mjs')) void main().catch((error) => {
  process.stderr.write(`CATALOGUE_REHOME_CONTRACT status=FAIL error=${error instanceof Error ? error.message.replaceAll(/\s+/g, '_') : 'unknown'}\n`)
  process.exitCode = 1
})
