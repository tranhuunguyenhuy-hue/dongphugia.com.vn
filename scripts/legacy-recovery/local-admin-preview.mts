import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { once } from 'node:events'
import { mkdir, readFile, readdir, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Prisma, PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import { buildRecoveryImportPlan, reconcileIdempotencyLedger } from './recovery-import-plan.mjs'
import {
  assertLocalAdminFullPreviewDatabase,
  assertLocalAdminPreviewDatabase,
  assertLocalAdminPreviewServerIdentity,
  assertSameLocalDatabase,
} from './local-target-guard.mjs'
import { readVerifiedBundle, verifyBlogArchiveDigest } from './public-source-contract.mjs'
import { importFullSource, readFullSourceCapture } from './full-source-local-import.mjs'

const DATABASE_URL = process.env.DATABASE_URL
const DIRECT_URL = process.env.DIRECT_URL
const BASE_URL = 'http://127.0.0.1:3107'
const LOCAL_FIXTURE_PREFIX = 'local-admin-preview-test-'
const TEST_ADMIN = { email: 'local-preview-admin@dpg.test', username: 'local-preview-admin', name: 'Local Preview Admin', role: 'admin' }
const TEST_MANAGER = { email: 'local-preview-manager@dpg.test', username: 'local-preview-manager', name: 'Local Preview Manager', role: 'sale_manager' }
const TEST_USERS = [TEST_ADMIN, TEST_MANAGER] as const
const SAFE_NEXT_ENV_KEYS = ['PATH', 'HOME', 'TMPDIR'] as const
const args = process.argv.slice(2)
const sourceArg = args.find((arg) => arg.startsWith('--source='))
const sourceDir = sourceArg?.slice('--source='.length)
const fullSourceArg = args.find((arg) => arg.startsWith('--full-source='))
const fullSourceDir = fullSourceArg?.slice('--full-source='.length)

function fail(reason: string): never {
  throw new Error(reason)
}

function chunks<T>(values: T[], size = 100): T[][] {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size))
  return result
}

function normalized(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'number') return canonicalNumeric(String(value))
  if (value && typeof value === 'object' && typeof (value as { toFixed?: unknown }).toFixed === 'function') {
    return canonicalNumeric(String(value))
  }
  if (Array.isArray(value)) return value.map(normalized)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, normalized(item)]))
  }
  return value
}

function canonicalNumeric(value: string): string {
  if (/[eE]/.test(value)) return value
  return value.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '').replace(/^-0$/, '0')
}

function comparableRows(rows: Record<string, unknown>[], keys: string[]): string[] {
  return rows.map((row) => JSON.stringify(normalized(Object.fromEntries(keys.map((key) => [key, row[key]])))))
    .sort((left, right) => left.localeCompare(right))
}

function assertRowsEqual(name: string, expected: Record<string, unknown>[], actual: Record<string, unknown>[], keys: string[]) {
  const expectedRows = comparableRows(expected, keys)
  const actualRows = comparableRows(actual, keys)
  if (JSON.stringify(expectedRows) !== JSON.stringify(actualRows)) fail(`LOCAL_IMPORT_REPLAY_CONFLICT:${name}`)
}

async function insertMany(model: unknown, rows: Record<string, unknown>[]): Promise<number> {
  const client = model as { createMany(args: { data: Record<string, unknown>[] }): Promise<{ count: number }> }
  let inserted = 0
  for (const batch of chunks(rows)) {
    if (batch.length) inserted += (await client.createMany({ data: batch })).count
  }
  return inserted
}

