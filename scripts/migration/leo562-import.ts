import { createHash } from 'node:crypto'
import { createReadStream, promises as fs } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { Client, type ClientConfig, type QueryResultRow } from 'pg'
import {
  LEO562_SOURCE_CAPTURED_AT,
  LEO562_SOURCE_SHA256,
  MS885_CATALOGUE_GAPS,
  MS885_DEFERRED_OUTSIDE_FAMILY,
  MS885_GROUPS,
  QUARANTINE_REASONS,
  ROOT_ID_BY_SECTOR,
  SECTOR_BY_LEGACY_ROOT_SLUG,
  assertLoopbackDatabaseUrl,
  attributeKey,
  canonicalJson,
  classifyDocumentKind,
  deterministicChecksum,
  mapAvailability,
  mapExplicitRetailPrice,
  normalizeIdentity,
  normalizeUnit,
  optionKey,
  sha256,
  slugify,
  stableUuid,
  type QuarantineReason,
  type Sector,
} from './leo562-import-lib'

type AnyRow = QueryResultRow
type ReasonEvent = { entity: 'product' | 'attribute' | 'media' | 'content'; sourceId: number; reason: QuarantineReason; detail: string }

const NAMESPACE = 'dongphugia:leo562:v1'
const EXPECTED_PUBLIC_TABLE_COUNT = 57
const EXTRA_REASONS = ['AVAILABILITY_NOT_PUBLISHABLE'] as const
type ReasonCode = QuarantineReason | (typeof EXTRA_REASONS)[number]

const CANONICAL_ATTRIBUTE_DEFINITIONS: Record<string, { label: string; valueType: 'text' | 'number' | 'boolean' | 'enum' | 'multi_enum'; unit?: string; dimension?: string }> = {
  application: { label: 'Application', valueType: 'multi_enum' },
  bidet_seat_compatible: { label: 'Bidet seat compatible', valueType: 'boolean' },
  burner_count: { label: 'Burner count', valueType: 'number' },
  capacity_l: { label: 'Capacity', valueType: 'number', unit: 'l', dimension: 'volume' },
  cutout_depth_mm: { label: 'Cut-out depth', valueType: 'number', unit: 'mm', dimension: 'length' },
  cutout_width_mm: { label: 'Cut-out width', valueType: 'number', unit: 'mm', dimension: 'length' },
  depth_mm: { label: 'Depth', valueType: 'number', unit: 'mm', dimension: 'length' },
  energy_source: { label: 'Energy source', valueType: 'enum' },
  finish: { label: 'Finish', valueType: 'enum' },
  flow_l_min: { label: 'Flow rate', valueType: 'number', unit: 'l/min', dimension: 'flow' },
  flush_type: { label: 'Flush type', valueType: 'enum' },
  head_m: { label: 'Head', valueType: 'number', unit: 'm', dimension: 'length' },
  height_mm: { label: 'Height', valueType: 'number', unit: 'mm', dimension: 'length' },
  length_mm: { label: 'Length', valueType: 'number', unit: 'mm', dimension: 'length' },
  material: { label: 'Material', valueType: 'enum' },
  minimum_pressure_bar: { label: 'Minimum pressure', valueType: 'number', unit: 'bar', dimension: 'pressure' },
  mounting_type: { label: 'Mounting type', valueType: 'enum' },
  power_w: { label: 'Power', valueType: 'number', unit: 'W', dimension: 'power' },
  rough_in_mm: { label: 'Rough-in', valueType: 'number', unit: 'mm', dimension: 'length' },
  thickness_mm: { label: 'Thickness', valueType: 'number', unit: 'mm', dimension: 'length' },
  toilet_construction: { label: 'Toilet construction', valueType: 'enum' },
  trap_type: { label: 'Trap type', valueType: 'enum' },
  warranty_months: { label: 'Warranty', valueType: 'number', unit: 'month', dimension: 'time' },
  water_per_flush_l: { label: 'Water per flush', valueType: 'number', unit: 'l', dimension: 'volume' },
  width_mm: { label: 'Width', valueType: 'number', unit: 'mm', dimension: 'length' },
}

const PUBLISH_REQUIREMENTS_BY_LEAF: Record<string, string[]> = {
  'bon-cau': ['toilet_construction','flush_type','trap_type','rough_in_mm','water_per_flush_l','width_mm','depth_mm','height_mm','finish','warranty_months'],
  'nap-bon-cau': ['mounting_type','bidet_seat_compatible','width_mm','depth_mm','finish','warranty_months'],
  lavabo: ['mounting_type','width_mm','depth_mm','height_mm','material','finish','warranty_months'],
  'voi-chau': ['mounting_type','minimum_pressure_bar','finish','warranty_months'],
  'sen-tam': ['mounting_type','minimum_pressure_bar','finish','warranty_months'],
  'bon-tam': ['width_mm','length_mm','height_mm','capacity_l','material','finish','warranty_months'],
  'bon-tieu': ['mounting_type','flush_type','trap_type','water_per_flush_l','width_mm','depth_mm','height_mm','warranty_months'],
  'guong-phong-tam': ['width_mm','height_mm','material','warranty_months'],
  'ga-thoat-san': ['width_mm','length_mm','material','finish','warranty_months'],
  'phu-kien-phong-tam': ['width_mm','depth_mm','height_mm','material','finish','warranty_months'],
  'may-say-tay': ['power_w','width_mm','depth_mm','height_mm','warranty_months'],
  'gach-lat-nen': ['width_mm','length_mm','thickness_mm','material','finish','application'],
  'gach-op-lat': ['width_mm','length_mm','thickness_mm','material','finish','application'],
  'gach-op-tuong': ['width_mm','length_mm','thickness_mm','material','finish','application'],
  'gach-trang-tri': ['width_mm','length_mm','thickness_mm','material','finish','application'],
  'gach-inax-ecocarat': ['width_mm','length_mm','thickness_mm','material','finish','application'],
  'may-nuoc-nong': ['capacity_l','power_w','energy_source','minimum_pressure_bar','warranty_months'],
  'loc-nuoc': ['flow_l_min','width_mm','depth_mm','height_mm','warranty_months'],
  'may-bom-nuoc': ['power_w','flow_l_min','head_m','warranty_months'],
  'bon-chua-nuoc': ['capacity_l','material','width_mm','height_mm','warranty_months'],
  'phu-kien-vat-lieu-nuoc': ['width_mm','material','warranty_months'],
  'chau-rua-chen': ['width_mm','depth_mm','height_mm','material','finish','warranty_months'],
  'voi-rua-chen': ['mounting_type','minimum_pressure_bar','finish','warranty_months'],
  'bep-dien-tu': ['width_mm','depth_mm','cutout_width_mm','cutout_depth_mm','power_w','burner_count','warranty_months'],
  'bep-gas': ['width_mm','depth_mm','cutout_width_mm','cutout_depth_mm','burner_count','warranty_months'],
  'may-hut-mui': ['width_mm','depth_mm','height_mm','power_w','warranty_months'],
  'may-rua-chen': ['width_mm','depth_mm','height_mm','capacity_l','power_w','warranty_months'],
  'lo-nuong': ['width_mm','depth_mm','height_mm','capacity_l','power_w','warranty_months'],
  'phu-kien-bep': ['width_mm','depth_mm','height_mm','material','warranty_months'],
  'phu-kien-chau-rua-chen': ['width_mm','material','finish','warranty_months'],
  'thiet-bi-bep-khac': ['width_mm','depth_mm','height_mm','power_w','warranty_months'],
}

