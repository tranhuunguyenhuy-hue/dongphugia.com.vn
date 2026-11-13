#!/usr/bin/env node
// Local-only synthetic regression for the isolated vinext/Workerd Admin spike.
// It rejects non-loopback endpoints and reads the disposable DB URL only from
// the spike's Wrangler localConnectionString; it never targets a hosted DB.

import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { Client } from 'pg'
import bcrypt from 'bcryptjs'
import { chromium } from 'playwright'

const repoRoot = path.resolve(import.meta.dirname, '../..')
const workerConfigPath = path.join(repoRoot, 'apps/public/wrangler.admin-worker-spike.jsonc')
const baseUrl = new URL(process.env.ADMIN_WORKER_SPIKE_URL ?? 'http://127.0.0.1:8789')
const stageName = { value: 'configuration' }
const syntheticPassword = 'Synthetic-Worker-Spike-Password-Only'

function assertLoopbackTarget(url) {
  assert.equal(url.protocol, 'http:')
  assert.equal(url.hostname, '127.0.0.1')
  assert.equal(url.port, '8789')
}

function readLocalDatabaseUrl(configText) {
  const match = configText.match(/"localConnectionString"\s*:\s*("(?:\\.|[^"\\])*")/)
  assert.ok(match, 'local Wrangler config must include a disposable localConnectionString')
  const url = new URL(JSON.parse(match[1]))
  assert.equal(url.hostname, '127.0.0.1')
  assert.equal(url.port, '55439')
  assert.equal(url.pathname, '/dpg_admin_worker_spike')
  assert.equal(url.searchParams.get('sslmode'), 'disable')
  return url.toString()
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function localUrl(pathname) {
  return new URL(pathname, baseUrl).toString()
}

async function waitForDatabaseConnections(client, expectedAtMost, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const result = await client.query(
      `SELECT count(*)::int AS count
       FROM pg_stat_activity
       WHERE datname = current_database() AND usename = current_user`,
    )
    if (result.rows[0].count <= expectedAtMost) return
    await sleep(50)
  }
  const result = await client.query(
    `SELECT count(*)::int AS count
     FROM pg_stat_activity
     WHERE datname = current_database() AND usename = current_user`,
  )
  assert.ok(
    result.rows[0].count <= expectedAtMost,
    `Worker database connections remained above baseline (${result.rows[0].count} > ${expectedAtMost})`,
  )
}

