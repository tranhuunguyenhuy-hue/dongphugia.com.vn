import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildRecoveryImportPlan, reconcileIdempotencyLedger } from './recovery-import-plan.mjs'
import { verifyBlogArchiveDigest } from './public-source-contract.mjs'

const archivePath = resolve('apps/public/src/runtime/legacy-blog-snapshot.json')
const archiveBytes = await readFile(archivePath)
const blogArchive = JSON.parse(archiveBytes)

function fixtureBundle(price = null) {
  const manifest = {
    checkpoint: 'a'.repeat(40), m3CodeSha: 'b'.repeat(40), m3RunId: '40739074902',
    categories: [{ slug: 'thiet-bi-ve-sinh', name: 'Thiết bị vệ sinh', listings: [
      { slug: 'bon-cau', name: 'Bồn Cầu', totalCount: 1, thumbnail_url: null },
    ] }],
  }
  const pricing = price === null ? {
    price: null, price_display: 'Liên hệ báo giá', original_price: null, list_price: null, sale_price: null,
    online_discount_amount: null, final_online_price: null, price_provenance: null, is_promotion: false,
  } : {
    price, price_display: null, original_price: 1200, list_price: 1200, sale_price: price,
    online_discount_amount: 200, final_online_price: price - 200,
    price_provenance: 'legacy-hita-pm-approved-2026-11-03', is_promotion: true,
  }
  const product = {
    id: 7, sku: 'TEST-7', name: 'Bồn cầu mẫu', display_name: 'Bồn cầu mẫu', slug: 'bon-cau-mau',
    ...pricing, stock_status: 'contact', image_main_url: 'https://dpg-products.b-cdn.net/products/test.webp',
    is_active: true, is_featured: false, variant_options: [],
    categories: { name: 'Thiết bị vệ sinh', slug: 'thiet-bi-ve-sinh' },
    subcategories: { name: 'Bồn cầu', slug: 'bon-cau' }, brands: null,
    publicContent: { summary: null, descriptionBlocks: [], specifications: {}, gallery: [], referencePrice: null,
      descriptionHtml: null, documents: [] },
    url: '/thiet-bi-ve-sinh/bon-cau/bon-cau-mau',
  }
  const listed = { id: 7, sku: product.sku, slug: product.slug, url: product.url }
  return {
    manifest: { ...manifest, checkpoint: 'a'.repeat(40), manifestSha256: 'c'.repeat(64), contentStats: { descriptionBlocks: 0 } },
    manifestBytes: Buffer.from('{}'), manifestSha256: 'c'.repeat(64),
    products: [product], productById: new Map([[7, product]]),
    listingPages: [{ categorySlug: 'thiet-bi-ve-sinh', listingSlug: 'bon-cau', products: [listed] }],
    listingIds: new Set([7]), searchIds: new Set([7]), sitemapIds: new Set([7]),
    listingCount: 1, searchCount: 1, stats: { descriptionBlocks: 0 },
  }
}

describe('legacy source import plan', () => {
  it('pins the local Blog archive bytes before reading records', () => {
    const digest = '13e1cbb34891b2564b78795d5210bcc4a15d2e480883d94bbe1b17ef560db77c'
    expect(verifyBlogArchiveDigest(archiveBytes, digest)).toBe(digest)
    expect(() => verifyBlogArchiveDigest(archiveBytes, 'f'.repeat(64))).toThrow('BLOG_ARCHIVE_DIGEST_MISMATCH')
  })

  it('preserves historical price provenance and keeps unpriced products in contact mode', () => {
    const historical = buildRecoveryImportPlan(fixtureBundle(1000), blogArchive, archiveBytes)
    expect(historical.products[0].data.price_state).toBe('historical_snapshot')
    expect(historical.products[0].data.source_system).toBe('legacy-hita-pm-approved-2026-11-03')
    expect(historical.products[0].data.price_source).toBe('hita')
    expect(historical.products[0].data.sellable_status).toBe('contact')
    const unknown = buildRecoveryImportPlan(fixtureBundle(), blogArchive, archiveBytes)
    expect(unknown.products[0].data.price).toBeNull()
    expect(unknown.products[0].data.price_state).toBe('unknown')
    expect(unknown.products[0].data.price_display).toBe('Liên hệ báo giá')
  })

  it('preserves canonical paths and verifies the local Blog archive IDs and body digests', () => {
    const plan = buildRecoveryImportPlan(fixtureBundle(), blogArchive, archiveBytes)
    expect(plan.products[0].canonicalUrl).toBe('/thiet-bi-ve-sinh/bon-cau/bon-cau-mau')
    expect(plan.blogCategories.map((category) => category.id)).toEqual([1, 2, 3, 4, 5, 6])
    expect(plan.blogPosts).toHaveLength(10)
    expect(plan.blogPosts.map((post) => post.data.id)).toEqual([18, 17, 11, 10, 8, 7, 5, 4, 3, 2])
    expect(plan.blogPosts.every((post) => post.sourceBodyMd5.length === 32)).toBe(true)
    expect(plan.blogCategories.every((category) => !('created_at' in category) && !('updated_at' in category))).toBe(true)
    expect(plan.blogPosts.every((post) => post.data.published_at instanceof Date
      && !Number.isNaN(post.data.published_at.valueOf()))).toBe(true)
    expect(plan.quarantinedBlogPosts).toEqual([])
  })

  it('quarantines a Blog body whose stored digest no longer matches', () => {
    const changed = structuredClone(blogArchive)
    changed.posts[0].content += 'changed'
    const plan = buildRecoveryImportPlan(fixtureBundle(), changed, Buffer.from(JSON.stringify(changed)))
    expect(plan.quarantinedBlogPosts).toEqual([
      expect.objectContaining({ id: 18, reason: 'BLOG_BODY_DIGEST_MISMATCH' }),
    ])
    expect(plan.blogPosts).toHaveLength(9)
  })

  it('uses source identity, ID and digest for no-op replay and rejects same-ID content changes', () => {
    const plan = buildRecoveryImportPlan(fixtureBundle(), blogArchive, archiveBytes)
    const first = reconcileIdempotencyLedger([], plan.idempotencyLedger)
    const second = reconcileIdempotencyLedger(first.entries, plan.idempotencyLedger)
    expect(first.inserted).toBe(plan.idempotencyLedger.length)
    expect(second.identicalNoops).toBe(plan.idempotencyLedger.length)
    expect(second.conflicts).toBe(0)
    const changed = { ...plan.idempotencyLedger[0], sourceDigest: 'f'.repeat(64), idempotencyKey: 'e'.repeat(64) }
    expect(() => reconcileIdempotencyLedger(first.entries, [changed])).toThrow('IMPORT_LEDGER_SOURCE_CONFLICT')
  })
})