function parseArgs(argv: string[]) {
  const values = new Map<string, string>()
  let replay = false
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--replay') { replay = true; continue }
    const value = argv[index + 1]
    if (!argv[index].startsWith('--') || !value || value.startsWith('--')) throw new Error(`INVALID_ARGUMENT:${argv[index]}`)
    values.set(argv[index].slice(2), value)
    index += 1
  }
  const required = ['source-dump', 'source-url', 'target-url', 'evidence-out', 'quarantine-out']
  for (const key of required) if (!values.has(key)) throw new Error(`MISSING_ARGUMENT:${key}`)
  return { values, replay }
}

async function fileSha256(filename: string) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(filename)) hash.update(chunk as Buffer)
  return hash.digest('hex')
}

function clientConfig(raw: string): ClientConfig {
  return { connectionString: raw, application_name: 'leo562-local-deterministic-import', statement_timeout: 120_000, connectionTimeoutMillis: 10_000, keepAlive: true, ssl: false, options: `-c search_path=pg_catalog,public` }
}

async function queryRows(client: Client, sql: string, params: unknown[] = []) {
  return (await client.query(sql, params)).rows as AnyRow[]
}

async function insertRows(
  client: Client,
  table: string,
  columns: string[],
  rows: unknown[][],
  conflict: string,
  batchSize = 500,
) {
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize)
    const params: unknown[] = []
    const tuples = batch.map((row) => {
      const placeholders = row.map((value) => { params.push(value); return `$${params.length}` })
      return `(${placeholders.join(',')})`
    })
    await client.query(`insert into ${table} (${columns.join(',')}) values ${tuples.join(',')} ${conflict}`, params)
  }
}

function pushReason(events: ReasonEvent[], entity: ReasonEvent['entity'], sourceId: number, reason: QuarantineReason, detail: string) {
  events.push({ entity, sourceId, reason, detail })
}

async function readLegacy(client: Client) {
  await client.query('begin transaction isolation level repeatable read read only deferrable')
  const version = (await client.query('select current_setting(\'server_version\') version')).rows[0].version as string
  const publicTableCount = Number((await client.query("select count(*) from pg_tables where schemaname='public'")).rows[0].count)
  if (publicTableCount !== EXPECTED_PUBLIC_TABLE_COUNT) throw new Error(`SOURCE_TABLE_COUNT_MISMATCH:${publicTableCount}`)

  const brands = await queryRows(client, 'select id,name,slug,description,is_active,created_at,updated_at from public.brands order by id')
  const taxons = await queryRows(client, 'select id,parent_id,name,slug,canonical_path,depth,sort_order,is_active,status from public.catalog_taxons order by canonical_path,id')
  const primaryAssignments = await queryRows(client, `select a.product_id,a.taxon_id from public.product_taxon_assignments a join public.catalog_taxons t on t.id=a.taxon_id where a.is_primary and t.depth>0 and t.is_active and t.status='active' order by a.product_id,a.taxon_id`)
  const products = await queryRows(client, `select p.id,p.sku,p.name,p.slug,p.brand_id,p.price,p.list_price,p.price_state,p.price_source,p.price_confidence,
      p.stock_status,p.description,p.seo_title,p.seo_description,p.is_combo,coalesce(cardinality(p.component_skus),0) component_count,
      p.image_main_url,p.specs,p.created_at,p.updated_at,lc.slug legacy_root_slug,s.slug legacy_subcategory_slug
      from public.products p join public.categories lc on lc.id=p.category_id left join public.subcategories s on s.id=p.subcategory_id order by p.id`)
  const definitions = await queryRows(client, 'select id,key,label,data_type,unit,is_filterable,is_pdp_visible,sort_order from public.spec_definitions order by id')
  const options = await queryRows(client, 'select id,spec_definition_id,value,slug,sort_order,aliases,is_active from public.spec_options order by spec_definition_id,sort_order,id')
  const values = await queryRows(client, `select id,product_id,spec_definition_id,option_id,value_text,value_number,value_json,source,confidence,sort_order from public.product_spec_values order by product_id,spec_definition_id,id`)
  const images = await queryRows(client, 'select id,product_id,image_url,alt_text,image_type,sort_order from public.product_images order by product_id,image_type,sort_order,id')
  const documents = await queryRows(client, 'select id,product_id,name,url,source_url,document_type,file_ext,file_size,sort_order from public.product_documents order by product_id,sort_order,id')
  const content = await queryRows(client, 'select id,status from public.blog_posts order by id')
  const sourceCounts = await queryRows(client, `select
      (select count(*) from public.products)::int products,
      (select count(*) from public.brands)::int brands,
      (select count(*) from public.catalog_taxons)::int taxons,
      (select count(*) from public.product_spec_values)::int spec_values,
      (select count(*) from public.product_images)::int product_images,
      (select count(*) from public.product_documents)::int product_documents,
      (select count(*) from public.blog_posts)::int blog_posts,
      (select count(*) from public.product_variant_groups)::int ignored_variant_groups,
      (select count(*) from public.products where specs <> '{}'::jsonb)::int nonempty_legacy_specs_json`)
  await client.query('commit')
  return { version, publicTableCount, brands, taxons, primaryAssignments, products, definitions, options, values, images, documents, content, sourceCounts: sourceCounts[0] }
}