async function main() {
  assertLoopbackTarget(baseUrl)
  const configText = await readFile(workerConfigPath, 'utf8')
  const databaseUrl = readLocalDatabaseUrl(configText)
  const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 3000 })
  let browser
  let context
  let userId
  let productId
  let productCategoryId
  let blogPostId
  let blogCategoryId
  let baselineConnections = 0
  const marker = `workerd-spike-${Date.now()}-${randomBytes(3).toString('hex')}`
  const username = marker
  const email = `${marker}@example.test`
  const productSku = marker.toUpperCase().slice(0, 100)
  const productSlug = `${marker}-product`
  const blogSlug = `${marker}-blog`
  const productName = `${marker} Product`
  const blogTitle = `${marker} Blog`
  const updatedProductName = `${marker} Product Updated`
  const updatedBlogTitle = `${marker} Blog Updated`

  try {
    stageName.value = 'local synthetic fixture setup'
    await client.connect()
    const hash = await bcrypt.hash(syntheticPassword, 12)
    await client.query('BEGIN')
    const category = await client.query(
      `INSERT INTO dpg_app.categories (name, slug) VALUES ($1, $2) RETURNING id`,
      [`${marker} Product Category`, `${marker}-category`],
    )
    productCategoryId = category.rows[0].id
    const blogCategory = await client.query(
      `INSERT INTO dpg_app.blog_categories (name, slug) VALUES ($1, $2) RETURNING id`,
      [`${marker} Blog Category`, `${marker}-blog-category`],
    )
    blogCategoryId = blogCategory.rows[0].id
    const user = await client.query(
      `INSERT INTO dpg_app.admin_users (email, username, name, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, 'admin', true) RETURNING id`,
      [email, username, `${marker} Admin`, hash],
    )
    userId = user.rows[0].id
    const product = await client.query(
      `INSERT INTO dpg_app.products
         (sku, name, slug, category_id, price, list_price, sale_price,
          image_main_url, is_active, stock_status, price_source, price_confidence,
          publication_status, pdp_visibility, listing_visibility, search_visibility,
          seo_indexing, sitemap_include)
       VALUES ($1, $2, $3, $4, 129000, 129000, NULL,
          'https://synthetic.example.test/admin-worker-spike.jpg', false, 'in_stock',
          'manual_spike_fixture', 'high', 'draft', 'hidden', 'hidden', 'hidden',
          'noindex', false)
       RETURNING id`,
      [productSku, productName, productSlug, productCategoryId],
    )
    productId = product.rows[0].id
    await client.query(
      `INSERT INTO dpg_app.blog_posts (title, slug, content, category_id, status, version)
       VALUES ($1, $2, 'Synthetic Workerd regression content.', $3, 'draft', 1)
       RETURNING id`,
      [blogTitle, blogSlug, blogCategoryId],
    ).then((result) => { blogPostId = result.rows[0].id })
    await client.query('COMMIT')

    const initialProduct = await client.query(
      `SELECT price, list_price, sale_price, price_source, price_confidence,
              publication_status, pdp_visibility, seo_indexing, sitemap_include
       FROM dpg_app.products WHERE id = $1`,
      [productId],
    )
    const productProvenance = initialProduct.rows[0]
    const initialConnectionCount = await client.query(
      `SELECT count(*)::int AS count
       FROM pg_stat_activity WHERE datname = current_database() AND usename = current_user`,
    )
    baselineConnections = initialConnectionCount.rows[0].count

    stageName.value = 'launching headless Playwright against local Workerd'
    browser = await chromium.launch({ headless: true })

    async function signInAndRead() {
      const signedInContext = await browser.newContext()
      const page = await signedInContext.newPage()
      const loginResponse = await page.goto(localUrl('/admin/login'), { waitUntil: 'domcontentloaded' })
      assert.equal(loginResponse?.status(), 200)
      await page.locator('#identifier').fill(username)
      await page.locator('#password').fill(syntheticPassword)
      await Promise.all([
        page.waitForURL((url) => url.pathname === '/admin/products', { timeout: 20000 }),
        page.getByRole('button', { name: 'Đăng nhập' }).click(),
      ])
      const productResponse = await page.goto(localUrl('/admin/products'), { waitUntil: 'domcontentloaded' })
      assert.equal(productResponse?.status(), 200)
      const blogResponse = await page.goto(localUrl('/admin/blog/posts'), { waitUntil: 'domcontentloaded' })
      assert.equal(blogResponse?.status(), 200)
      return { context: signedInContext, page }
    }

    stageName.value = 'three sequential synthetic login and protected SSR requests'
    const first = await signInAndRead()
    await first.context.close()
    const second = await signInAndRead()
    await second.context.close()
    const third = await signInAndRead()
    context = third.context
    const page = third.page

    stageName.value = 'authenticated Product edit through Worker server action'
    const productEditResponse = await page.goto(
      localUrl(`/admin/products/${productId}`),
      { waitUntil: 'domcontentloaded' },
    )
    assert.equal(productEditResponse?.status(), 200)
    await page.locator('input[name="name"]').fill(updatedProductName)
    await Promise.all([
      page.waitForURL((url) => url.pathname === '/admin/products', { timeout: 20000 }),
      page.getByRole('button', { name: 'Cập nhật', exact: true }).first().click(),
    ])
    const savedProduct = await client.query(
      `SELECT name, price, list_price, sale_price, price_source, price_confidence,
              publication_status, pdp_visibility, seo_indexing, sitemap_include
       FROM dpg_app.products WHERE id = $1`,
      [productId],
    )
    assert.equal(savedProduct.rows[0].name, updatedProductName)
    assert.deepEqual(
      Object.fromEntries(Object.keys(productProvenance).map((key) => [key, savedProduct.rows[0][key]])),
      productProvenance,
      'Product price provenance and public visibility fields must survive an Admin edit',
    )

    stageName.value = 'authenticated Blog edit through Worker server action'
    const blogEditResponse = await page.goto(
      localUrl(`/admin/blog/posts/${blogPostId}`),
      { waitUntil: 'domcontentloaded' },
    )
    assert.equal(blogEditResponse?.status(), 200)
    await page.waitForLoadState('networkidle', { timeout: 20000 })
    await page.getByPlaceholder('VD: Top 5 xu hướng gạch ốp lát 2026 đẹp nhất').fill(updatedBlogTitle)
    await Promise.all([
      page.waitForURL((url) => url.pathname === '/admin/blog/posts', { timeout: 20000 }),
      page.getByRole('button', { name: 'Cập nhật', exact: true }).click(),
    ])
    const savedBlogPost = await client.query(
      `SELECT title, status, version FROM dpg_app.blog_posts WHERE id = $1`,
      [blogPostId],
    )
    assert.equal(savedBlogPost.rows[0].title, updatedBlogTitle)
    assert.equal(savedBlogPost.rows[0].status, 'draft')
    assert.equal(savedBlogPost.rows[0].version, 2)

    stageName.value = 'same-process concurrent authenticated reads and stream cleanup'
    for (let round = 0; round < 3; round++) {
      const responses = await Promise.all([
        context.request.get(localUrl('/admin/products')),
        context.request.get(localUrl('/admin/blog/posts')),
      ])
      assert.deepEqual(responses.map((response) => response.status()), [200, 200])
    }
    await waitForDatabaseConnections(client, baselineConnections)

    stageName.value = 'Products write denied to sale role'
    await client.query(`UPDATE dpg_app.admin_users SET role = 'sale' WHERE id = $1`, [userId])
    await page.goto(localUrl(`/admin/products/${productId}`), { waitUntil: 'domcontentloaded' })
    await page.locator('input[name="name"]').fill(`${marker} Denied Product Edit`)
    await page.getByRole('button', { name: 'Cập nhật', exact: true }).first().click()
    await page.getByText('Bạn không có quyền cập nhật sản phẩm.', { exact: true }).waitFor({
      state: 'visible',
      timeout: 10000,
    })
    const deniedProduct = await client.query(`SELECT name FROM dpg_app.products WHERE id = $1`, [productId])
    assert.equal(deniedProduct.rows[0].name, updatedProductName)

    stageName.value = 'revoked synthetic session denied on protected route'
    await client.query(`DELETE FROM dpg_app.admin_sessions WHERE user_id = $1`, [userId])
    const revokedResponse = await page.goto(localUrl('/admin/products'), { waitUntil: 'domcontentloaded' })
    assert.ok(revokedResponse?.status() === 200 || revokedResponse?.status() === 307)
    assert.equal(new URL(page.url()).pathname, '/admin/login')

    stageName.value = 'Worker route boundary and no public fixture response'
    const publicBlogResponse = await page.goto(localUrl('/blog'), { waitUntil: 'domcontentloaded' })
    assert.equal(publicBlogResponse?.status(), 404)

    stageName.value = 'stream and database client cleanup'
    await waitForDatabaseConnections(client, baselineConnections)
    console.log('PASS: 3 sequential Workerd logins; authenticated Product/Blog SSR and edits; price/visibility provenance preserved; sale-role write and revoked session denied; 3 concurrent read rounds; DB connections returned to baseline; /blog stayed unavailable.')
  } finally {
    await context?.close().catch(() => {})
    await browser?.close().catch(() => {})
    try {
      await client.query('ROLLBACK').catch(() => {})
      if (userId !== undefined) {
        await client.query(`DELETE FROM dpg_app.admin_sessions WHERE user_id = $1`, [userId]).catch(() => {})
        await client.query(`DELETE FROM dpg_app.audit_logs WHERE user_id = $1`, [userId]).catch(() => {})
      }
      if (blogPostId !== undefined) await client.query(`DELETE FROM dpg_app.blog_posts WHERE id = $1`, [blogPostId]).catch(() => {})
      if (productId !== undefined) await client.query(`DELETE FROM dpg_app.products WHERE id = $1`, [productId]).catch(() => {})
      if (blogCategoryId !== undefined) await client.query(`DELETE FROM dpg_app.blog_categories WHERE id = $1`, [blogCategoryId]).catch(() => {})
      if (productCategoryId !== undefined) await client.query(`DELETE FROM dpg_app.categories WHERE id = $1`, [productCategoryId]).catch(() => {})
      if (userId !== undefined) await client.query(`DELETE FROM dpg_app.admin_users WHERE id = $1`, [userId]).catch(() => {})
    } finally {
      await client.end().catch(() => {})
    }
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? ` (${error.code})` : ''
  const safeMessage = String(error?.message ?? '')
    .replaceAll(syntheticPassword, '[redacted synthetic password]')
    .replace(/postgres(?:ql)?:\/\/[^\s]*/g, '[redacted local database URL]')
    .slice(0, 500)
  console.error(`FAIL: ${stageName.value}: ${error?.name ?? 'Error'}${code}${safeMessage ? `: ${safeMessage}` : ''}`)
  process.exitCode = 1
})
