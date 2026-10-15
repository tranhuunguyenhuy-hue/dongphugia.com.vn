import { Client, type QueryResultRow } from 'pg'
import { CATALOGUE_TABLES, canonicalJson, digestRows } from './leo560-shadow-import-lib'

type Mode = 'preflight' | 'apply'
type Row = QueryResultRow

export const COPY_CONTRACT = [
  { table: 'brands', columns: ['id', 'name', 'slug', 'summary', 'logo_media_id', 'is_active', 'version', 'created_at', 'updated_at'], where: '', order: 'id' },
  { table: 'categories', columns: ['id', 'parent_id', 'sector', 'name', 'slug', 'summary', 'is_leaf', 'is_active', 'sort_order', 'version', 'created_at', 'updated_at'], where: 'where parent_id is not null', order: 'id' },
  { table: 'products', columns: ['id', 'sku', 'model', 'name', 'slug', 'brand_id', 'primary_category_id', 'retail_price', 'list_price', 'currency', 'availability', 'status', 'description', 'seo_title', 'seo_description', 'unresolved_critical_conflict', 'version', 'published_at', 'created_at', 'updated_at'], where: '', order: 'id' },
  { table: 'product_source_provenance', columns: ['id', 'product_id', 'source_kind', 'source_reference', 'quality', 'captured_at', 'created_at', 'updated_at'], where: '', order: 'id' },
  { table: 'attribute_definitions', columns: ['id', 'attribute_key', 'label', 'value_type', 'canonical_unit', 'canonical_dimension', 'number_min', 'number_max', 'validation_pattern', 'created_at', 'updated_at'], where: '', order: 'id' },
  { table: 'attribute_options', columns: ['id', 'attribute_definition_id', 'option_key', 'label', 'aliases', 'sort_order', 'created_at', 'updated_at'], where: '', order: 'id' },
  { table: 'category_attribute_policies', columns: ['category_id', 'attribute_definition_id', 'pdp_visible', 'pdp_sort_order', 'filterable', 'filter_sort_order', 'requirement_tier', 'created_at', 'updated_at'], where: '', order: 'category_id, attribute_definition_id' },
  { table: 'product_attribute_values', columns: ['id', 'product_id', 'attribute_definition_id', 'text_value', 'number_value', 'boolean_value', 'option_id', 'quality', 'source_provenance_id', 'created_at', 'updated_at'], where: '', order: 'id' },
  { table: 'product_attribute_multi_options', columns: ['product_attribute_value_id', 'attribute_definition_id', 'option_id', 'sort_order', 'created_at'], where: '', order: 'product_attribute_value_id, option_id' },
] as const

export const EXCLUDED_TABLES = [
  'staff_users', 'staff_user_roles', 'role_capabilities',
  'media_assets', 'media_variants', 'product_media', 'product_documents',
  'product_families', 'product_family_configuration_groups', 'product_family_memberships',
  'collections', 'collection_products',
  'content_entries', 'content_blocks', 'content_product_references',
  'content_category_references', 'content_brand_references',
  'quote_requests', 'quote_request_lines', 'quotes', 'quote_lines', 'quote_shares',
  'orders', 'order_lines', 'payment_transactions',
  'commerce_idempotency_records', 'service_idempotency_records',
] as const

type ShadowCopyOptions = {
  mode: Mode
  source: Client
  target: Client
  expectedCounts: Readonly<Record<string, number>>
  hardCeilingBytes: number
  attestTarget: () => Promise<void>
  measureDatabaseBytes?: (client: Client) => Promise<number>
  measureSourceCatalogueBytes?: (client: Client) => Promise<number>
}

export type ShadowCopyResult = {
  sourceCountMap: Record<string, number>
  sourceCatalogueDigest: string
  targetBefore: Record<string, number>
  targetAfter: Record<string, number>
  targetCatalogueDigest: string | null
  databaseBytesBefore: number
  projectedBytes: number
  databaseBytesAfter: number
}

function fail(message: string): never {
  throw new Error(`LEO560_SHADOW_IMPORT_FAILED:${message}`)
}

async function countTable(client: Client, table: string) {
  const result = await client.query(`select count(*)::int as count from dpg_v1.${table}`)
  return Number(result.rows[0]?.count ?? -1)
}

async function counts(client: Client, tables: readonly string[]) {
  return Object.fromEntries(await Promise.all(tables.map(async (table) => [table, await countTable(client, table)])))
}

async function catalogueRows(client: Client) {
  const result = new Map<string, Row[]>()
  for (const contract of COPY_CONTRACT) {
    const rows = (await client.query(
      `select ${contract.columns.join(',')} from dpg_v1.${contract.table} ${contract.where} order by ${contract.order}`,
    )).rows
    result.set(contract.table, rows)
  }
  return result
}

async function insertRows(client: Client, table: string, columns: readonly string[], rows: Row[]) {
  const batchSize = 400
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize)
    const params: unknown[] = []
    const tuples = batch.map((row) => `(${columns.map((column) => {
      params.push(row[column])
      return `$${params.length}`
    }).join(',')})`)
    await client.query(`insert into dpg_v1.${table} (${columns.join(',')}) values ${tuples.join(',')}`, params)
  }
}