function buildMapping(source: Awaited<ReturnType<typeof readLegacy>>) {
  const events: ReasonEvent[] = []
  const productReasons = new Map<number, Set<ReasonCode>>()
  const addProductReason = (id: number, reason: ReasonCode, detail: string) => {
    const reasons = productReasons.get(id) ?? new Set<ReasonCode>()
    reasons.add(reason); productReasons.set(id, reasons)
    if (QUARANTINE_REASONS.includes(reason as QuarantineReason)) pushReason(events, 'product', id, reason as QuarantineReason, detail)
  }

  const roots = source.taxons.filter((row) => Number(row.depth) === 0)
  const sectorByRootId = new Map<number, Sector>()
  for (const root of roots) {
    const sector = SECTOR_BY_LEGACY_ROOT_SLUG[root.slug as keyof typeof SECTOR_BY_LEGACY_ROOT_SLUG]
    if (!sector) throw new Error(`UNAPPROVED_LEGACY_ROOT:${root.slug}`)
    sectorByRootId.set(Number(root.id), sector)
  }
  const leafMapping = new Map<number, { id: string; sector: Sector; slug: string }>()
  const leafByPath = new Map<string, { id: string; sector: Sector; slug: string }>()
  const categoryRows: unknown[][] = []
  for (const taxon of source.taxons.filter((row) => Number(row.depth) > 0)) {
    const sector = sectorByRootId.get(Number(taxon.parent_id))
    if (!sector) throw new Error(`CATEGORY_PARENT_NOT_APPROVED:${taxon.id}`)
    const id = stableUuid(`${NAMESPACE}:category`, String(taxon.id))
    const mapped = { id, sector, slug: taxon.slug as string }
    leafMapping.set(Number(taxon.id), mapped)
    leafByPath.set(`${sector}:${taxon.slug}`, mapped)
    categoryRows.push([id, ROOT_ID_BY_SECTOR[sector], sector, taxon.name, taxon.slug, null, true, Boolean(taxon.is_active) && taxon.status === 'active', Number(taxon.sort_order), 1, LEO562_SOURCE_CAPTURED_AT, LEO562_SOURCE_CAPTURED_AT])
  }

  const assignmentIds = new Map<number, number[]>()
  for (const row of source.primaryAssignments) {
    const ids = assignmentIds.get(Number(row.product_id)) ?? []
    ids.push(Number(row.taxon_id)); assignmentIds.set(Number(row.product_id), ids)
  }
  const brandIdMap = new Map(source.brands.map((row) => [Number(row.id), stableUuid(`${NAMESPACE}:brand`, String(row.id))]))
  const identityCounts = new Map<string, number>()
  for (const product of source.products) {
    const key = normalizeIdentity(product.sku)
    identityCounts.set(key, (identityCounts.get(key) ?? 0) + 1)
  }

  const provisional: Array<{ source: AnyRow; id: string; sector: Sector; categoryId: string; slug: string; categoryDisposition: 'primary-assignment' | 'exact-legacy-path' }> = []
  for (const product of source.products) {
    const sourceId = Number(product.id)
    const identity = normalizeIdentity(product.sku)
    if (!identity || identityCounts.get(identity) !== 1) addProductReason(sourceId, 'IDENTITY_AMBIGUITY', 'normalized-sku-not-unique')
    if (!brandIdMap.has(Number(product.brand_id))) addProductReason(sourceId, 'BRAND_AMBIGUITY', 'brand-fk-not-exact')
    if (product.is_combo || Number(product.component_count) > 0) addProductReason(sourceId, 'UNSUPPORTED_LEGACY_STRUCTURE', 'package-or-combo-is-not-a-v1-product')

    const assigned = assignmentIds.get(sourceId) ?? []
    let category = assigned.length === 1 ? leafMapping.get(assigned[0]) : undefined
    let categoryDisposition: 'primary-assignment' | 'exact-legacy-path' = 'primary-assignment'
    if (!category && assigned.length === 0) {
      const sector = SECTOR_BY_LEGACY_ROOT_SLUG[product.legacy_root_slug as keyof typeof SECTOR_BY_LEGACY_ROOT_SLUG]
      if (sector && product.legacy_subcategory_slug) category = leafByPath.get(`${sector}:${product.legacy_subcategory_slug}`)
      categoryDisposition = 'exact-legacy-path'
    }
    if (!category) addProductReason(sourceId, 'CATEGORY_AMBIGUITY', assigned.length > 1 ? 'multiple-primary-taxons' : 'no-exact-primary-leaf')
    if ((productReasons.get(sourceId) ?? new Set()).has('IDENTITY_AMBIGUITY')
      || (productReasons.get(sourceId) ?? new Set()).has('BRAND_AMBIGUITY')
      || (productReasons.get(sourceId) ?? new Set()).has('CATEGORY_AMBIGUITY')
      || (productReasons.get(sourceId) ?? new Set()).has('UNSUPPORTED_LEGACY_STRUCTURE')) continue
    if (!category) throw new Error('UNREACHABLE_CATEGORY')
    provisional.push({ source: product, id: stableUuid(`${NAMESPACE}:product`, String(sourceId)), sector: category.sector, categoryId: category.id, slug: slugify(product.slug), categoryDisposition })
  }

  const slugCounts = new Map<string, number>()
  for (const product of provisional) slugCounts.set(product.slug, (slugCounts.get(product.slug) ?? 0) + 1)
  const imported = provisional.filter((product) => {
    if (!product.slug || slugCounts.get(product.slug) !== 1) {
      addProductReason(Number(product.source.id), 'IDENTITY_AMBIGUITY', 'normalized-slug-not-unique')
      return false
    }
    return true
  })
  const importedBySourceId = new Map(imported.map((product) => [Number(product.source.id), product]))

  const brandRows = source.brands.map((brand) => [brandIdMap.get(Number(brand.id)), brand.name, brand.slug, brand.description, null, Boolean(brand.is_active), 1, LEO562_SOURCE_CAPTURED_AT, LEO562_SOURCE_CAPTURED_AT])
  const productRows: unknown[][] = []
  const provenanceRows: unknown[][] = []
  const priceDisposition = new Map<string, number>()
  for (const product of imported) {
    const legacy = product.source
    const sourceId = Number(legacy.id)
    const price = mapExplicitRetailPrice(legacy)
    priceDisposition.set(price.disposition, (priceDisposition.get(price.disposition) ?? 0) + 1)
    if (price.retailPrice === null) addProductReason(sourceId, 'PRICE_MISSING_OR_AMBIGUOUS', price.disposition)
    addProductReason(sourceId, 'PROVENANCE_INSUFFICIENT', product.sector === 'sanitary' ? 'no-official-manufacturer-source' : 'legacy-source-is-not-verified')
    addProductReason(sourceId, 'MEDIA_READINESS_GAP', 'references-lack-canonical-bytes-hash-dimensions')
    const availability = mapAvailability(legacy.stock_status)
    if (availability === 'DISCONTINUED') addProductReason(sourceId, 'AVAILABILITY_NOT_PUBLISHABLE', 'legacy-stock-status-discontinued')
    productRows.push([
      product.id, legacy.sku.trim(), legacy.sku.trim(), legacy.name.trim(), product.slug,
      brandIdMap.get(Number(legacy.brand_id)), product.categoryId, price.retailPrice,
      null, 'VND', availability, 'DRAFT',
      legacy.description, legacy.seo_title, legacy.seo_description, false, 1, null,
      LEO562_SOURCE_CAPTURED_AT, LEO562_SOURCE_CAPTURED_AT,
    ])
    provenanceRows.push([
      stableUuid(`${NAMESPACE}:provenance`, String(sourceId)), product.id, 'legacy',
      `leo560:public.products:${sourceId}`, 'legacy', LEO562_SOURCE_CAPTURED_AT,
      LEO562_SOURCE_CAPTURED_AT, LEO562_SOURCE_CAPTURED_AT,
    ])
  }

  const definitionById = new Map<number, AnyRow>()
  const definitionRows: unknown[][] = []
  const definitionIdMap = new Map<number, string>()
  const canonicalDefinitionIdMap = new Map<string, string>()
  for (const [key, definition] of Object.entries(CANONICAL_ATTRIBUTE_DEFINITIONS).sort()) {
    const id = stableUuid(`${NAMESPACE}:canonical-attribute-definition`, key)
    canonicalDefinitionIdMap.set(key, id)
    definitionRows.push([id, key, definition.label, definition.valueType, definition.unit ?? null, definition.dimension ?? null, null, null, null, LEO562_SOURCE_CAPTURED_AT, LEO562_SOURCE_CAPTURED_AT])
  }
  const invalidUnitDefinitions = new Set<number>()
  for (const definition of source.definitions) {
    const sourceId = Number(definition.id)
    const normalizedUnit = normalizeUnit(definition.unit)
    if (definition.unit && !normalizedUnit) { invalidUnitDefinitions.add(sourceId); continue }
    const valueType = definition.data_type === 'enum' ? 'enum' : definition.data_type === 'text' ? 'text' : null
    if (!valueType) continue
    const id = stableUuid(`${NAMESPACE}:attribute-definition`, String(sourceId))
    definitionById.set(sourceId, definition); definitionIdMap.set(sourceId, id)
    definitionRows.push([id, attributeKey(definition.key, sourceId), definition.label, valueType, normalizedUnit?.unit ?? null, normalizedUnit?.dimension ?? null, null, null, null, LEO562_SOURCE_CAPTURED_AT, LEO562_SOURCE_CAPTURED_AT])
  }

  const optionsByDefinition = new Map<number, AnyRow[]>()
  const optionById = new Map<number, { id: string; definitionId: string }>()
  const optionRows: unknown[][] = []
  for (const option of source.options) {
    const definitionId = definitionIdMap.get(Number(option.spec_definition_id))
    if (!definitionId) continue
    const options = optionsByDefinition.get(Number(option.spec_definition_id)) ?? []
    options.push(option); optionsByDefinition.set(Number(option.spec_definition_id), options)
  }
  for (const [legacyDefinitionId, options] of [...optionsByDefinition].sort((a, b) => a[0] - b[0])) {
    options.sort((a, b) => Number(a.sort_order) - Number(b.sort_order) || Number(a.id) - Number(b.id))
    options.forEach((option, sortOrder) => {
      const id = stableUuid(`${NAMESPACE}:attribute-option`, String(option.id))
      const definitionId = definitionIdMap.get(legacyDefinitionId)!
      optionById.set(Number(option.id), { id, definitionId })
      optionRows.push([id, definitionId, `${optionKey(option.slug || option.value, Number(option.id))}_${Number(option.id)}`, option.value, option.aliases ?? [], sortOrder, LEO562_SOURCE_CAPTURED_AT, LEO562_SOURCE_CAPTURED_AT])
    })
  }

  const provenanceIdByProduct = new Map(imported.map((product) => [Number(product.source.id), stableUuid(`${NAMESPACE}:provenance`, String(product.source.id))]))
  const attributeRows: unknown[][] = []
  const policyPairs = new Map<string, { categoryId: string; definitionId: string; definition: AnyRow }>()
  for (const value of source.values) {
    const sourceId = Number(value.id)
    const product = importedBySourceId.get(Number(value.product_id))
    if (!product) {
      const parentReasons = productReasons.get(Number(value.product_id)) ?? new Set<ReasonCode>()
      const reason = parentReasons.has('UNSUPPORTED_LEGACY_STRUCTURE') ? 'UNSUPPORTED_LEGACY_STRUCTURE'
        : parentReasons.has('CATEGORY_AMBIGUITY') ? 'CATEGORY_AMBIGUITY'
          : parentReasons.has('BRAND_AMBIGUITY') ? 'BRAND_AMBIGUITY' : 'IDENTITY_AMBIGUITY'
      pushReason(events, 'attribute', sourceId, reason, 'parent-product-quarantined')
      continue
    }
    const legacyDefinitionId = Number(value.spec_definition_id)
    const definition = definitionById.get(legacyDefinitionId)
    const definitionId = definitionIdMap.get(legacyDefinitionId)
    if (invalidUnitDefinitions.has(legacyDefinitionId)) {
      pushReason(events, 'attribute', sourceId, 'UNIT_NORMALIZATION_FAILURE', 'unsupported-source-unit')
      continue
    }
    if (!definition || !definitionId) {
      pushReason(events, 'attribute', sourceId, 'INVALID_TYPED_VALUE', 'unsupported-definition-type')
      continue
    }
    let textValue: string | null = null
    let optionId: string | null = null
    if (definition.data_type === 'text') {
      textValue = typeof value.value_text === 'string' && value.value_text.trim() ? value.value_text.trim() : null
      if (!textValue) { pushReason(events, 'attribute', sourceId, 'INVALID_TYPED_VALUE', 'empty-text'); continue }
    } else {
      const direct = value.option_id === null ? undefined : optionById.get(Number(value.option_id))
      if (direct?.definitionId === definitionId) optionId = direct.id
      if (!optionId && typeof value.value_text === 'string') {
        const matchKey = normalizeIdentity(value.value_text)
        const candidates = (optionsByDefinition.get(legacyDefinitionId) ?? []).filter((option) => {
          const aliases = Array.isArray(option.aliases) ? option.aliases : []
          return [option.value, option.slug, ...aliases].some((candidate) => normalizeIdentity(String(candidate)) === matchKey)
        })
        if (candidates.length === 1) optionId = optionById.get(Number(candidates[0].id))?.id ?? null
      }
      if (!optionId) { pushReason(events, 'attribute', sourceId, 'INVALID_TYPED_VALUE', 'enum-option-not-exact'); continue }
    }
    const id = stableUuid(`${NAMESPACE}:attribute-value`, String(sourceId))
    attributeRows.push([id, product.id, definitionId, textValue, null, null, optionId, 'legacy', provenanceIdByProduct.get(Number(value.product_id)), LEO562_SOURCE_CAPTURED_AT, LEO562_SOURCE_CAPTURED_AT])
    policyPairs.set(`${product.categoryId}:${definitionId}`, { categoryId: product.categoryId, definitionId, definition })
  }

  const policiesByCategory = new Map<string, Array<{ categoryId: string; definitionId: string; definition: AnyRow }>>()
  for (const policy of policyPairs.values()) {
    const policies = policiesByCategory.get(policy.categoryId) ?? []
    policies.push(policy); policiesByCategory.set(policy.categoryId, policies)
  }
  const policyRows: unknown[][] = []
  const canonicalRequirementCountByCategory = new Map<string, number>()
  for (const category of leafMapping.values()) {
    const requirements = PUBLISH_REQUIREMENTS_BY_LEAF[category.slug]
    if (!requirements?.length) throw new Error(`PUBLISH_REQUIREMENTS_MISSING:${category.sector}:${category.slug}`)
    canonicalRequirementCountByCategory.set(category.id, requirements.length)
    requirements.forEach((key, order) => {
      const definitionId = canonicalDefinitionIdMap.get(key)
      if (!definitionId) throw new Error(`PUBLISH_REQUIREMENT_DEFINITION_MISSING:${key}`)
      policyRows.push([category.id, definitionId, true, order, true, order, category.sector === 'sanitary' ? 'deep' : 'launch', LEO562_SOURCE_CAPTURED_AT, LEO562_SOURCE_CAPTURED_AT])
    })
  }
  for (const policies of policiesByCategory.values()) {
    policies.sort((a, b) => Number(a.definition.sort_order) - Number(b.definition.sort_order) || Number(a.definition.id) - Number(b.definition.id))
    let pdpOrder = canonicalRequirementCountByCategory.get(policies[0].categoryId) ?? 0
    let filterOrder = pdpOrder
    for (const policy of policies) {
      const visible = Boolean(policy.definition.is_pdp_visible)
      const filterable = Boolean(policy.definition.is_filterable)
      policyRows.push([policy.categoryId, policy.definitionId, visible, visible ? pdpOrder++ : null, filterable, filterable ? filterOrder++ : null, 'none', LEO562_SOURCE_CAPTURED_AT, LEO562_SOURCE_CAPTURED_AT])
    }
  }

  const mediaMappings: AnyRow[] = []
  for (const image of source.images) mediaMappings.push({ sourceTable: 'product_images', sourceId: Number(image.id), productSourceId: Number(image.product_id), mappedKind: 'IMAGE', mappedRole: ['main', 'primary'].includes(image.image_type) ? 'PRIMARY_CANDIDATE' : 'GALLERY', referenceSha256: sha256(image.image_url), reason: 'MEDIA_READINESS_GAP' })
  for (const product of source.products) if (product.image_main_url) mediaMappings.push({ sourceTable: 'products.image_main_url', sourceId: Number(product.id), productSourceId: Number(product.id), mappedKind: 'IMAGE', mappedRole: 'PRIMARY_CANDIDATE', referenceSha256: sha256(product.image_main_url), reason: 'MEDIA_READINESS_GAP' })
  for (const document of source.documents) mediaMappings.push({ sourceTable: 'product_documents', sourceId: Number(document.id), productSourceId: Number(document.product_id), mappedKind: classifyDocumentKind(document.document_type, document.file_ext), mappedRole: 'DOCUMENT_REFERENCE', referenceSha256: sha256(document.url), reason: 'MEDIA_READINESS_GAP' })
  mediaMappings.sort((a, b) => a.sourceTable.localeCompare(b.sourceTable) || a.sourceId - b.sourceId)

  const contentOutcomes = source.content.map((entry) => ({ sourceId: Number(entry.id), disposition: 'WITHHELD', reason: 'UNSUPPORTED_LEGACY_STRUCTURE' as const, detail: 'blog-type-does-not-prove-one-approved-v1-content-type' }))
  for (const entry of contentOutcomes) pushReason(events, 'content', entry.sourceId, entry.reason, entry.detail)

  const importedSku = new Map(imported.map((product) => [normalizeIdentity(product.source.sku), product]))
  const requiredMembers = Object.values(MS885_GROUPS).flat()
  if (requiredMembers.some((sku) => !importedSku.has(sku))) throw new Error('MS885_EXISTING_MEMBER_NOT_IMPORTED')
  if (MS885_CATALOGUE_GAPS.some((sku) => importedSku.has(sku))) throw new Error('MS885_CATALOGUE_GAP_FABRICATED')
  if (importedSku.has(MS885_DEFERRED_OUTSIDE_FAMILY)) throw new Error('MS885_DEFERRED_PRODUCT_UNEXPECTEDLY_PRESENT')
  const familyId = stableUuid(`${NAMESPACE}:family`, 'toto:ms885')
  const familyRows = [[familyId, 'toto:ms885', 'TOTO MS885', null, LEO562_SOURCE_CAPTURED_AT, LEO562_SOURCE_CAPTURED_AT]]
  const groupRows: unknown[][] = []
  const membershipRows: unknown[][] = []
  let membershipOrder = 0
  Object.entries(MS885_GROUPS).forEach(([groupKey, skus], groupOrder) => {
    const groupId = stableUuid(`${NAMESPACE}:family-group`, groupKey)
    groupRows.push([groupId, familyId, groupKey, groupKey === 'ecowasher' ? 'EcoWasher' : groupKey === 'soft-close' ? 'Soft close' : 'Electronic Washlet', groupOrder, LEO562_SOURCE_CAPTURED_AT, LEO562_SOURCE_CAPTURED_AT])
    for (const sku of skus) membershipRows.push([stableUuid(`${NAMESPACE}:family-membership`, sku), familyId, importedSku.get(sku)!.id, groupId, membershipOrder++, LEO562_SOURCE_CAPTURED_AT, LEO562_SOURCE_CAPTURED_AT])
  })

  const productOutcomes = source.products.map((product) => {
    const importedProduct = importedBySourceId.get(Number(product.id))
    const reasons = [...(productReasons.get(Number(product.id)) ?? [])].sort()
    return { sourceId: Number(product.id), canonicalId: importedProduct?.id ?? null, disposition: importedProduct ? 'WITHHELD' : 'QUARANTINED', sector: importedProduct?.sector ?? null, categoryDisposition: importedProduct?.categoryDisposition ?? null, reasons }
  })
  events.sort((a, b) => a.entity.localeCompare(b.entity) || a.sourceId - b.sourceId || a.reason.localeCompare(b.reason))
  return {
    brandRows, categoryRows, productRows, provenanceRows, definitionRows, optionRows, policyRows, attributeRows,
    familyRows, groupRows, membershipRows, productOutcomes, mediaMappings, contentOutcomes, events,
    imported, importedBySourceId, priceDisposition: Object.fromEntries([...priceDisposition].sort()),
  }
}

