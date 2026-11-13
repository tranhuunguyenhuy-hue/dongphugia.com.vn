import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { Prisma, type PrismaClient } from '@prisma/client'

type JsonRow = Record<string, unknown>
type CaptureManifest = {
  contract: string
  proposalState: string
  source: { projectRef: string; schema: string; postgresVersion: string }
  capture: { pages: number; orderedIdSetSha256: string; pageManifestSha256: string; relationRows: Record<string, number> }
  sourceDigests: { matchedBeforeAfter: boolean; captureWasMvccSnapshot: boolean }
  captureValidation: { tableCountsMatchSource: boolean; mediaBytesVerified: boolean }
}
type FullCapture = {
  root: string
  manifest: CaptureManifest
  ids: number[]
  pages: string[]
  pageDigests: Record<string, string>
  references: Record<string, JsonRow[]>
}

const REFERENCE_FILES = ['core.json', 'specs-filters.json', 'taxonomy-variants.json']
const RELATION_TABLES = [
  'product_descriptions', 'product_images', 'product_documents', 'product_spec_values',
  'product_feature_values', 'product_attribute_values', 'product_taxon_assignments',
  'product_secondary_subcategories', 'product_package_items', 'product_relationships',
  'product_source_mappings',
]
const REFERENCE_ORDER = [
  'categories', 'subcategories', 'brands', 'colors', 'origins', 'materials', 'product_features',
  'product_types', 'product_sub_types', 'catalog_taxons', 'spec_definitions', 'spec_options',
  'filter_definitions', 'product_variant_groups', 'product_families', 'product_family_configuration_groups', 'product_family_memberships',
]
const SEQUENCE_TABLES = [
  'categories', 'subcategories', 'brands', 'colors', 'origins', 'materials', 'product_features',
  'product_types', 'product_sub_types', 'catalog_taxons', 'spec_definitions', 'spec_options',
  'filter_definitions', 'product_variant_groups', 'product_families', 'product_family_configuration_groups', 'product_family_memberships',
  'products', ...RELATION_TABLES, 'blog_categories', 'blog_posts',
]
const PAGE_SIZE = 500

function fail(code: string): never { throw new Error(code) }

function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex')
}