function assertSourceCounts(actual: Record<string, number>, expected: Readonly<Record<string, number>>) {
  for (const [table, count] of Object.entries(expected)) {
    if (actual[table] !== count) fail(`source_count_mismatch_${table}`)
  }
}

function assertEmptyTarget(actual: Record<string, number>) {
  for (const table of CATALOGUE_TABLES) {
    const expected = table === 'categories' ? 4 : 0
    if (actual[table] !== expected) fail(`target_not_empty_${table}`)
  }
  for (const table of ['product_families', 'product_family_configuration_groups', 'product_family_memberships']) {
    if (actual[table] !== 0) fail(`excluded_family_state_present_${table}`)
  }
}

async function defaultDatabaseBytes(client: Client) {
  return Number((await client.query('select pg_database_size(current_database())::bigint bytes')).rows[0].bytes)
}

async function defaultSourceCatalogueBytes(client: Client) {
  return Number((await client.query(`
    select coalesce(sum(pg_total_relation_size(format('dpg_v1.%I', table_name)::regclass)), 0)::bigint bytes
    from unnest($1::text[]) table_name
  `, [CATALOGUE_TABLES])).rows[0].bytes)
}

export async function runCatalogueShadowCopy(options: ShadowCopyOptions): Promise<ShadowCopyResult> {
  const measureDatabaseBytes = options.measureDatabaseBytes ?? defaultDatabaseBytes
  const measureSourceCatalogueBytes = options.measureSourceCatalogueBytes ?? defaultSourceCatalogueBytes
  await options.attestTarget()

  const rows = await catalogueRows(options.source)
  const sourceCountMap = Object.fromEntries(COPY_CONTRACT.map((contract) => [
    contract.table,
    contract.table === 'categories' ? (rows.get(contract.table)?.length ?? 0) + 4 : rows.get(contract.table)?.length ?? 0,
  ]))
  assertSourceCounts(sourceCountMap, options.expectedCounts)

  const targetBefore = await counts(options.target, [...CATALOGUE_TABLES, ...EXCLUDED_TABLES])
  assertEmptyTarget(targetBefore)
  const excludedBefore = Object.fromEntries(EXCLUDED_TABLES.map((table) => [table, targetBefore[table]]))
  const databaseBytesBefore = await measureDatabaseBytes(options.target)
  const localCatalogueBytes = await measureSourceCatalogueBytes(options.source)
  const projectedBytes = databaseBytesBefore + (localCatalogueBytes * 2)
  if (projectedBytes >= options.hardCeilingBytes) fail('projected_database_size_exceeds_350_mib')

  const sourceTableDigests = Object.fromEntries(COPY_CONTRACT.map((contract) => [
    contract.table,
    digestRows(rows.get(contract.table) ?? []),
  ]))
  const sourceCatalogueDigest = digestRows([sourceTableDigests])
  let targetAfter = targetBefore
  let targetCatalogueDigest: string | null = null
  let databaseBytesAfter = databaseBytesBefore
  if (options.mode === 'apply') {
    await options.target.query('begin isolation level serializable')
    try {
      const lock = (await options.target.query("select pg_try_advisory_xact_lock(hashtext('dongphugia:leo560:catalogue-shadow-import:v1')) locked")).rows[0]
      if (lock?.locked !== true) fail('mutation_lock_unavailable')
      await options.attestTarget()
      assertEmptyTarget(await counts(options.target, [...CATALOGUE_TABLES, ...EXCLUDED_TABLES]))
      for (const contract of COPY_CONTRACT) {
        await insertRows(options.target, contract.table, contract.columns, rows.get(contract.table) ?? [])
      }
      targetAfter = await counts(options.target, [...CATALOGUE_TABLES, ...EXCLUDED_TABLES])
      assertSourceCounts(targetAfter, options.expectedCounts)
      const excludedAfter = Object.fromEntries(EXCLUDED_TABLES.map((table) => [table, targetAfter[table]]))
      if (canonicalJson(excludedAfter) !== canonicalJson(excludedBefore)) fail('excluded_table_counts_changed')
      const targetRows = await catalogueRows(options.target)
      const targetTableDigests = Object.fromEntries(COPY_CONTRACT.map((contract) => [
        contract.table,
        digestRows(targetRows.get(contract.table) ?? []),
      ]))
      targetCatalogueDigest = digestRows([targetTableDigests])
      if (targetCatalogueDigest !== sourceCatalogueDigest) fail('target_catalogue_digest_mismatch')
      databaseBytesAfter = await measureDatabaseBytes(options.target)
      if (databaseBytesAfter >= options.hardCeilingBytes) fail('database_size_exceeds_350_mib_before_commit')
      await options.target.query('commit')
      databaseBytesAfter = await measureDatabaseBytes(options.target)
    } catch (error) {
      await options.target.query('rollback').catch(() => undefined)
      throw error
    }
  }

  return {
    sourceCountMap,
    sourceCatalogueDigest,
    targetBefore,
    targetAfter,
    targetCatalogueDigest,
    databaseBytesBefore,
    projectedBytes,
    databaseBytesAfter,
  }
}