async function applyTarget(client: Client, mapping: ReturnType<typeof buildMapping>) {
  await client.query('begin')
  await client.query("set local lock_timeout='10s'")
  const schemaExists = await client.query("select to_regclass('dpg_v1.products') is not null present")
  if (!schemaExists.rows[0].present) throw new Error('LEO561_SCHEMA_REQUIRED')
  const rootCount = Number((await client.query('select count(*) from dpg_v1.categories where parent_id is null')).rows[0].count)
  if (rootCount !== 4) throw new Error(`CANONICAL_ROOT_COUNT_MISMATCH:${rootCount}`)

  await insertRows(client, 'dpg_v1.brands', ['id','name','slug','summary','logo_media_id','is_active','version','created_at','updated_at'], mapping.brandRows, 'on conflict (id) do update set name=excluded.name,slug=excluded.slug,summary=excluded.summary,is_active=excluded.is_active,version=excluded.version')
  await insertRows(client, 'dpg_v1.categories', ['id','parent_id','sector','name','slug','summary','is_leaf','is_active','sort_order','version','created_at','updated_at'], mapping.categoryRows, 'on conflict (id) do update set parent_id=excluded.parent_id,sector=excluded.sector,name=excluded.name,slug=excluded.slug,is_leaf=excluded.is_leaf,is_active=excluded.is_active,sort_order=excluded.sort_order,version=excluded.version')
  await insertRows(client, 'dpg_v1.products', ['id','sku','model','name','slug','brand_id','primary_category_id','retail_price','list_price','currency','availability','status','description','seo_title','seo_description','unresolved_critical_conflict','version','published_at','created_at','updated_at'], mapping.productRows, 'on conflict (id) do update set sku=excluded.sku,model=excluded.model,name=excluded.name,slug=excluded.slug,brand_id=excluded.brand_id,primary_category_id=excluded.primary_category_id,retail_price=excluded.retail_price,list_price=excluded.list_price,currency=excluded.currency,availability=excluded.availability,status=excluded.status,description=excluded.description,seo_title=excluded.seo_title,seo_description=excluded.seo_description,unresolved_critical_conflict=excluded.unresolved_critical_conflict,version=excluded.version,published_at=excluded.published_at')
  await insertRows(client, 'dpg_v1.product_source_provenance', ['id','product_id','source_kind','source_reference','quality','captured_at','created_at','updated_at'], mapping.provenanceRows, 'on conflict (id) do update set product_id=excluded.product_id,source_kind=excluded.source_kind,source_reference=excluded.source_reference,quality=excluded.quality,captured_at=excluded.captured_at')
  await insertRows(client, 'dpg_v1.product_families', ['id','family_key','name','summary','created_at','updated_at'], mapping.familyRows, 'on conflict (id) do update set family_key=excluded.family_key,name=excluded.name,summary=excluded.summary')
  await insertRows(client, 'dpg_v1.product_family_configuration_groups', ['id','family_id','group_key','label','sort_order','created_at','updated_at'], mapping.groupRows, 'on conflict (id) do update set family_id=excluded.family_id,group_key=excluded.group_key,label=excluded.label,sort_order=excluded.sort_order')
  await insertRows(client, 'dpg_v1.product_family_memberships', ['id','family_id','product_id','configuration_group_id','sort_order','created_at','updated_at'], mapping.membershipRows, 'on conflict (id) do update set family_id=excluded.family_id,product_id=excluded.product_id,configuration_group_id=excluded.configuration_group_id,sort_order=excluded.sort_order')
  await insertRows(client, 'dpg_v1.attribute_definitions', ['id','attribute_key','label','value_type','canonical_unit','canonical_dimension','number_min','number_max','validation_pattern','created_at','updated_at'], mapping.definitionRows, 'on conflict (id) do update set attribute_key=excluded.attribute_key,label=excluded.label,value_type=excluded.value_type,canonical_unit=excluded.canonical_unit,canonical_dimension=excluded.canonical_dimension,number_min=excluded.number_min,number_max=excluded.number_max,validation_pattern=excluded.validation_pattern')
  await insertRows(client, 'dpg_v1.attribute_options', ['id','attribute_definition_id','option_key','label','aliases','sort_order','created_at','updated_at'], mapping.optionRows, 'on conflict (id) do update set attribute_definition_id=excluded.attribute_definition_id,option_key=excluded.option_key,label=excluded.label,aliases=excluded.aliases,sort_order=excluded.sort_order')
  await insertRows(client, 'dpg_v1.category_attribute_policies', ['category_id','attribute_definition_id','pdp_visible','pdp_sort_order','filterable','filter_sort_order','requirement_tier','created_at','updated_at'], mapping.policyRows, 'on conflict (category_id,attribute_definition_id) do update set pdp_visible=excluded.pdp_visible,pdp_sort_order=excluded.pdp_sort_order,filterable=excluded.filterable,filter_sort_order=excluded.filter_sort_order,requirement_tier=excluded.requirement_tier')
  await insertRows(client, 'dpg_v1.product_attribute_values', ['id','product_id','attribute_definition_id','text_value','number_value','boolean_value','option_id','quality','source_provenance_id','created_at','updated_at'], mapping.attributeRows, 'on conflict (id) do update set product_id=excluded.product_id,attribute_definition_id=excluded.attribute_definition_id,text_value=excluded.text_value,number_value=excluded.number_value,boolean_value=excluded.boolean_value,option_id=excluded.option_id,quality=excluded.quality,source_provenance_id=excluded.source_provenance_id')
  await client.query('commit')
}