function canonicalJson(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString())
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as JsonRow).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson((value as JsonRow)[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function idempotencyRow(sourceIdentity: string, table: string, row: JsonRow) {
  const sourceId = Number(row.id)
  if (!Number.isSafeInteger(sourceId) || sourceId < 1) fail(`FULL_SOURCE_ID_INVALID:${table}`)
  const rowDigest = sha256(canonicalJson(row))
  const idempotencyKey = sha256(`${sourceIdentity}\0${table}\0${sourceId}\0${rowDigest}`)
  return { source_table: table, source_id: sourceId, source_identity: sourceIdentity, row_digest: rowDigest, idempotency_key: idempotencyKey }
}

function readArray(value: unknown, table: string): JsonRow[] {
  if (value === null || value === undefined) return []
  if (!Array.isArray(value) || value.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) fail(`FULL_SOURCE_TABLE_INVALID:${table}`)
  return value as JsonRow[]
}

export async function readValidatedCapturePage(capture: Pick<FullCapture, 'root' | 'pageDigests'>, filename: string) {
  const expectedDigest = capture.pageDigests[filename]
  if (!expectedDigest) fail(`FULL_SOURCE_PAGE_DIGEST_MISSING:${filename}`)
  const bytes = await readFile(join(capture.root, 'pages', filename))
  if (sha256(bytes) !== expectedDigest) fail(`FULL_SOURCE_PAGE_DIGEST_MISMATCH:${filename}`)
  return JSON.parse(bytes.toString('utf8')) as Record<string, unknown>
}

export async function readFullSourceCapture(root: string, blogCategories: JsonRow[], blogPosts: JsonRow[]): Promise<{
  capture: FullCapture
  sourceIdentity: string
  ledger: ReturnType<typeof idempotencyRow>[]
  counts: Record<string, number>
}> {
  const manifest = JSON.parse(await readFile(join(root, 'capture-manifest.json'), 'utf8')) as CaptureManifest
  if (manifest.contract !== 'dpg:legacy-admin-full-source-capture:v1'
    || manifest.proposalState !== 'PROPOSED_REVIEW_REQUIRED'
    || manifest.source?.projectRef !== 'bonxyxluzlxfkdetryoo'
    || manifest.source?.schema !== 'dpg_app'
    || manifest.source?.postgresVersion !== '17.11'
    || manifest.sourceDigests?.captureWasMvccSnapshot !== false
    || manifest.sourceDigests?.matchedBeforeAfter !== true
    || manifest.captureValidation?.tableCountsMatchSource !== true
    || manifest.captureValidation?.mediaBytesVerified !== false) fail('FULL_SOURCE_CAPTURE_MANIFEST_UNTRUSTED')

  const ids = JSON.parse(await readFile(join(root, 'product-ids.json'), 'utf8')) as number[]
  if (!Array.isArray(ids) || ids.length !== 17_752 || new Set(ids).size !== ids.length
    || ids.some((id) => !Number.isSafeInteger(id) || id < 1)) fail('FULL_SOURCE_PRODUCT_ID_LIST_INVALID')
  if (sha256(ids.join(',')) !== manifest.capture?.orderedIdSetSha256) fail('FULL_SOURCE_PRODUCT_ID_DIGEST_MISMATCH')

  const pageRoot = join(root, 'pages')
  const pages = (await readdir(pageRoot)).filter((path) => /^\d{4}\.json$/.test(path)).sort()
  if (pages.length !== 888 || pages.length !== manifest.capture?.pages) fail('FULL_SOURCE_PAGE_COUNT_INVALID')
  const pageManifest: Array<[string, string]> = []
  const pageDigests: Record<string, string> = {}
  const relationCounts: Record<string, number> = Object.fromEntries(RELATION_TABLES.map((table) => [table, 0]))
  const relationIds: Record<string, Set<number>> = Object.fromEntries(RELATION_TABLES.map((table) => [table, new Set<number>()]))
  const ledger: ReturnType<typeof idempotencyRow>[] = []
  const tableIds: Record<string, Set<number>> = {}
  const sourceIdentity = `${manifest.source.projectRef}/${manifest.source.schema}/${manifest.capture.pageManifestSha256}`

  for (const [pageIndex, filename] of pages.entries()) {
    if (filename !== `${String(pageIndex).padStart(4, '0')}.json`) fail(`FULL_SOURCE_PAGE_GAP:${filename}`)
    const bytes = await readFile(join(pageRoot, filename))
    const pageDigest = sha256(bytes)
    pageDigests[filename] = pageDigest
    pageManifest.push([filename, pageDigest])
    const page = JSON.parse(bytes.toString('utf8')) as Record<string, unknown>
    const products = readArray(page.products, 'products')
    const expectedIds = ids.slice(pageIndex * 20, (pageIndex + 1) * 20)
    if (products.length !== expectedIds.length || products.some((row, index) => row.id !== expectedIds[index])) {
      fail(`FULL_SOURCE_PAGE_PRODUCT_ID_MISMATCH:${filename}`)
    }
    for (const row of products) {
      const id = Number(row.id)
      tableIds.products ??= new Set()
      if (tableIds.products.has(id)) fail(`FULL_SOURCE_DUPLICATE_ID:products:${id}`)
      tableIds.products.add(id)
      ledger.push(idempotencyRow(sourceIdentity, 'products', row))
    }
    for (const table of RELATION_TABLES) {
      const rows = readArray(page[table], table)
      relationCounts[table] += rows.length
      for (const row of rows) {
        const id = Number(row.id)
        if (!Number.isSafeInteger(id) || id < 1 || relationIds[table].has(id)) fail(`FULL_SOURCE_DUPLICATE_ID:${table}:${id}`)
        relationIds[table].add(id)
        ledger.push(idempotencyRow(sourceIdentity, table, row))
      }
    }
  }
  if (sha256(JSON.stringify(pageManifest)) !== manifest.capture?.pageManifestSha256) fail('FULL_SOURCE_PAGE_MANIFEST_DIGEST_MISMATCH')
  if (tableIds.products?.size !== 17_752) fail('FULL_SOURCE_PRODUCT_ID_SET_INCOMPLETE')

  const references: Record<string, JsonRow[]> = {}
  for (const filename of REFERENCE_FILES) {
    const content = JSON.parse(await readFile(join(root, 'reference', filename), 'utf8')) as Record<string, unknown>
    for (const [table, value] of Object.entries(content)) references[table] = readArray(value, table)
  }
  for (const table of REFERENCE_ORDER) {
    const rows = references[table] ?? []
    if (table === 'catalog_taxons') rows.sort((left, right) => Number(left.depth ?? 0) - Number(right.depth ?? 0) || Number(left.id) - Number(right.id))
    const seen = new Set<number>()
    for (const row of rows) {
      const id = Number(row.id)
      if (!Number.isSafeInteger(id) || id < 1 || seen.has(id)) fail(`FULL_SOURCE_DUPLICATE_ID:${table}:${id}`)
      seen.add(id)
      ledger.push(idempotencyRow(sourceIdentity, table, row))
    }
    tableIds[table] = seen
  }
  for (const [table, rows] of Object.entries({ blog_categories: blogCategories, blog_posts: blogPosts })) {
    const seen = new Set<number>()
    for (const row of rows) {
      const id = Number(row.id)
      if (!Number.isSafeInteger(id) || id < 1 || seen.has(id)) fail(`FULL_SOURCE_DUPLICATE_ID:${table}:${id}`)
      seen.add(id)
      ledger.push(idempotencyRow(sourceIdentity, table, row))
    }
  }

  for (const table of RELATION_TABLES) {
    if (relationCounts[table] !== manifest.capture?.relationRows?.[table]) fail(`FULL_SOURCE_RELATION_COUNT_MISMATCH:${table}`)
  }
  const counts: Record<string, number> = { products: ids.length, ...relationCounts }
  for (const [table, rows] of Object.entries(references)) counts[table] = rows.length
  counts.blog_categories = blogCategories.length
  counts.blog_posts = blogPosts.length
  const capture: FullCapture = { root, manifest, ids, pages, pageDigests, references }
  return { capture, sourceIdentity, ledger, counts }
}

async function insertMany(tx: Prisma.TransactionClient, modelName: string, rows: JsonRow[]) {
  if (!rows.length) return 0
  const model = (tx as unknown as Record<string, { createMany(args: { data: JsonRow[] }): Promise<{ count: number }> }>)[modelName]
  if (!model?.createMany) fail(`FULL_SOURCE_PRISMA_MODEL_MISSING:${modelName}`)
  let inserted = 0
  for (let offset = 0; offset < rows.length; offset += PAGE_SIZE) {
    const batch = rows.slice(offset, offset + PAGE_SIZE).map((row) => {
      const data = { ...row }
      if ((modelName === 'product_spec_values' && data.value_json === null)
        || (modelName === 'filter_definitions' && data.options === null)) data[modelName === 'product_spec_values' ? 'value_json' : 'options'] = Prisma.DbNull
      return data
    })
    inserted += (await model.createMany({ data: batch })).count
  }
  if (inserted !== rows.length) fail(`FULL_SOURCE_INSERT_COUNT_MISMATCH:${modelName}:${inserted}/${rows.length}`)
  return inserted
}

async function streamPageTable(tx: Prisma.TransactionClient, capture: FullCapture, table: string) {
  const model = (tx as unknown as Record<string, { createMany(args: { data: JsonRow[] }): Promise<{ count: number }> }>)[table]
  if (!model?.createMany) fail(`FULL_SOURCE_PRISMA_MODEL_MISSING:${table}`)
  let pending: JsonRow[] = []
  let count = 0
  const flush = async () => {
    if (!pending.length) return
    const rows = pending
    pending = []
    count += await insertMany(tx, table, rows)
  }
  for (const filename of capture.pages) {
    const page = await readValidatedCapturePage(capture, filename)
    for (const row of readArray(page[table], table)) {
      pending.push(row)
      if (pending.length >= PAGE_SIZE) await flush()
    }
  }
  await flush()
  return count
}

async function insertLedger(tx: Prisma.TransactionClient, rows: ReturnType<typeof idempotencyRow>[]) {
  for (let offset = 0; offset < rows.length; offset += 500) {
    const batch = rows.slice(offset, offset + 500)
    const values = batch.map((_, index) => {
      const base = index * 5
      return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5})`
    }).join(',')
    const parameters = batch.flatMap((row) => [row.source_table, row.source_id, row.source_identity, row.row_digest, row.idempotency_key])
    await tx.$executeRawUnsafe(`INSERT INTO local_recovery.full_source_import_ledger (source_table,source_id,source_identity,row_digest,idempotency_key) VALUES ${values}`, ...parameters)
  }
}

const REPLAY_IGNORED_COLUMNS = new Set(['updated_at', 'view_count'])

function normalizeNumeric(value: string) {
  return value.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '').replace(/^-0$/, '0')
}

function replayValueMatches(sourceValue: unknown, targetValue: unknown): boolean {
  if (sourceValue === targetValue) return true
  if (targetValue instanceof Date) {
    if (sourceValue instanceof Date) return sourceValue.getTime() === targetValue.getTime()
    return typeof sourceValue === 'string' && Date.parse(sourceValue) === targetValue.getTime()
  }
  if (typeof targetValue === 'bigint') {
    return (typeof sourceValue === 'number' || typeof sourceValue === 'string')
      && normalizeNumeric(String(sourceValue)) === targetValue.toString()
  }
  if (targetValue && typeof targetValue === 'object'
    && typeof (targetValue as { toFixed?: unknown }).toFixed === 'function') {
    return (typeof sourceValue === 'number' || typeof sourceValue === 'string')
      && normalizeNumeric(String(sourceValue)) === normalizeNumeric((targetValue as { toFixed(): string }).toFixed())
  }
  if (Array.isArray(sourceValue) && Array.isArray(targetValue)) {
    return sourceValue.length === targetValue.length
      && sourceValue.every((value, index) => replayValueMatches(value, targetValue[index]))
  }
  if (sourceValue && targetValue && typeof sourceValue === 'object' && typeof targetValue === 'object') {
    const source = sourceValue as JsonRow
    const target = targetValue as JsonRow
    const keys = Object.keys(source)
    return keys.length === Object.keys(target).length
      && keys.every((key) => Object.hasOwn(target, key) && replayValueMatches(source[key], target[key]))
  }
  return false
}

async function verifyReplayBatch(tx: Prisma.TransactionClient, table: string, sourceRows: JsonRow[]) {
  if (!sourceRows.length) return
  const model = (tx as unknown as Record<string, {
    findMany(args: { where: { id: { in: number[] } }; select: Record<string, true> }): Promise<JsonRow[]>
  }>)[table]
  if (!model?.findMany) fail(`FULL_SOURCE_PRISMA_MODEL_MISSING:${table}`)
  const fields = [...new Set(sourceRows.flatMap((row) => Object.keys(row)))].filter((key) => !REPLAY_IGNORED_COLUMNS.has(key))
  if (!fields.includes('id')) fail(`FULL_SOURCE_REPLAY_ID_MISSING:${table}`)
  const ids = sourceRows.map((row) => Number(row.id))
  const actualRows = await model.findMany({
    where: { id: { in: ids } },
    select: Object.fromEntries(fields.map((field) => [field, true])) as Record<string, true>,
  })
  const actualById = new Map(actualRows.map((row) => [Number(row.id), row]))
  for (const sourceRow of sourceRows) {
    const id = Number(sourceRow.id)
    const targetRow = actualById.get(id)
    if (!targetRow) fail(`FULL_SOURCE_REPLAY_ROW_MISSING:${table}:${id}`)
    for (const field of fields) {
      if (REPLAY_IGNORED_COLUMNS.has(field)) continue
      if (!replayValueMatches(sourceRow[field], targetRow[field])) {
        fail(`FULL_SOURCE_REPLAY_ROW_CONFLICT:${table}:${id}:${field}`)
      }
    }
  }
}

async function verifyReplayRows(tx: Prisma.TransactionClient, capture: FullCapture, blogCategories: JsonRow[], blogPosts: JsonRow[]) {
  for (const table of REFERENCE_ORDER) await verifyReplayBatch(tx, table, capture.references[table] ?? [])
  for (const table of ['products', ...RELATION_TABLES]) {
    let pending: JsonRow[] = []
    const flush = async () => {
      if (!pending.length) return
      await verifyReplayBatch(tx, table, pending)
      pending = []
    }
    for (const filename of capture.pages) {
      const page = await readValidatedCapturePage(capture, filename)
      for (const row of readArray(page[table], table)) {
        pending.push(row)
        if (pending.length >= PAGE_SIZE) await flush()
      }
    }
    await flush()
  }
  await verifyReplayBatch(tx, 'blog_categories', blogCategories)
  await verifyReplayBatch(tx, 'blog_posts', blogPosts)
}

async function setSequences(tx: Prisma.TransactionClient) {
  for (const table of SEQUENCE_TABLES) {
    await tx.$queryRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('public.${table}', 'id'), COALESCE(MAX(id), 1), COUNT(*) > 0) FROM public.${table}`,
    )
  }
}

async function insertCanonicalLinks(tx: Prisma.TransactionClient, capture: FullCapture) {
  const rows: Array<{ id: number; canonical_product_id: number }> = []
  for (const filename of capture.pages) {
    const page = await readValidatedCapturePage(capture, filename)
    for (const product of readArray(page.products, 'products')) {
      if (product.canonical_product_id !== null && product.canonical_product_id !== undefined) rows.push({ id: Number(product.id), canonical_product_id: Number(product.canonical_product_id) })
    }
  }
  for (let offset = 0; offset < rows.length; offset += 10_000) {
    const batch = rows.slice(offset, offset + 10_000)
    const values = batch.map((_, index) => `($${index * 2 + 1}::integer,$${index * 2 + 2}::integer)`).join(',')
    const parameters = batch.flatMap((row) => [row.id, row.canonical_product_id])
    await tx.$executeRawUnsafe(`UPDATE public.products AS p SET canonical_product_id = v.canonical_product_id FROM (VALUES ${values}) AS v(id,canonical_product_id) WHERE p.id=v.id`, ...parameters)
  }
}

export async function importFullSource(prisma: PrismaClient, data: {
  capture: FullCapture
  sourceIdentity: string
  ledger: ReturnType<typeof idempotencyRow>[]
  counts: Record<string, number>
}, blogCategories: JsonRow[], blogPosts: JsonRow[]) {
  await prisma.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS local_recovery')
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS local_recovery.full_source_import_ledger (
      source_table text NOT NULL,
      source_id integer NOT NULL,
      source_identity text NOT NULL,
      row_digest char(64) NOT NULL CHECK (row_digest ~ '^[a-f0-9]{64}$'),
      idempotency_key char(64) NOT NULL UNIQUE CHECK (idempotency_key ~ '^[a-f0-9]{64}$'),
      imported_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (source_table, source_id)
    )
  `)
  return prisma.$transaction(async (tx) => {
    const existingLedger = await tx.$queryRaw<Array<{ source_table: string; source_id: number; source_identity: string; row_digest: string; idempotency_key: string }>>
      `SELECT source_table,source_id,source_identity,row_digest,idempotency_key FROM local_recovery.full_source_import_ledger ORDER BY source_table,source_id`
    const sourceTables = [...REFERENCE_ORDER, 'products', ...RELATION_TABLES, 'blog_categories', 'blog_posts']
    const models = tx as unknown as Record<string, { count(): Promise<number> }>
    const dataCounts = Object.fromEntries(await Promise.all(sourceTables.map(async (table) => [table, await models[table].count()] as const)))
    const commerceCounts = await Promise.all([tx.orders.count(), tx.customers.count()])
    if (commerceCounts.some(Boolean)) fail('FULL_SOURCE_COMMERCE_DATASET_NOT_EMPTY')
    if (existingLedger.length) {
      if (existingLedger.length !== data.ledger.length) fail('FULL_SOURCE_LEDGER_PARTIAL_OR_DIFFERENT_CAPTURE')
      const expected = new Map(data.ledger.map((entry) => [`${entry.source_table}/${entry.source_id}`, entry]))
      for (const entry of existingLedger) {
        const prior = expected.get(`${entry.source_table}/${entry.source_id}`)
        if (!prior || prior.source_identity !== entry.source_identity || prior.row_digest !== entry.row_digest.trim()
          || prior.idempotency_key !== entry.idempotency_key.trim()) fail(`FULL_SOURCE_LEDGER_CONFLICT:${entry.source_table}:${entry.source_id}`)
      }
      for (const table of sourceTables) if (dataCounts[table] !== (data.counts[table] ?? 0)) fail(`FULL_SOURCE_REPLAY_COUNT_CONFLICT:${table}`)
      await verifyReplayRows(tx, data.capture, blogCategories, blogPosts)
      const staff = await tx.admin_users.findMany({ select: { email: true, username: true, role: true } })
      const allowedStaff = new Set(['local-preview-admin@dpg.test|local-preview-admin|admin', 'local-preview-manager@dpg.test|local-preview-manager|sale_manager'])
      if (staff.length > 2 || staff.some((user) => !allowedStaff.has(`${user.email}|${user.username}|${user.role}`))) fail('FULL_SOURCE_REPLAY_SYNTHETIC_STAFF_PRESENT')
      return { mode: 'identical-noop', ledgerRows: existingLedger.length, exactIdentityDigests: true }
    }
    const emptyChecks = [...Object.values(dataCounts), ...commerceCounts, await tx.admin_users.count()]
    if (emptyChecks.some((count) => count !== 0)) fail('FULL_SOURCE_TARGET_NONEMPTY_WITHOUT_LEDGER')

    const inserted: Record<string, number> = {}
    for (const table of REFERENCE_ORDER) inserted[table] = await insertMany(tx, table, data.capture.references[table] ?? [])
    const productWriter = (tx as unknown as Record<string, { createMany(args: { data: JsonRow[] }): Promise<{ count: number }> }>).products
    let pendingProducts: JsonRow[] = []
    for (const filename of data.capture.pages) {
      const page = await readValidatedCapturePage(data.capture, filename)
      for (const row of readArray(page.products, 'products')) {
        const product = { ...row, canonical_product_id: null }
        pendingProducts.push(product)
        if (pendingProducts.length >= PAGE_SIZE) {
          inserted.products = (inserted.products ?? 0) + (await productWriter.createMany({ data: pendingProducts })).count
          pendingProducts = []
        }
      }
    }
    if (pendingProducts.length) inserted.products = (inserted.products ?? 0) + (await productWriter.createMany({ data: pendingProducts })).count
    for (const table of RELATION_TABLES) inserted[table] = await streamPageTable(tx, data.capture, table)
    inserted.blog_categories = await insertMany(tx, 'blog_categories', blogCategories)
    inserted.blog_posts = await insertMany(tx, 'blog_posts', blogPosts)
    await insertCanonicalLinks(tx, data.capture)
    await insertLedger(tx, data.ledger)
    await setSequences(tx)

    const counts = await Promise.all([
      tx.products.count(), tx.blog_categories.count(), tx.blog_posts.count(), tx.orders.count(), tx.customers.count(), tx.admin_users.count(),
    ])
    if (counts[0] !== 17_752 || counts[1] !== blogCategories.length || counts[2] !== 10
      || counts[3] !== 0 || counts[4] !== 0 || counts[5] !== 0) fail('FULL_SOURCE_POST_IMPORT_ACCEPTANCE_FAILED')
    if (inserted.products !== 17_752) fail(`FULL_SOURCE_PRODUCT_INSERT_COUNT_INVALID:${inserted.products}`)
    return { mode: 'imported', inserted, ledgerRows: data.ledger.length, exactIdentityDigests: true }
  }, { timeout: 900_000, maxWait: 30_000 })
}
