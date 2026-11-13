import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Prisma, PrismaClient } from '@prisma/client'
import {
  assertDisposableLocalDatabase,
  assertDryRunOnly,
  assertSameLocalDatabase,
} from './local-target-guard.mjs'
import { buildRecoveryImportPlan, reconcileIdempotencyLedger } from './recovery-import-plan.mjs'
import { readVerifiedBundle, verifyBlogArchiveDigest } from './public-source-contract.mjs'

const CHUNK_SIZE = 100

function chunks<T>(values: T[], size = CHUNK_SIZE) {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size))
  return result
}

function stable(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'number') return canonicalNumeric(value.toString())
  if (value && typeof value === 'object' && typeof (value as { toFixed?: unknown }).toFixed === 'function') {
    return canonicalNumeric(String(value))
  }
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)]))
  }
  return value
}

function canonicalNumeric(value: string) {
  if (/[eE]/.test(value)) return value
  return value.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '').replace(/^-0$/, '0')
}

function assertSame(name: string, expected: unknown, actual: unknown) {
  const normalizedExpected = stable(expected)
  const normalizedActual = stable(actual)
  if (JSON.stringify(normalizedExpected) === JSON.stringify(normalizedActual)) return
  const expectedRecord = normalizedExpected as Record<string, unknown>
  const actualRecord = normalizedActual as Record<string, unknown>
  const fields = [...new Set([...Object.keys(expectedRecord ?? {}), ...Object.keys(actualRecord ?? {})])]
    .filter((field) => JSON.stringify(expectedRecord?.[field]) !== JSON.stringify(actualRecord?.[field]))
  throw new Error(`IMPORT_REPLAY_CONFLICT:${name}:${fields.join(',')}`)
}

async function assertEmptyTarget(tx: Prisma.TransactionClient) {
  const counts = await Promise.all([
    tx.products.count(),
    tx.categories.count(),
    tx.subcategories.count(),
    tx.brands.count(),
    tx.product_descriptions.count(),
    tx.product_images.count(),
    tx.product_documents.count(),
    tx.blog_categories.count(),
    tx.blog_posts.count(),
    tx.orders.count(),
    tx.customers.count(),
    tx.admin_users.count(),
  ])
  if (counts.some((count) => count !== 0)) throw new Error('LOCAL_DISPOSABLE_DATABASE_NOT_EMPTY')
}

async function insertBatch(model: unknown, rows: unknown[]) {
  const createMany = (model as {
    createMany(args: { data: unknown[] }): Promise<{ count: number }>
  }).createMany
  let inserted = 0
  for (const batch of chunks(rows)) {
    if (!batch.length) continue
    const result = await createMany.call(model, { data: batch })
    inserted += result.count
  }
  return inserted
}

async function readRows(model: unknown, ids: number[], select: Record<string, boolean>) {
  const findMany = (model as {
    findMany(args: { where: { id: { in: number[] } }; select: Record<string, boolean> }): Promise<Record<string, unknown>[]>
  }).findMany
  const rows: Record<string, unknown>[] = []
  for (const batch of chunks(ids)) {
    rows.push(...await findMany.call(model, { where: { id: { in: batch } }, select }))
  }
  return rows
}

async function assertReplayNoop(modelName: string, model: unknown, rows: Array<{ id: number; data: Record<string, unknown> }>, extraKeys: string[] = []) {
  const dataRows = rows.map(({ id, data }) => ({ id, ...data }))
  const keys = [...new Set(dataRows.flatMap((row) => Object.keys(row)))]
  const select = Object.fromEntries(keys.map((key) => [key, true]))
  const actual = await readRows(model, dataRows.map((row) => row.id), select)
  const byId = new Map(actual.map((row) => [row.id, row]))
  for (const expected of dataRows) {
    const found = byId.get(expected.id)
    if (!found) throw new Error(`IMPORT_REPLAY_MISSING:${expected.id}`)
    assertSame(`${modelName}:${expected.id}`, expected, found)
  }
  return { identicalNoops: actual.length, conflicts: 0, extraKeys }
}

async function assertAuxiliaryReplay(model: unknown, expected: Record<string, unknown>[]) {
  const productIds = [...new Set(expected.map((row) => row.product_id as number))]
  const findMany = (model as {
    findMany(args: { where: { product_id: { in: number[] } } }): Promise<Record<string, unknown>[]>
  }).findMany
  const actual = await findMany.call(model, { where: { product_id: { in: productIds } } })
  const keys = Object.keys(expected[0] ?? {})
  const normalize = (values: Record<string, unknown>[]) => values.map((row) =>
    stable(Object.fromEntries(keys.map((key) => [key, row[key]]))),
  ).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  assertSame('auxiliary', normalize(expected), normalize(actual))
  return { identicalNoops: actual.length, conflicts: 0 }
}