const digestQueries: Record<string, string> = {
  brands: 'select id,name,slug,summary,is_active,version from dpg_v1.brands order by id',
  categories: 'select id,parent_id,sector,name,slug,is_leaf,is_active,sort_order,version from dpg_v1.categories order by id',
  products: 'select id,sku,model,name,slug,brand_id,primary_category_id,retail_price,list_price,currency,availability,status,unresolved_critical_conflict,version from dpg_v1.products order by id',
  provenance: 'select id,product_id,source_kind,source_reference,quality,captured_at from dpg_v1.product_source_provenance order by id',
  families: 'select id,family_key,name from dpg_v1.product_families order by id',
  familyGroups: 'select id,family_id,group_key,label,sort_order from dpg_v1.product_family_configuration_groups order by id',
  familyMemberships: 'select id,family_id,product_id,configuration_group_id,sort_order from dpg_v1.product_family_memberships order by id',
  attributeDefinitions: 'select id,attribute_key,label,value_type,canonical_unit,canonical_dimension from dpg_v1.attribute_definitions order by id',
  attributeOptions: 'select id,attribute_definition_id,option_key,label,aliases,sort_order from dpg_v1.attribute_options order by id',
  attributePolicies: 'select category_id,attribute_definition_id,pdp_visible,pdp_sort_order,filterable,filter_sort_order,requirement_tier from dpg_v1.category_attribute_policies order by category_id,attribute_definition_id',
  attributeValues: 'select id,product_id,attribute_definition_id,text_value,number_value,boolean_value,option_id,quality,source_provenance_id from dpg_v1.product_attribute_values order by id',
  media: 'select id from dpg_v1.product_media order by id',
  documents: 'select id from dpg_v1.product_documents order by id',
  content: 'select id from dpg_v1.content_entries order by id',
}