async function insertLedger(tx: Prisma.TransactionClient, entries: ReturnType<typeof buildRecoveryImportPlan>['idempotencyLedger']) {
  for (const batch of chunks(entries)) {
    const values = batch.map((_, index) => {
      const offset = index * 5
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`
    }).join(', ')
    const parameters = batch.flatMap((entry) => [entry.kind, entry.sourceIdentity, entry.sourceId, entry.sourceDigest, entry.idempotencyKey])
    await tx.$executeRawUnsafe(
      `INSERT INTO local_recovery.import_ledger (kind, source_identity, source_id, source_digest, idempotency_key) VALUES ${values}`,
      ...parameters,
    )
  }
}

async function createLocalLedger(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS local_recovery')
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS local_recovery.import_ledger (
      kind text NOT NULL CHECK (kind IN ('product', 'blog_post')),
      source_identity text NOT NULL,
      source_id integer NOT NULL,
      source_digest text NOT NULL CHECK (source_digest ~ '^[a-f0-9]{64}$'),
      idempotency_key text NOT NULL UNIQUE CHECK (idempotency_key ~ '^[a-f0-9]{64}$'),
      imported_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (kind, source_id)
    )
  `)
}

async function readCounts(tx: Prisma.TransactionClient) {
  const [products, categories, subcategories, brands, descriptions, images, documents,
    blogCategories, blogPosts, orders, customers, staff, sessions] = await Promise.all([
    tx.products.count(), tx.categories.count(), tx.subcategories.count(), tx.brands.count(),
    tx.product_descriptions.count(), tx.product_images.count(), tx.product_documents.count(),
    tx.blog_categories.count(), tx.blog_posts.count(), tx.orders.count(), tx.customers.count(),
    tx.admin_users.count(), tx.admin_sessions.count(),
  ])
  return { products, categories, subcategories, brands, descriptions, images, documents,
    blogCategories, blogPosts, orders, customers, staff, sessions }
}

async function rowsByIds(tx: Prisma.TransactionClient, modelName: string, ids: number[], keys: string[]) {
  const client = tx as unknown as Record<string, {
    findMany(args: { where: { id: { in: number[] } }; select: Record<string, true> }): Promise<Record<string, unknown>[]>
  }>
  const model = client[modelName]
  const select = Object.fromEntries(keys.map((key) => [key, true])) as Record<string, true>
  const rows: Record<string, unknown>[] = []
  for (const batch of chunks(ids, 500)) {
    rows.push(...await model.findMany({ where: { id: { in: batch } }, select }))
  }
  return rows
}

async function rowsByProductIds(tx: Prisma.TransactionClient, modelName: string, productIds: number[], keys: string[]) {
  const client = tx as unknown as Record<string, {
    findMany(args: { where: { product_id: { in: number[] } }; select: Record<string, true> }): Promise<Record<string, unknown>[]>
  }>
  const model = client[modelName]
  const select = Object.fromEntries(keys.map((key) => [key, true])) as Record<string, true>
  const rows: Record<string, unknown>[] = []
  for (const batch of chunks(productIds, 500)) {
    rows.push(...await model.findMany({ where: { product_id: { in: batch } }, select }))
  }
  return rows
}

async function productRowsForPlan(tx: Prisma.TransactionClient, plan: ReturnType<typeof buildRecoveryImportPlan>) {
  const [categories, subcategories, brands] = await Promise.all([
    tx.categories.findMany({ select: { id: true, slug: true } }),
    tx.subcategories.findMany({ select: { id: true, category_id: true, slug: true } }),
    tx.brands.findMany({ select: { id: true, slug: true } }),
  ])
  const categoryIds = new Map(categories.map((row) => [row.slug, row.id]))
  const subcategoryIds = new Map(subcategories.map((row) => [`${row.category_id}/${row.slug}`, row.id]))
  const brandIds = new Map(brands.map((row) => [row.slug, row.id]))
  return plan.products.map((row) => {
    const categoryId = categoryIds.get(row.categorySlug)
    const subcategoryId = categoryId ? subcategoryIds.get(`${categoryId}/${row.subcategorySlug}`) : undefined
    const brandId = row.brandSlug ? brandIds.get(row.brandSlug) : null
    if (!categoryId || !subcategoryId || (row.brandSlug && !brandId)) fail(`LOCAL_PRODUCT_RELATION_MISSING:${row.data.id}`)
    return { ...row.data, category_id: categoryId, subcategory_id: subcategoryId, brand_id: brandId }
  })
}

async function verifyImportedRows(tx: Prisma.TransactionClient, plan: ReturnType<typeof buildRecoveryImportPlan>) {
  const expectedProducts = await productRowsForPlan(tx, plan)
  const productKeys = [...new Set(expectedProducts.flatMap((row) => Object.keys(row)))]
  const actualProducts = await rowsByIds(tx, 'products', expectedProducts.map((row) => row.id), productKeys)
  assertRowsEqual('products', expectedProducts, actualProducts, productKeys)

  const productIds = expectedProducts.map((row) => row.id)
  const descriptionKeys = ['product_id', 'raw_html', 'clean_html', 'source']
  const descriptions = await rowsByProductIds(tx, 'product_descriptions', productIds, descriptionKeys)
  assertRowsEqual('product_descriptions', plan.productDescriptions, descriptions, descriptionKeys)
  const imageKeys = ['product_id', 'image_url', 'alt_text', 'image_type', 'sort_order']
  const images = await rowsByProductIds(tx, 'product_images', productIds, imageKeys)
  assertRowsEqual('product_images', plan.productImages, images, imageKeys)
  const documentKeys = ['product_id', 'name', 'url', 'document_type', 'sort_order']
  const documents = await rowsByProductIds(tx, 'product_documents', productIds, documentKeys)
  assertRowsEqual('product_documents', plan.productDocuments, documents, documentKeys)

  const categorySlugs = plan.categories.map((row) => row.slug)
  const categories = await tx.categories.findMany({ where: { slug: { in: categorySlugs } }, select: { name: true, slug: true } })
  assertRowsEqual('categories', plan.categories, categories, ['name', 'slug'])
  const categoryIds = new Map((await tx.categories.findMany({ select: { id: true, slug: true } }))
    .map((row) => [row.slug, row.id]))
  const subcategoryData = plan.subcategories.map((row) => {
    const categoryId = categoryIds.get(row.categorySlug)
    if (!categoryId) fail(`LOCAL_CATEGORY_MISSING:${row.categorySlug}`)
    return { category_id: categoryId, name: row.name, slug: row.slug, thumbnail_url: row.thumbnail_url }
  })
  const subcategories = await tx.subcategories.findMany({ select: { category_id: true, name: true, slug: true, thumbnail_url: true } })
  assertRowsEqual('subcategories', subcategoryData, subcategories, ['category_id', 'name', 'slug', 'thumbnail_url'])
  const brands = await tx.brands.findMany({ select: { name: true, slug: true } })
  assertRowsEqual('brands', plan.brands, brands, ['name', 'slug'])
  const blogCategories = await rowsByIds(tx, 'blog_categories', plan.blogCategories.map((row) => row.id), [...new Set(plan.blogCategories.flatMap((row) => Object.keys(row)))])
  const blogCategoryKeys = [...new Set(plan.blogCategories.flatMap((row) => Object.keys(row)))]
  assertRowsEqual('blog_categories', plan.blogCategories, blogCategories, blogCategoryKeys)
  const blogPosts = await rowsByIds(tx, 'blog_posts', plan.blogPosts.map((row) => row.data.id), [...new Set(plan.blogPosts.flatMap((row) => Object.keys(row.data)))])
  const blogPostKeys = [...new Set(plan.blogPosts.flatMap((row) => Object.keys(row.data)))]
  assertRowsEqual('blog_posts', plan.blogPosts.map((row) => row.data), blogPosts, blogPostKeys)
}

async function setExplicitIdSequences(tx: Prisma.TransactionClient) {
  for (const table of ['products', 'blog_categories', 'blog_posts']) {
    await tx.$queryRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('public.${table}', 'id'), COALESCE(MAX(id), 1), COUNT(*) > 0) FROM public.${table}`,
    )
  }
}

async function importRecoveredData(prisma: PrismaClient, plan: ReturnType<typeof buildRecoveryImportPlan>) {
  await createLocalLedger(prisma)
  return prisma.$transaction(async (tx) => {
    const ledgerRows = await tx.$queryRaw<Array<{
      kind: string; source_identity: string; source_id: number; source_digest: string; idempotency_key: string
    }>>`SELECT kind, source_identity, source_id, source_digest, idempotency_key FROM local_recovery.import_ledger ORDER BY kind, source_id`
    const incoming = plan.idempotencyLedger
    if (ledgerRows.length !== 0 && ledgerRows.length !== incoming.length) fail('LOCAL_IMPORT_LEDGER_PARTIAL_OR_DIFFERENT_SOURCE')
    const counts = await readCounts(tx)
    if (counts.orders !== 0 || counts.customers !== 0) fail('LOCAL_PREVIEW_ORDERS_AND_CUSTOMERS_MUST_START_EMPTY')

    if (ledgerRows.length === 0) {
      if (Object.entries(counts).some(([name, count]) => count !== 0 && name !== 'orders' && name !== 'customers')) {
        fail('LOCAL_PREVIEW_NONEMPTY_WITHOUT_SOURCE_LEDGER')
      }
      const categoriesInserted = await insertMany(tx.categories, plan.categories)
      const categoryIds = new Map((await tx.categories.findMany({ select: { id: true, slug: true } }))
        .map((row) => [row.slug, row.id]))
      const subcategoryData = plan.subcategories.map((row) => {
        const categoryId = categoryIds.get(row.categorySlug)
        if (!categoryId) fail(`LOCAL_CATEGORY_MISSING:${row.categorySlug}`)
        return { category_id: categoryId, name: row.name, slug: row.slug, thumbnail_url: row.thumbnail_url }
      })
      const subcategoriesInserted = await insertMany(tx.subcategories, subcategoryData)
      const subcategoryRows = await tx.subcategories.findMany({ select: { id: true, category_id: true, slug: true } })
      const subcategoryIds = new Map(subcategoryRows.map((row) => [`${row.category_id}/${row.slug}`, row.id]))
      const brandsInserted = await insertMany(tx.brands, plan.brands)
      const brandIds = new Map((await tx.brands.findMany({ select: { id: true, slug: true } }))
        .map((row) => [row.slug, row.id]))
      const products = plan.products.map((row) => {
        const categoryId = categoryIds.get(row.categorySlug)
        const subcategoryId = categoryId ? subcategoryIds.get(`${categoryId}/${row.subcategorySlug}`) : undefined
        const brandId = row.brandSlug ? brandIds.get(row.brandSlug) : null
        if (!categoryId || !subcategoryId || (row.brandSlug && !brandId)) fail(`LOCAL_PRODUCT_RELATION_MISSING:${row.data.id}`)
        return { ...row.data, category_id: categoryId, subcategory_id: subcategoryId, brand_id: brandId }
      })
      const productsInserted = await insertMany(tx.products, products)
      const descriptionsInserted = await insertMany(tx.product_descriptions, plan.productDescriptions)
      const imagesInserted = await insertMany(tx.product_images, plan.productImages)
      const documentsInserted = await insertMany(tx.product_documents, plan.productDocuments)
      const blogCategoriesInserted = await insertMany(tx.blog_categories, plan.blogCategories)
      const blogPostsInserted = await insertMany(tx.blog_posts, plan.blogPosts.map((row) => row.data))
      await insertLedger(tx, incoming)
      await setExplicitIdSequences(tx)
      return {
        mode: 'imported',
        imported: { categories: categoriesInserted, subcategories: subcategoriesInserted, brands: brandsInserted,
          products: productsInserted, descriptions: descriptionsInserted, images: imagesInserted,
          documents: documentsInserted, blogCategories: blogCategoriesInserted, blogPosts: blogPostsInserted,
          ledgerEntries: incoming.length },
      }
    }

    const existing = ledgerRows.map((row) => ({
      kind: row.kind, sourceIdentity: row.source_identity, sourceId: row.source_id,
      sourceDigest: row.source_digest.trim(), idempotencyKey: row.idempotency_key,
    }))
    const replay = reconcileIdempotencyLedger(existing, incoming)
    if (replay.inserted !== 0 || replay.identicalNoops !== incoming.length || replay.conflicts !== 0) {
      fail('LOCAL_IMPORT_LEDGER_REPLAY_NOT_IDENTICAL')
    }
    await verifyImportedRows(tx, plan)
    await setExplicitIdSequences(tx)
    return { mode: 'identical-noop', replay: { entries: incoming.length, identicalNoops: replay.identicalNoops, conflicts: 0 } }
  }, { timeout: 300_000, maxWait: 30_000 })
}

async function bootstrapSyntheticStaff(prisma: PrismaClient) {
  const users = TEST_USERS.map((user) => ({ ...user, password: randomBytes(32).toString('base64url') }))
  const hashes = await Promise.all(users.map((user) => bcrypt.hash(user.password, 12)))
  const existing = await prisma.admin_users.findMany({ select: { id: true, email: true, username: true, role: true } })
  if (existing.some((row) => !TEST_USERS.some((user) => row.email === user.email && row.username === user.username && row.role === user.role))) {
    fail('LOCAL_PREVIEW_UNEXPECTED_STAFF_RECORD')
  }
  if (existing.length > TEST_USERS.length) fail('LOCAL_PREVIEW_UNEXPECTED_STAFF_COUNT')
  const byEmail = new Map(existing.map((row) => [row.email, row]))
  for (const [index, user] of users.entries()) {
    const prior = byEmail.get(user.email)
    if (prior) {
      await prisma.admin_sessions.deleteMany({ where: { user_id: prior.id } })
      await prisma.admin_users.update({ where: { id: prior.id }, data: {
        name: user.name, role: user.role, username: user.username, password_hash: hashes[index], is_active: true,
      } })
    } else {
      await prisma.admin_users.create({ data: {
        email: user.email, username: user.username, name: user.name, role: user.role,
        password_hash: hashes[index], is_active: true,
      } })
    }
  }
  const seeded = await prisma.admin_users.findMany({
    where: { email: { in: TEST_USERS.map((user) => user.email) } },
    select: { id: true, email: true, role: true, is_active: true },
  })
  if (seeded.length !== TEST_USERS.length || seeded.some((row) => !row.is_active)) fail('LOCAL_PREVIEW_SYNTHETIC_STAFF_BOOTSTRAP_FAILED')
  return { users, records: seeded }
}

function safeEnvironment() {
  const inherited: Record<string, string> = {}
  for (const key of SAFE_NEXT_ENV_KEYS) if (process.env[key]) inherited[key] = process.env[key]!
  return {
    ...inherited,
    NODE_ENV: 'production',
    RUNTIME_ROLE: 'production',
    DATABASE_URL,
    DIRECT_URL: DATABASE_URL,
    AUTH_SECRET: randomBytes(32).toString('hex'),
    NEXT_PUBLIC_SITE_URL: BASE_URL,
    NEXT_TELEMETRY_DISABLED: '1',
    PUBLIC_CATALOGUE_SOURCE: 'local-preview',
    DPG_LOCAL_ADMIN_PREVIEW: '1',
    WRITE_FREEZE_MODE: 'false',
    PORT: '3107',
  }
}

async function createCleanRuntimeCopy(repoRoot: string) {
  const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' }).trim()
  if (dirty) fail('LOCAL_ADMIN_PREVIEW_REQUIRES_CLEAN_COMMITTED_SOURCE')
  const localEnvironmentFiles = (await readdir(repoRoot)).filter((name) => name.startsWith('.env') && name !== '.env.example')
  if (localEnvironmentFiles.length) fail('LOCAL_ADMIN_PREVIEW_REQUIRES_NO_LOCAL_ENV_FILES')
  // Build in the clean source checkout. A temp copy with a node_modules symlink
  // makes Next's standalone tracer escape the temp root on macOS; the sanitized
  // child environment and the explicit local-env-file check keep this build local.
  return repoRoot
}

async function startLocalApp(runtimeRoot: string, env: NodeJS.ProcessEnv) {
  const nextBin = join(runtimeRoot, 'node_modules/next/dist/bin/next')
  try {
    execFileSync(process.execPath, [nextBin, 'build', '--webpack'], {
      cwd: runtimeRoot, env, stdio: 'pipe', maxBuffer: 64 * 1024 * 1024,
    })
  } catch (error) {
    const commandError = error as { stdout?: Buffer | string; stderr?: Buffer | string }
    const output = `${commandError.stdout?.toString() ?? ''}\n${commandError.stderr?.toString() ?? ''}`.trim()
    fail(`LOCAL_ADMIN_PREVIEW_BUILD_FAILED:${output.slice(-6000) || 'BUILD_OUTPUT_UNAVAILABLE'}`)
  }
  const app: ChildProcess = spawn(process.execPath, [nextBin,
    'start', '--hostname', '127.0.0.1', '--port', '3107'], {
    cwd: runtimeRoot, env, stdio: ['ignore', 'ignore', 'ignore'],
  })
  for (let attempt = 0; attempt < 60; attempt++) {
    if (app.exitCode !== null) fail('LOCAL_ADMIN_PREVIEW_SERVER_EXITED')
    try {
      const response = await fetch(`${BASE_URL}/admin/login`, { signal: AbortSignal.timeout(1500) })
      if (response.status === 200) return app
    } catch { /* the loopback server is still starting */ }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1000))
  }
  app.kill('SIGTERM')
  fail('LOCAL_ADMIN_PREVIEW_SERVER_START_TIMEOUT')
}

async function stopLocalApp(app?: ChildProcess) {
  if (!app || app.exitCode !== null) return
  app.kill('SIGTERM')
  await Promise.race([once(app, 'exit'), new Promise((resolvePromise) => setTimeout(resolvePromise, 7000))])
  if (app.exitCode === null) app.kill('SIGKILL')
}

async function isolateBrowserContext(browser: Browser, viewport: { width: number; height: number }) {
  const context = await browser.newContext({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 })
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if ((url.protocol === 'http:' || url.protocol === 'https:') && url.origin !== BASE_URL) await route.abort()
    else await route.continue()
  })
  return context
}

async function login(page: Page, user: { username: string; password: string }, suffix: string, evidenceDir: string) {
  await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'domcontentloaded' })
  await page.locator('#identifier').fill(user.username)
  await page.locator('#password').fill(user.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  try {
    await page.waitForURL((url) => url.pathname === '/admin', { timeout: 25_000, waitUntil: 'domcontentloaded' })
  } catch {
    const body = await page.locator('body').innerText().catch(() => '')
    await page.screenshot({ path: join(evidenceDir, `admin-login-failure-${suffix}.png`), fullPage: true }).catch(() => undefined)
    fail(`LOCAL_ADMIN_LOGIN_REDIRECT_FAILED:${suffix}:${JSON.stringify({ url: page.url(), body: body.slice(-800) })}`)
  }
}

async function captureNoSession(page: Page, suffix: string, evidenceDir: string) {
  for (const path of ['/admin/products', '/admin/blog/posts']) {
    await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' })
    await page.waitForURL((url) => url.pathname === '/admin/login', { timeout: 20_000 })
  }
  await page.screenshot({ path: join(evidenceDir, `admin-login-${suffix}.png`), fullPage: true })
  if (!await page.getByRole('button', { name: 'Đăng nhập' }).isVisible()) fail(`LOCAL_NO_SESSION_LOGIN_FORM_MISSING:${suffix}`)
  return { viewport: suffix, products: 'redirected-to-login', blog: 'redirected-to-login' }
}

async function waitForActionResponse(page: Page, click: () => Promise<void>, label: string, diagnostics: string[]) {
  const observedRequests: string[] = []
  const recordRequest = (request: import('playwright').Request) => {
    if (new URL(request.url()).origin === BASE_URL) {
      observedRequests.push(`${request.method()} ${new URL(request.url()).pathname} action=${Boolean(request.headers()['next-action'])}`)
    }
  }
  page.on('request', recordRequest)
  try {
    const response = page.waitForResponse((candidate) => Boolean(candidate.request().headers()['next-action']), { timeout: 20_000 })
    await click()
    return await response
  } catch {
    const invalidFields = await page.locator('[aria-invalid="true"]').evaluateAll((nodes) => nodes.map((node) =>
      (node as HTMLInputElement).name || (node as HTMLElement).getAttribute('aria-label') || node.tagName,
    ))
    fail(`LOCAL_ADMIN_ACTION_NOT_OBSERVED:${label}:${JSON.stringify({ observedRequests, invalidFields, browser: diagnostics })}`)
  } finally {
    page.off('request', recordRequest)
  }
}

async function editLocalFixtures(
  page: Page,
  prisma: PrismaClient,
  fixtures: { product: { id: number; name: string }; blogPost: { id: number; title: string } },
  suffix: string,
  evidenceDir: string,
  diagnostics: string[],
) {
  const productEdit = await page.goto(`${BASE_URL}/admin/products/${fixtures.product.id}`, { waitUntil: 'domcontentloaded' })
  if (!productEdit || productEdit.status() !== 200) fail(`LOCAL_PRODUCT_EDIT_HTTP_FAILED:${suffix}`)
  const productNameInput = page.getByPlaceholder('VD: Bồn cầu 1 khối INAX AC-4005VN')
  await productNameInput.waitFor({ state: 'visible', timeout: 15_000 })
  await page.waitForLoadState('networkidle', { timeout: 15_000 })
  await page.waitForTimeout(500) // Let the ProductForm client handlers hydrate before changing controlled fields.
  const productName = `Local preview edited ${suffix}`
  await productNameInput.fill(productName)
  const submittedProductName = await productNameInput.inputValue()
  if (submittedProductName !== productName) fail(`LOCAL_PRODUCT_EDIT_FIELD_NOT_SET:${suffix}`)
  await page.screenshot({ path: join(evidenceDir, `admin-product-edit-before-${suffix}.png`), fullPage: true })
  const productAction = await waitForActionResponse(page, () => page.getByRole('button', { name: 'Cập nhật' }).first().click(), 'product-edit', diagnostics)
  if (productAction.status() < 200 || productAction.status() >= 300) fail(`LOCAL_PRODUCT_EDIT_ACTION_FAILED:${suffix}`)
  const productActionText = await productAction.text().catch(() => '')
  const productActionSignals = {
    success: /success.{0,12}true/i.test(productActionText),
    validation: /fieldErrors|invalid_type|too_small|too_big/i.test(productActionText),
    forbidden: /FORBIDDEN/i.test(productActionText),
    writeFreeze: /WRITE_FREEZE_ACTIVE/i.test(productActionText),
  }
  diagnostics.push(`product-action:${JSON.stringify({ status: productAction.status(), ...productActionSignals })}`)
  await page.waitForURL((url) => url.pathname === '/admin/products', { timeout: 20_000 })
  const editedProduct = await prisma.products.findUnique({ where: { id: fixtures.product.id }, select: { name: true, sku: true, updated_at: true } })
  if (editedProduct?.name !== productName) fail(`LOCAL_PRODUCT_EDIT_NOT_PERSISTED:${suffix}:${JSON.stringify({
    submittedProductName, persistedName: editedProduct?.name ?? null, fixtureSku: editedProduct?.sku ?? null,
    updatedAt: editedProduct?.updated_at?.toISOString() ?? null, action: productActionSignals, browser: diagnostics,
  })}`)
  await page.screenshot({ path: join(evidenceDir, `local-product-edit-${suffix}.png`), fullPage: true })

  const blogEdit = await page.goto(`${BASE_URL}/admin/blog/posts/${fixtures.blogPost.id}`, { waitUntil: 'domcontentloaded' })
  if (!blogEdit || blogEdit.status() !== 200) fail(`LOCAL_BLOG_EDIT_HTTP_FAILED:${suffix}`)
  const previousBlog = await prisma.blog_posts.findUnique({ where: { id: fixtures.blogPost.id }, select: { version: true } })
  if (!previousBlog) fail(`LOCAL_BLOG_EDIT_FIXTURE_MISSING:${suffix}`)
  const blogTitle = `Local preview draft edited ${suffix}`
  const blogTitleInput = page.getByPlaceholder('VD: Top 5 xu hướng gạch ốp lát 2026 đẹp nhất')
  await blogTitleInput.waitFor({ state: 'visible', timeout: 15_000 })
  await page.waitForLoadState('networkidle', { timeout: 15_000 })
  await page.waitForTimeout(500) // Let BlogPostForm's controlled input hydrate before changing it.
  await blogTitleInput.fill(blogTitle)
  const submittedBlogTitle = await blogTitleInput.inputValue()
  if (submittedBlogTitle !== blogTitle) fail(`LOCAL_BLOG_EDIT_FIELD_NOT_SET:${suffix}`)
  const blogAction = await waitForActionResponse(page, () => page.getByRole('button', { name: 'Cập nhật', exact: true }).click(), 'blog-edit', diagnostics)
  if (blogAction.status() < 200 || blogAction.status() >= 300) fail(`LOCAL_BLOG_EDIT_ACTION_FAILED:${suffix}`)
  const blogActionText = await blogAction.text().catch(() => '')
  const blogActionSignals = {
    success: /success.{0,12}true/i.test(blogActionText),
    validation: /fieldErrors|invalid_type|too_small|too_big/i.test(blogActionText),
    forbidden: /FORBIDDEN/i.test(blogActionText),
    writeFreeze: /WRITE_FREEZE_ACTIVE/i.test(blogActionText),
  }
  diagnostics.push(`blog-action:${JSON.stringify({ status: blogAction.status(), ...blogActionSignals })}`)
  await page.waitForURL((url) => url.pathname === '/admin/blog/posts', { timeout: 20_000 })
  const editedBlog = await prisma.blog_posts.findUnique({ where: { id: fixtures.blogPost.id }, select: { title: true, status: true, version: true, updated_at: true } })
  if (editedBlog?.title !== blogTitle || editedBlog.status !== 'draft' || editedBlog.version !== previousBlog.version + 1) {
    fail(`LOCAL_BLOG_EDIT_NOT_PERSISTED:${suffix}:${JSON.stringify({
      submittedBlogTitle, persistedTitle: editedBlog?.title ?? null, status: editedBlog?.status ?? null,
      versionBefore: previousBlog.version, versionAfter: editedBlog?.version ?? null,
      updatedAt: editedBlog?.updated_at?.toISOString() ?? null, action: blogActionSignals, browser: diagnostics,
    })}`)
  }
  await page.screenshot({ path: join(evidenceDir, `local-blog-edit-${suffix}.png`), fullPage: true })
  return { product: 'edited-through-legacy-admin', blogPost: 'draft-edited-through-legacy-admin' }
}

async function exerciseViewport(
  browser: Browser,
  prisma: PrismaClient,
  staff: Awaited<ReturnType<typeof bootstrapSyntheticStaff>>,
  sample: { product: { id: number; sku: string; name: string; category_id: number }; blogPost: { id: number; title: string } },
  fixtures: { product: { id: number; name: string }; blogPost: { id: number; title: string } },
  viewport: { width: number; height: number },
  suffix: string,
  evidenceDir: string,
  fullCatalogue?: { total: number; public: number; private: number },
) {
  const context = await isolateBrowserContext(browser, viewport)
  const page = await context.newPage()
  const diagnostics: string[] = []
  page.on('pageerror', (error) => diagnostics.push(`pageerror:${error.message.slice(0, 240)}`))
  page.on('console', (message) => { if (message.type() === 'error') diagnostics.push(`console:${message.text().slice(0, 240)}`) })
  page.on('requestfailed', (request) => diagnostics.push(`requestfailed:${new URL(request.url()).pathname}:${request.failure()?.errorText ?? 'unknown'}`))
  const noSession = await captureNoSession(page, suffix, evidenceDir)
  await login(page, staff.users[0], suffix, evidenceDir)

  let fullListingCounts: { unfilteredTotal: number; sourceRows: number; public: number; private: number } | undefined
  if (fullCatalogue) {
    const allResponse = await page.goto(`${BASE_URL}/admin/products`, { waitUntil: 'domcontentloaded' })
    if (!allResponse || allResponse.status() !== 200) fail(`LOCAL_FULL_PRODUCT_LIST_HTTP_FAILED:${suffix}`)
    await page.getByRole('heading', { name: 'Sản phẩm', exact: true }).waitFor({ timeout: 25_000 })
    const readTotal = async (status: 'all' | 'public' | 'private', expected: number) => {
      const url = status === 'all' ? '/admin/products' : `/admin/products?publication_status=${status}`
      const response = await page.goto(`${BASE_URL}${url}`, { waitUntil: 'domcontentloaded' })
      if (!response || response.status() !== 200) fail(`LOCAL_FULL_PRODUCT_FILTER_HTTP_FAILED:${suffix}:${status}`)
      try {
        await page.waitForFunction(
          () => /Hiển thị\s+[\d,.]+\s*\/\s*[\d,.]+\s+sản phẩm/.test(document.body.innerText),
          undefined,
          { timeout: 25_000 },
        )
      } catch {
        const excerpt = (await page.locator('body').innerText().catch(() => '')).slice(-1200)
        await page.screenshot({ path: join(evidenceDir, `admin-products-filter-unrendered-${status}-${suffix}.png`), fullPage: true }).catch(() => undefined)
        fail(`LOCAL_FULL_PRODUCT_FILTER_TABLE_NOT_RENDERED:${suffix}:${status}:${JSON.stringify({ excerpt })}`)
      }
      const text = await page.locator('body').innerText()
      const match = text.match(/Hiển thị\s+([\d,.]+)\s*\/\s*([\d,.]+)\s+sản phẩm/)
      if (!match || Number(match[2].replace(/[,.]/g, '')) !== expected) {
        await page.screenshot({ path: join(evidenceDir, `admin-products-filter-failure-${status}-${suffix}.png`), fullPage: true }).catch(() => undefined)
        fail(`LOCAL_FULL_PRODUCT_FILTER_COUNT_FAILED:${suffix}:${status}:${JSON.stringify({ actual: match?.[2] ?? null, excerpt: text.slice(-1200) })}`)
      }
      await page.screenshot({ path: join(evidenceDir, `admin-products-${status}-filter-${suffix}.png`), fullPage: true })
      return Number(match[2].replace(/[,.]/g, ''))
    }
    // The one explicitly synthetic local edit fixture is included in the
    // unfiltered Admin listing. Source population remains fullCatalogue.total.
    const all = await readTotal('all', fullCatalogue.total + 1)
    const publicProducts = await readTotal('public', fullCatalogue.public)
    const privateProducts = await readTotal('private', fullCatalogue.private)
    if (all !== fullCatalogue.total + 1 || publicProducts !== fullCatalogue.public || privateProducts !== fullCatalogue.private) {
      fail(`LOCAL_FULL_PRODUCT_STATUS_FILTER_COUNTS_FAILED:${suffix}`)
    }
    fullListingCounts = {
      unfilteredTotal: all,
      sourceRows: fullCatalogue.total,
      public: publicProducts,
      private: privateProducts,
    }
  }

  const productResponse = await page.goto(`${BASE_URL}/admin/products?category_id=${sample.product.category_id}&search=${encodeURIComponent(sample.product.sku)}`, { waitUntil: 'domcontentloaded' })
  if (!productResponse || productResponse.status() !== 200) fail(`LOCAL_PRODUCT_LIST_HTTP_FAILED:${suffix}`)
  await page.getByRole('heading', { name: 'Sản phẩm', exact: true }).waitFor({ timeout: 25_000 })
  await page.getByText(sample.product.sku, { exact: true }).waitFor({ state: 'visible', timeout: 25_000 })
  await page.screenshot({ path: join(evidenceDir, `admin-products-${suffix}.png`), fullPage: true })

  const blogResponse = await page.goto(`${BASE_URL}/admin/blog/posts`, { waitUntil: 'domcontentloaded' })
  if (!blogResponse || blogResponse.status() !== 200) fail(`LOCAL_BLOG_LIST_HTTP_FAILED:${suffix}`)
  await page.getByRole('heading', { name: 'Quản lý bài viết', exact: true }).waitFor({ timeout: 25_000 })
  // The local preview adds one draft fixture to the ten recovered published posts.
  await page.getByText('11 bài · 10 đang live', { exact: true }).waitFor({ state: 'visible', timeout: 10_000 })
  await page.getByText(sample.blogPost.title.slice(0, 12), { exact: false }).first().waitFor({ state: 'visible', timeout: 25_000 })
  await page.screenshot({ path: join(evidenceDir, `admin-blog-${suffix}.png`), fullPage: true })

  const edits = await editLocalFixtures(page, prisma, fixtures, suffix, evidenceDir, diagnostics)
  await context.close()

  const manager = await isolateBrowserContext(browser, viewport)
  const managerPage = await manager.newPage()
  await login(managerPage, staff.users[1], `manager-${suffix}`, evidenceDir)
  const allowedProducts = await managerPage.goto(`${BASE_URL}/admin/products`, { waitUntil: 'domcontentloaded' })
  if (!allowedProducts || allowedProducts.status() !== 200) fail(`LOCAL_MANAGER_PRODUCT_READ_DENIED:${suffix}`)
  const deniedBlog = await managerPage.goto(`${BASE_URL}/admin/blog/posts`, { waitUntil: 'domcontentloaded' })
  await managerPage.waitForURL((url) => url.pathname === '/admin', { timeout: 20_000 })
  if (!deniedBlog || deniedBlog.status() !== 200) fail(`LOCAL_MANAGER_BLOG_ROUTE_DENIAL_FAILED:${suffix}`)
  const dashboardText = await managerPage.locator('body').innerText()
  if (dashboardText.includes(sample.blogPost.title) || dashboardText.includes(fixtures.blogPost.title)) {
    fail(`LOCAL_MANAGER_BLOG_CONTENT_LEAKED:${suffix}`)
  }
  await managerPage.screenshot({ path: join(evidenceDir, `role-denied-blog-${suffix}.png`), fullPage: true })

  const beforeDeniedWrite = await prisma.products.findUnique({
    where: { id: fixtures.product.id }, select: { name: true, updated_at: true },
  })
  const auditCountBefore = await prisma.audit_logs.count({ where: { entity_type: 'product', entity_id: fixtures.product.id } })
  const editPage = await managerPage.goto(`${BASE_URL}/admin/products/${fixtures.product.id}`, { waitUntil: 'domcontentloaded' })
  if (!editPage || editPage.status() !== 200) fail(`LOCAL_MANAGER_PRODUCT_EDIT_ROUTE_UNEXPECTEDLY_DENIED:${suffix}`)
  await managerPage.getByPlaceholder('VD: Bồn cầu 1 khối INAX AC-4005VN').fill(`forbidden ${suffix}`)
  await managerPage.waitForTimeout(4000)
  const deniedDiagnostics: string[] = []
  managerPage.on('pageerror', (error) => deniedDiagnostics.push(`pageerror:${error.message.slice(0, 240)}`))
  managerPage.on('console', (message) => { if (message.type() === 'error') deniedDiagnostics.push(`console:${message.text().slice(0, 240)}`) })
  managerPage.on('requestfailed', (request) => deniedDiagnostics.push(`requestfailed:${new URL(request.url()).pathname}:${request.failure()?.errorText ?? 'unknown'}`))
  const deniedAction = await waitForActionResponse(managerPage, () => managerPage.getByRole('button', { name: 'Cập nhật' }).first().click(), 'manager-product-edit', deniedDiagnostics)
  const afterDeniedWrite = await prisma.products.findUnique({
    where: { id: fixtures.product.id }, select: { name: true, updated_at: true },
  })
  const auditCountAfter = await prisma.audit_logs.count({ where: { entity_type: 'product', entity_id: fixtures.product.id } })
  if (!beforeDeniedWrite || !afterDeniedWrite || afterDeniedWrite.name !== beforeDeniedWrite.name
    || afterDeniedWrite.updated_at.getTime() !== beforeDeniedWrite.updated_at.getTime()
    || auditCountAfter !== auditCountBefore) {
    fail(`LOCAL_MANAGER_PRODUCT_WRITE_MUTATED_DATA:${suffix}`)
  }
  await manager.close()
  return {
    viewport: `${viewport.width}x${viewport.height}`,
    noSession: noSession.products,
    adminLogin: 'bcrypt-session-created',
    productList: 'read-ok',
    productStatusFilters: fullListingCounts,
    blogList: 'read-ok',
    managerProductRead: 'allowed',
    managerBlogRead: 'redirected-to-admin',
    managerProductWrite: `denied-no-write-http-${deniedAction.status()}`,
    localFixtureEdits: edits,
  }
}

async function main() {
  if (!args.includes('--local-only') || args.includes('--apply') || args.some((arg) => arg !== '--local-only' && arg !== sourceArg && arg !== fullSourceArg)) {
    fail('LOCAL_ADMIN_PREVIEW_REQUIRES_ONLY_LOCAL_ONLY_SOURCE_AND_OPTIONAL_FULL_SOURCE_FLAGS')
  }
  if (!sourceDir) fail('LOCAL_ADMIN_PREVIEW_SOURCE_REQUIRED')
  if (!DATABASE_URL || !DIRECT_URL) fail('LOCAL_ADMIN_PREVIEW_DATABASE_URLS_REQUIRED')
  const assertTarget = fullSourceDir ? assertLocalAdminFullPreviewDatabase : assertLocalAdminPreviewDatabase
  const target = assertTarget(DATABASE_URL)
  assertSameLocalDatabase(target, assertTarget(DIRECT_URL))

  const expectedDataDirectory = process.env.DPG_LOCAL_POSTGRES_DATA_DIRECTORY
  if (!expectedDataDirectory) fail('DPG_LOCAL_POSTGRES_DATA_DIRECTORY_REQUIRED')
  const expectedDataPath = await realpath(expectedDataDirectory)
  const temporaryRoot = await realpath('/tmp')
  if (!expectedDataPath.startsWith(`${temporaryRoot}${sep}`) || !basename(expectedDataPath).startsWith('dpg-legacy-admin-pg-')) {
    fail('LOCAL_ADMIN_PREVIEW_POSTGRES_DATA_DIRECTORY_NOT_DISPOSABLE')
  }

  const entryPath = fileURLToPath(import.meta.url)
  const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: resolve(entryPath, '../../..'), encoding: 'utf8',
  }).trim()
  const prisma = new PrismaClient()
  let app: ChildProcess | undefined
  let browser: Browser | undefined
  let runtimeRoot: string | undefined
  const fixtureIds: { productId?: number; blogPostId?: number } = {}
  let syntheticStaffIds: number[] = []
  try {
    await prisma.$connect()
    const serverIdentity = await prisma.$queryRaw<Array<{
      server_address: string | null; server_port: number; database_name: string; data_directory: string; version_num: number
    }>>`SELECT host(inet_server_addr()) AS server_address, inet_server_port() AS server_port,
      current_database() AS database_name, current_setting('data_directory') AS data_directory,
      current_setting('server_version_num')::integer AS version_num`
    const identity = serverIdentity[0]
    if (!identity) fail('LOCAL_ADMIN_PREVIEW_POSTGRES_IDENTITY_UNAVAILABLE')
    assertLocalAdminPreviewServerIdentity(target, {
      serverAddress: identity.server_address,
      serverPort: identity.server_port,
      databaseName: identity.database_name,
      serverVersionNum: identity.version_num,
      dataDirectory: await realpath(identity.data_directory),
      expectedDataDirectory: expectedDataPath,
    })

    const nextEnv = safeEnvironment()
    execFileSync(process.execPath, [join(repoRoot, 'node_modules/prisma/build/index.js'), 'db', 'push',
      '--schema', join(repoRoot, 'prisma/schema.prisma'), '--skip-generate'], {
      cwd: repoRoot, env: nextEnv, stdio: 'pipe', maxBuffer: 8 * 1024 * 1024,
    })

    const lock = JSON.parse(await (await import('node:fs/promises')).readFile(join(repoRoot, 'scripts/legacy-recovery/public-source-candidate-lock.proposed.json'), 'utf8'))
    if (lock.proposalState !== 'PROPOSED_REVIEW_REQUIRED') fail('LOCAL_ADMIN_PREVIEW_SOURCE_LOCK_NOT_PROPOSED')
    const bundle = await readVerifiedBundle(resolve(sourceDir), lock)
    const blogBytes = await readFile(join(repoRoot, 'apps/public/src/runtime/legacy-blog-snapshot.json'))
    verifyBlogArchiveDigest(blogBytes, lock.blogArchive?.sha256)
    const archive = JSON.parse(blogBytes.toString('utf8'))
    const plan = buildRecoveryImportPlan(bundle, archive, blogBytes)
    if (plan.quarantinedProducts.length || plan.quarantinedBlogPosts.length) fail('LOCAL_ADMIN_PREVIEW_SOURCE_HAS_QUARANTINE')
    let importResult: Record<string, unknown>
    let expectedProductCount = plan.products.length
    let fullCatalogue: { total: number; public: number; private: number } | undefined
    if (fullSourceDir) {
      const full = await readFullSourceCapture(resolve(fullSourceDir), plan.blogCategories, plan.blogPosts.map((row) => row.data))
      const fullIds = new Set(full.capture.ids)
      if (bundle.products.some((row) => !fullIds.has(row.id))) fail('FULL_SOURCE_CAPTURE_MISSING_PUBLIC_SNAPSHOT_ID')
      const statusCounts = full.capture.manifest.capture.publicationStatus as Record<string, number>
      fullCatalogue = { total: 17_752, public: Number(statusCounts.public), private: Number(statusCounts.private) }
      if (fullCatalogue.total !== full.capture.ids.length || fullCatalogue.public !== 17_739 || fullCatalogue.private !== 13) {
        fail('FULL_SOURCE_PUBLICATION_STATUS_COUNTS_INVALID')
      }
      importResult = await importFullSource(prisma, full, plan.blogCategories, plan.blogPosts.map((row) => row.data))
      expectedProductCount = fullCatalogue.total
    } else {
      importResult = await importRecoveredData(prisma, plan)
    }

    // Remove only stale test fixtures left by an interrupted prior local run.
    await prisma.$transaction(async (tx) => {
      const staleProducts = await tx.products.findMany({
        where: { source_system: 'local-admin-preview-fixture', sku: { startsWith: LOCAL_FIXTURE_PREFIX } },
        select: { id: true },
      })
      const staleProductIds = staleProducts.map((row) => row.id)
      if (staleProductIds.length) {
        await tx.audit_logs.deleteMany({ where: { entity_type: 'product', entity_id: { in: staleProductIds } } })
        await tx.product_taxon_assignments.deleteMany({ where: { product_id: { in: staleProductIds } } })
        await tx.products.deleteMany({ where: { id: { in: staleProductIds } } })
      }
      await tx.blog_posts.deleteMany({ where: { slug: { startsWith: LOCAL_FIXTURE_PREFIX }, status: 'draft', author_name: 'Local Preview Fixture' } })
    })

    const counts = await readCounts(prisma as unknown as Prisma.TransactionClient)
    if (counts.products !== expectedProductCount || counts.blogPosts !== plan.blogPosts.length
      || counts.blogCategories !== plan.blogCategories.length || counts.orders !== 0 || counts.customers !== 0) {
      fail('LOCAL_ADMIN_PREVIEW_IMPORTED_COUNTS_INVALID')
    }
    const category = await prisma.categories.findFirst({ orderBy: { id: 'asc' }, select: { id: true } })
    const sampleProduct = await prisma.products.findFirst({
      where: { category_id: category?.id }, orderBy: { id: 'asc' },
      select: { id: true, sku: true, name: true, category_id: true },
    })
    const sampleBlogPost = await prisma.blog_posts.findFirst({
      where: { status: 'published' }, orderBy: { id: 'desc' }, select: { id: true, title: true },
    })
    if (!sampleProduct || !sampleBlogPost) fail('LOCAL_ADMIN_PREVIEW_SAMPLE_RECORD_MISSING')

    const firstSubcategory = await prisma.subcategories.findFirst({ orderBy: { id: 'asc' }, select: { id: true, category_id: true } })
    const previewCategory = await prisma.blog_categories.findFirst({ orderBy: { id: 'asc' }, select: { id: true } })
    if (!firstSubcategory || !previewCategory) fail('LOCAL_ADMIN_PREVIEW_FIXTURE_RELATION_MISSING')
    const token = randomBytes(8).toString('hex')
    const fixtureSku = `${LOCAL_FIXTURE_PREFIX}${token}`
    const fixtureProduct = await prisma.products.create({ data: {
      sku: fixtureSku,
      name: `Local preview fixture ${token}`,
      slug: `${LOCAL_FIXTURE_PREFIX}${token}`,
      category_id: firstSubcategory.category_id,
      subcategory_id: firstSubcategory.id,
      stock_status: 'contact',
      is_active: false,
      is_featured: false,
      publication_status: 'draft',
      pdp_visibility: 'hidden',
      listing_visibility: 'hidden',
      search_visibility: 'hidden',
      sellable_status: 'not_sellable',
      seo_indexing: 'noindex',
      sitemap_include: false,
      source_system: 'local-admin-preview-fixture',
      price_source: 'unknown',
      price_state: 'unknown',
      price_confidence: 'low',
    }, select: { id: true, name: true } })
    fixtureIds.productId = fixtureProduct.id
    const fixtureBlogPost = await prisma.blog_posts.create({ data: {
      title: `Local Preview Draft ${token}`,
      slug: `${LOCAL_FIXTURE_PREFIX}${token}`,
      content: '<p>Synthetic local Admin preview fixture.</p>',
      category_id: previewCategory.id,
      status: 'draft',
      author_name: 'Local Preview Fixture',
      is_featured: false,
      is_pinned: false,
    }, select: { id: true, title: true } })
    fixtureIds.blogPostId = fixtureBlogPost.id

    const staff = await bootstrapSyntheticStaff(prisma)
    syntheticStaffIds = staff.records.map((user) => user.id)
    const screenshotDir = join(tmpdir(), `dpg-legacy-admin-preview-${new Date().toISOString().slice(0, 10)}`)
    await mkdir(screenshotDir, { recursive: true, mode: 0o700 })
    runtimeRoot = await createCleanRuntimeCopy(repoRoot)
    app = await startLocalApp(runtimeRoot, nextEnv)
    browser = await chromium.launch({ headless: true })

    const desktop = await exerciseViewport(browser, prisma, staff, {
      product: sampleProduct, blogPost: sampleBlogPost,
    }, {
      product: fixtureProduct, blogPost: fixtureBlogPost,
    }, { width: 1440, height: 1000 }, 'desktop', screenshotDir, fullCatalogue)
    const mobile = await exerciseViewport(browser, prisma, staff, {
      product: sampleProduct, blogPost: sampleBlogPost,
    }, {
      product: fixtureProduct, blogPost: fixtureBlogPost,
    }, { width: 390, height: 844 }, 'mobile', screenshotDir, fullCatalogue)

    const sessionCount = await prisma.admin_sessions.count({ where: { user_id: { in: syntheticStaffIds } } })
    if (sessionCount < TEST_USERS.length) fail('LOCAL_ADMIN_PREVIEW_BCRYPT_SESSIONS_NOT_CREATED')
    process.stdout.write(`${JSON.stringify({
      status: 'PASS', localOnly: true, localUrl: BASE_URL, server: 'Node 24 / Next.js production build',
      database: { ...target, serverVersion: identity.version_num, dataDirectory: basename(expectedDataPath) },
      sourceLockState: lock.proposalState, sourceCheckpoint: plan.source.checkpoint,
      imported: fullCatalogue
        ? { fullProducts: fullCatalogue.total, publicProducts: fullCatalogue.public, privateProducts: fullCatalogue.private, recoveredBlogPosts: plan.blogPosts.length }
        : plan.counts,
      fullSourceCapture: fullCatalogue ? { state: 'PROPOSED_REVIEW_REQUIRED', sourceProject: 'bonxyxluzlxfkdetryoo', sourceSchema: 'dpg_app' } : undefined,
      persistentImport: importResult, tableCounts: { ...counts, staff: staff.records.length, syntheticSessionsCreated: sessionCount },
      credentials: 'random per run; bcrypt hashes only in the local database; never emitted',
      tests: [desktop, mobile], externalBrowserRequests: 'blocked', orders: 0, customers: 0,
      mediaBytesVerified: false, evidence: screenshotDir,
    })}\n`)
  } finally {
    if (browser) await browser.close().catch(() => undefined)
    await stopLocalApp(app)
    if (syntheticStaffIds.length) await prisma.admin_sessions.deleteMany({ where: { user_id: { in: syntheticStaffIds } } }).catch(() => undefined)
    if (fixtureIds.productId || fixtureIds.blogPostId) {
      await prisma.$transaction(async (tx) => {
        if (fixtureIds.productId) {
          await tx.audit_logs.deleteMany({ where: { entity_type: 'product', entity_id: fixtureIds.productId } })
          await tx.product_taxon_assignments.deleteMany({ where: { product_id: fixtureIds.productId } })
          await tx.products.deleteMany({ where: { id: fixtureIds.productId, source_system: 'local-admin-preview-fixture' } })
        }
        if (fixtureIds.blogPostId) await tx.blog_posts.deleteMany({ where: { id: fixtureIds.blogPostId, author_name: 'Local Preview Fixture' } })
      }).catch(() => undefined)
    }
    if (runtimeRoot && runtimeRoot !== repoRoot) await rm(runtimeRoot, { recursive: true, force: true }).catch(() => undefined)
    await prisma.$disconnect().catch(() => undefined)
  }
}

main().catch((error) => {
  const reason = error instanceof Error ? error.message : 'UNKNOWN'
  process.stderr.write(`${JSON.stringify({ status: 'STOP', reason, localOnly: true })}\n`)
  process.exitCode = 1
})