class RollbackDryRun extends Error {
  report: Record<string, unknown>
  constructor(report: Record<string, unknown>) { super('DRY_RUN_ROLLBACK'); this.report = report }
}

async function dryRun(sourceDir: string) {
  assertDryRunOnly(process.argv)
  const target = assertDisposableLocalDatabase(process.env.DATABASE_URL)
  if (process.env.DIRECT_URL) {
    const direct = assertDisposableLocalDatabase(process.env.DIRECT_URL)
    assertSameLocalDatabase(target, direct)
  }

  const lock = JSON.parse(await readFile(new URL('./public-source-candidate-lock.proposed.json', import.meta.url), 'utf8'))
  if (lock.proposalState !== 'PROPOSED_REVIEW_REQUIRED') throw new Error('PUBLIC_SOURCE_PROPOSAL_STATE_INVALID')
  const bundle = await readVerifiedBundle(sourceDir, lock)
  const blogPath = resolve('apps/public/src/runtime/legacy-blog-snapshot.json')
  const blogBytes = await readFile(blogPath)
  verifyBlogArchiveDigest(blogBytes, lock.blogArchive?.sha256)
  const archive = JSON.parse(blogBytes.toString('utf8'))
  const plan = buildRecoveryImportPlan(bundle, archive, blogBytes)
  if (plan.quarantinedProducts.length || plan.quarantinedBlogPosts.length) throw new Error('SOURCE_IMPORT_QUARANTINE_NONEMPTY')

  const prisma = new PrismaClient()
  try {
    await prisma.$connect()
    let report: Record<string, unknown>
    try {
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await assertEmptyTarget(tx)
        const categoryInserted = await insertBatch(tx.categories, plan.categories)
        const categoryIds = new Map((await tx.categories.findMany({ where: { slug: { in: plan.categories.map((row) => row.slug) } }, select: { id: true, slug: true } }))
          .map((row: { id: number; slug: string }) => [row.slug, row.id]))
        const subcategoryData = plan.subcategories.map((row) => {
          const categoryId = categoryIds.get(row.categorySlug)
          if (!categoryId) throw new Error(`IMPORT_CATEGORY_MISSING:${row.categorySlug}`)
          return { category_id: categoryId, name: row.name, slug: row.slug, thumbnail_url: row.thumbnail_url }
        })
        const subcategoryInserted = await insertBatch(tx.subcategories, subcategoryData)
        const subcategoryRows = await tx.subcategories.findMany({ select: { id: true, category_id: true, slug: true } })
        const subcategoryIds = new Map(subcategoryRows.map((row: { id: number; category_id: number; slug: string }) => [`${row.category_id}/${row.slug}`, row.id]))
        const brandInserted = await insertBatch(tx.brands, plan.brands)
        const brandIds = new Map((await tx.brands.findMany({ where: { slug: { in: plan.brands.map((row) => row.slug) } }, select: { id: true, slug: true } }))
          .map((row: { id: number; slug: string }) => [row.slug, row.id]))
        const productData = plan.products.map((row) => {
          const categoryId = categoryIds.get(row.categorySlug)
          const subcategoryId = categoryId ? subcategoryIds.get(`${categoryId}/${row.subcategorySlug}`) : undefined
          const brandId = row.brandSlug ? brandIds.get(row.brandSlug) : null
          if (!categoryId || !subcategoryId || (row.brandSlug && !brandId)) throw new Error(`IMPORT_PRODUCT_RELATION_MISSING:${row.data.id}`)
          return { ...row.data, category_id: categoryId, subcategory_id: subcategoryId, brand_id: brandId }
        })
        const productInserted = await insertBatch(tx.products, productData)
        const descriptionInserted = await insertBatch(tx.product_descriptions, plan.productDescriptions)
        const imageInserted = await insertBatch(tx.product_images, plan.productImages)
        const documentInserted = await insertBatch(tx.product_documents, plan.productDocuments)
        const blogCategoryInserted = await insertBatch(tx.blog_categories, plan.blogCategories)
        const blogPostInserted = await insertBatch(tx.blog_posts, plan.blogPosts.map((row) => row.data))

        const replay = {
          products: await assertReplayNoop('products', tx.products, productData.map((data) => ({ id: data.id, data }))),
          blogCategories: await assertReplayNoop('blog_categories', tx.blog_categories, plan.blogCategories.map((data) => ({ id: data.id, data }))),
          blogPosts: await assertReplayNoop('blog_posts', tx.blog_posts, plan.blogPosts.map((row) => ({ id: row.data.id, data: row.data }))),
          descriptions: await assertAuxiliaryReplay(tx.product_descriptions, plan.productDescriptions),
          images: await assertAuxiliaryReplay(tx.product_images, plan.productImages),
          documents: await assertAuxiliaryReplay(tx.product_documents, plan.productDocuments),
        }
        const firstLedgerPass = reconcileIdempotencyLedger([], plan.idempotencyLedger)
        const secondLedgerPass = reconcileIdempotencyLedger(firstLedgerPass.entries, plan.idempotencyLedger)
        if (firstLedgerPass.inserted !== plan.idempotencyLedger.length
          || secondLedgerPass.identicalNoops !== plan.idempotencyLedger.length || secondLedgerPass.conflicts !== 0) {
          throw new Error('IMPORT_LEDGER_REPLAY_VALIDATION_FAILED')
        }
        const untouched = {
          orders: await tx.orders.count(),
          customers: await tx.customers.count(),
          staff: await tx.admin_users.count(),
        }
        if (Object.values(untouched).some((count) => count !== 0)) throw new Error('FRESH_DATASET_NOT_EMPTY')

        report = {
          status: 'PASS',
          source: plan.source,
          sourceCoverage: { assets: bundle.paths.length, ...plan.counts },
          sourceLockComparison: lock.comparison,
          localTarget: target,
          importedInRolledBackTransaction: {
            products: productInserted,
            categories: categoryInserted,
            subcategories: subcategoryInserted,
            brands: brandInserted,
            productDescriptions: descriptionInserted,
            productImages: imageInserted,
            productDocuments: documentInserted,
            blogCategories: blogCategoryInserted,
            blogPosts: blogPostInserted,
          },
          exactReplay: replay,
          idempotency: {
            sourceIdentityPlusIdPlusDigestKeys: plan.idempotencyLedger.length,
            uniqueKeys: new Set(plan.idempotencyLedger.map((entry) => entry.idempotencyKey)).size,
            identicalReplayNoops: secondLedgerPass.identicalNoops,
            conflicts: secondLedgerPass.conflicts,
            persistentLedgerRequiredBeforeFutureApply: true,
          },
          quarantinedProducts: plan.quarantinedProducts.length,
          quarantinedBlogPosts: plan.quarantinedBlogPosts.length,
          quarantinedVariantGroups: plan.quarantinedVariantGroups.length,
          schemaGaps: plan.schemaGaps,
          freshDatasetsUntouched: untouched,
          mediaBytesVerified: false,
          sourceLockState: lock.proposalState,
          transaction: 'ROLLBACK_REQUIRED_AFTER_DRY_RUN',
        }
        throw new RollbackDryRun(report)
      }, { timeout: 120_000, maxWait: 15_000 })
    } catch (error) {
      if (!(error instanceof RollbackDryRun)) throw error
      report = error.report
    }
    const postRollback = await Promise.all([
      prisma.products.count(),
      prisma.categories.count(),
      prisma.subcategories.count(),
      prisma.brands.count(),
      prisma.product_descriptions.count(),
      prisma.product_images.count(),
      prisma.product_documents.count(),
      prisma.blog_categories.count(),
      prisma.blog_posts.count(),
      prisma.orders.count(),
      prisma.customers.count(),
      prisma.admin_users.count(),
    ])
    if (postRollback.some((count) => count !== 0)) throw new Error('DRY_RUN_ROLLBACK_VERIFICATION_FAILED')
    process.stdout.write(`${JSON.stringify({ ...report, afterRollback: 'all target tables empty' })}\n`)
  } finally {
    await prisma.$disconnect()
  }
}

const sourceDir = process.argv.find((arg) => arg.startsWith('--source='))?.slice('--source='.length)
if (!sourceDir) {
  process.stderr.write('Usage: DATABASE_URL=<loopback disposable PG> DIRECT_URL=<same> npx tsx scripts/legacy-recovery/dry-run-local-import.mts --dry-run --source=/absolute/capture/path\n')
  process.exitCode = 2
} else {
  dryRun(resolve(sourceDir)).catch((error) => {
    const reason = error instanceof Error ? error.message : 'UNKNOWN'
    process.stderr.write(`${JSON.stringify({ status: 'STOP', reason })}\n`)
    process.exitCode = 1
  })
}