async function targetEvidence(client: Client) {
  const tableChecksums: Record<string, string> = {}
  const counts: Record<string, number> = {}
  for (const [name, sql] of Object.entries(digestQueries)) {
    const rows = await queryRows(client, sql)
    counts[name] = rows.length
    const hash = createHash('sha256')
    for (const row of rows) hash.update(canonicalJson(row)).update('\n')
    tableChecksums[name] = hash.digest('hex')
  }
  const publicationRows = await queryRows(client, `select c.sector,count(*)::int imported_count,count(*) filter(where e.eligible)::int publishable_count from dpg_v1.products p join dpg_v1.categories c on c.id=p.primary_category_id join dpg_v1.product_publication_eligibility e on e.product_id=p.id group by c.sector order by c.sector`)
  const eligibilityFailureRows = await queryRows(client, `select failure,count(*)::int count from dpg_v1.product_publication_eligibility e cross join lateral unnest(e.failures) failure group by failure order by failure`)
  return { counts, tableChecksums, canonicalChecksum: deterministicChecksum(tableChecksums), publicationRows, eligibilityFailureRows }
}

function summarizeReasons(mapping: ReturnType<typeof buildMapping>) {
  const summary: Record<string, number> = Object.fromEntries([...QUARANTINE_REASONS, ...EXTRA_REASONS].map((reason) => [reason, 0]))
  for (const outcome of mapping.productOutcomes) for (const reason of outcome.reasons) summary[reason] = (summary[reason] ?? 0) + 1
  for (const event of mapping.events.filter((event) => event.entity !== 'product')) summary[event.reason] = (summary[event.reason] ?? 0) + 1
  return Object.fromEntries(Object.entries(summary).sort())
}

function summarizeProductReasons(mapping: ReturnType<typeof buildMapping>) {
  const summary: Record<string, number> = Object.fromEntries([...QUARANTINE_REASONS, ...EXTRA_REASONS].map((reason) => [reason, 0]))
  for (const outcome of mapping.productOutcomes) for (const reason of outcome.reasons) summary[reason] = (summary[reason] ?? 0) + 1
  return Object.fromEntries(Object.entries(summary).sort())
}

async function main() {
  const { values, replay } = parseArgs(process.argv.slice(2))
  const dumpPath = path.resolve(values.get('source-dump')!)
  const sourceUrl = values.get('source-url')!
  const targetUrl = values.get('target-url')!
  assertLoopbackDatabaseUrl(sourceUrl, 'SOURCE')
  assertLoopbackDatabaseUrl(targetUrl, 'TARGET')
  if (new URL(sourceUrl).pathname === new URL(targetUrl).pathname) throw new Error('SOURCE_AND_TARGET_DATABASE_MUST_DIFFER')
  const sourceSha = await fileSha256(dumpPath)
  if (sourceSha !== LEO562_SOURCE_SHA256) throw new Error(`SOURCE_SHA256_MISMATCH:${sourceSha}`)

  const sourceClient = new Client(clientConfig(sourceUrl))
  const targetClient = new Client(clientConfig(targetUrl))
  await sourceClient.connect(); await targetClient.connect()
  try {
    const source = await readLegacy(sourceClient)
    const mapping = buildMapping(source)
    await applyTarget(targetClient, mapping)
    const first = await targetEvidence(targetClient)
    let second: Awaited<ReturnType<typeof targetEvidence>> | null = null
    if (replay) { await applyTarget(targetClient, mapping); second = await targetEvidence(targetClient) }
    const replayMatch = second === null ? null : deterministicChecksum(first) === deterministicChecksum(second)
    if (replay && !replayMatch) throw new Error('DETERMINISTIC_REPLAY_MISMATCH')

    const importerPath = fileURLToPath(import.meta.url)
    const libPath = path.join(path.dirname(importerPath), 'leo562-import-lib.ts')
    const codeChecksum = deterministicChecksum({ importer: await fileSha256(importerPath), library: await fileSha256(libPath) })
    const quarantinedProducts = mapping.productOutcomes.filter((outcome) => outcome.disposition === 'QUARANTINED').length
    const withheldProducts = mapping.productOutcomes.filter((outcome) => outcome.disposition === 'WITHHELD').length
    const quarantineArtifact = {
      schemaVersion: 1,
      sourceSha256: sourceSha,
      codeChecksum,
      productOutcomes: mapping.productOutcomes,
      attributeEvents: mapping.events.filter((event) => event.entity === 'attribute'),
      mediaMappings: mapping.mediaMappings,
      contentOutcomes: mapping.contentOutcomes,
    }
    const quarantineChecksum = deterministicChecksum(quarantineArtifact)
    await fs.writeFile(path.resolve(values.get('quarantine-out')!), `${canonicalJson(quarantineArtifact)}\n`, { mode: 0o600 })

    const publishableBySector = Object.fromEntries(['sanitary','tile','water','kitchen'].map((sector) => {
      const row = first.publicationRows.find((candidate) => candidate.sector === sector)
      return [sector, { imported: Number(row?.imported_count ?? 0), publishable: Number(row?.publishable_count ?? 0) }]
    }))
    const categoryDisposition = mapping.imported.reduce<Record<string, number>>((summary, product) => {
      summary[product.categoryDisposition] = (summary[product.categoryDisposition] ?? 0) + 1
      return summary
    }, {})
    const mediaKindSummary = mapping.mediaMappings.reduce<Record<string, number>>((summary, media) => {
      const key = `${media.mappedKind}:${media.mappedRole}`
      summary[key] = (summary[key] ?? 0) + 1
      return summary
    }, {})
    const attributeEventCount = mapping.events.filter((event) => event.entity === 'attribute').length
    const evidence = {
      schemaVersion: 1,
      issue: 'LEO-562',
      source: {
        bucket: 'dongphugia-newprod-raw-503344933326-ap-southeast-1',
        key: 'raw/legacy-production/2026-08-29/dongphugia-target-public-20260829T191902Z.dump',
        sha256: sourceSha,
        bytes: (await fs.stat(dumpPath)).size,
        postgresVersion: source.version,
        publicTableCount: source.publicTableCount,
        rowCounts: source.sourceCounts,
      },
      mapping: {
        codeChecksum,
        productMappingChecksum: deterministicChecksum(mapping.productOutcomes),
        mediaMappingChecksum: deterministicChecksum(mapping.mediaMappings),
        quarantineChecksum,
        identity: { exact: source.products.length, ambiguous: mapping.productOutcomes.filter((outcome) => outcome.reasons.includes('IDENTITY_AMBIGUITY')).length, modelDisposition: 'exact-products.sku' },
        brand: { exact: source.products.length, ambiguous: mapping.productOutcomes.filter((outcome) => outcome.reasons.includes('BRAND_AMBIGUITY')).length },
        categoryDisposition,
        priceDisposition: mapping.priceDisposition,
        importedProducts: mapping.imported.length,
        withheldProducts,
        quarantinedProducts,
        importedBrands: mapping.brandRows.length,
        importedLeafCategories: mapping.categoryRows.length,
        importedAttributeDefinitions: mapping.definitionRows.length,
        importedAttributeOptions: mapping.optionRows.length,
        importedAttributeValues: mapping.attributeRows.length,
        attributeReconciliation: { source: source.values.length, imported: mapping.attributeRows.length, quarantinedOrParentWithheld: attributeEventCount, reconciled: mapping.attributeRows.length + attributeEventCount === source.values.length },
        legacySpecsJson: { sourceProducts: Number(source.sourceCounts.nonempty_legacy_specs_json), importedAsCanonicalTruth: 0, disposition: 'ignored-non-authoritative-duplicate-input' },
        importedMediaAssets: 0,
        mediaReferences: { source: mapping.mediaMappings.length, mapped: mapping.mediaMappings.length, ready: 0, disposition: 'reference-metadata-only', byKindAndRole: Object.fromEntries(Object.entries(mediaKindSummary).sort()) },
        importedContentEntries: 0,
        ms885: { familyCount: 1, existingMemberships: mapping.membershipRows.length, catalogueGaps: 2, deferredOutsideFamily: 1 },
        publishableBySector,
        productReasonSummary: summarizeProductReasons(mapping),
        recordReasonSummary: summarizeReasons(mapping),
        content: { sourceCount: mapping.contentOutcomes.length, imported: 0, withheldUnsupported: mapping.contentOutcomes.length },
      },
      target: first,
      replay: { requested: replay, matched: replayMatch, firstChecksum: deterministicChecksum(first), secondChecksum: second ? deterministicChecksum(second) : null },
      mutationBoundary: { sourceDatabase: 'READ_ONLY_REPEATABLE_READ_DEFERRABLE', targetDatabase: 'LOOPBACK_ONLY', remoteProductionMutation: false },
    }
    await fs.writeFile(path.resolve(values.get('evidence-out')!), `${JSON.stringify(evidence, null, 2)}\n`)
    process.stdout.write(`${JSON.stringify({ status: 'PASS', evidence: values.get('evidence-out'), importedProducts: mapping.imported.length, withheldProducts, quarantinedProducts, quarantineChecksum, canonicalChecksum: first.canonicalChecksum, replayMatch })}\n`)
  } finally {
    await Promise.allSettled([sourceClient.end(), targetClient.end()])
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
