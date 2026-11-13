import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  expectedPublicAssetPaths,
  sha256,
  validateCandidateManifest,
  validatePublicRecords,
} from './public-source-contract.mjs'

function fixture() {
  const manifest = {
    contract: 'dpg:public-catalogue-snapshot:v1',
    checkpoint: 'a'.repeat(40),
    m3CodeSha: 'b'.repeat(40),
    m3RunId: '40739074902',
    products: 1,
    listingProducts: 1,
    productBuckets: ['00'],
    categories: [{
      slug: 'thiet-bi-ve-sinh',
      name: 'Thiết bị vệ sinh',
      totalCount: 1,
      listings: [{ slug: 'bon-cau', name: 'Bồn Cầu', totalCount: 1 }],
    }],
    searchShards: ['0'],
    searchProducts: 1,
    sitemapProductIds: [7],
    variantGroups: {},
    contentStats: {
      summaries: 0, descriptionBlocks: 0, specifications: 0, galleries: 0, referencePrices: 0,
      variantProducts: 0, publicPrices: 0, hitaPrices: 0, manualPrices: 0,
      verifiedOriginalPrices: 0, onlineFinalPrices: 0, richDescriptions: 0, productsWithDocuments: 0,
    },
  }
  const product = {
    id: 7, sku: 'TEST-7', name: 'Bồn cầu mẫu', display_name: 'Bồn cầu mẫu', slug: 'bon-cau-mau',
    price: null, price_display: 'Liên hệ báo giá', original_price: null, list_price: null, sale_price: null,
    online_discount_amount: null, final_online_price: null, price_provenance: null, is_promotion: false,
    stock_status: 'contact', image_main_url: 'https://dpg-products.b-cdn.net/products/test.webp',
    is_active: true, is_featured: false, variant_options: [], variant_group: undefined,
    categories: { name: 'Thiết bị vệ sinh', slug: 'thiet-bi-ve-sinh' },
    subcategories: { name: 'Bồn cầu', slug: 'bon-cau' }, brands: null,
    publicContent: {
      summary: null, descriptionBlocks: [], specifications: {}, gallery: [], referencePrice: null,
      descriptionHtml: null, documents: [],
    },
    url: '/thiet-bi-ve-sinh/bon-cau/bon-cau-mau',
  }
  const bucket = { contract: manifest.contract, checkpoint: manifest.checkpoint, products: [product] }
  const listed = { id: 7, sku: product.sku, slug: product.slug, url: product.url }
  const listing = {
    contract: manifest.contract, checkpoint: manifest.checkpoint, page: 1, totalCount: 1,
    categorySlug: 'thiet-bi-ve-sinh', listingSlug: 'bon-cau', products: [listed],
  }
  const search = {
    contract: manifest.contract, checkpoint: manifest.checkpoint,
    products: [{ id: 7, sku: product.sku, slug: product.slug, url: product.url,
      category_slug: 'thiet-bi-ve-sinh', subcategory_slug: 'bon-cau' }],
  }
  const paths = expectedPublicAssetPaths(manifest)
  const lock = {
    contract: 'dpg:legacy-admin-public-source-lock:v1',
    origin: 'https://www.dongphugia.vn',
    identity: { checkpoint: manifest.checkpoint, m3CodeSha: manifest.m3CodeSha, m3RunId: manifest.m3RunId },
    counts: { products: 1, listingProducts: 1, productBuckets: 1, categories: 1, searchShards: 1 },
    manifest: { sha256: 'c'.repeat(64) },
    assets: Object.fromEntries(paths.map((path) => [path, 'd'.repeat(64)])),
  }
  return { manifest, product, bucket, listing, search, lock, paths }
}

describe('public catalogue recovery contract', () => {
  it('keeps live-lock and Blog archive drift explicit without changing the tracked lock', async () => {
    const [candidateBytes, trackedBytes, blogBytes] = await Promise.all([
      readFile(resolve('scripts/legacy-recovery/public-source-candidate-lock.proposed.json')),
      readFile(resolve('scripts/catalogue-direct/public-snapshot-260-lock.json')),
      readFile(resolve('apps/public/src/runtime/legacy-blog-snapshot.json')),
    ])
    const candidate = JSON.parse(candidateBytes.toString('utf8'))
    const tracked = JSON.parse(trackedBytes.toString('utf8'))
    const commonAssets = Object.entries(tracked.assets).filter(([path]) => path in candidate.assets)
    const changedAssets = commonAssets.filter(([path, digest]) => candidate.assets[path] !== digest)
    const changedDataAssets = changedAssets.filter(([path]) => path !== 'manifest.json')
    const addedAssets = Object.keys(candidate.assets).filter((path) => !(path in tracked.assets))

    expect(candidate.proposalState).toBe('PROPOSED_REVIEW_REQUIRED')
    expect(candidate.comparison.trackedLockSha256).toBe(sha256(trackedBytes))
    expect(candidate.comparison.priorPayloadSemanticDiff).toBe('UNKNOWN_PRIOR_ASSET_BYTES_UNAVAILABLE')
    expect(candidate.sourceVerification.projectionGeneration).toBe('unknown')
    expect(commonAssets).toHaveLength(371)
    expect(changedAssets).toHaveLength(371)
    expect(changedDataAssets).toHaveLength(370)
    expect(addedAssets.sort()).toEqual(['search/0.json', 'search/1.json', 'search/2.json', 'search/3.json'])
    expect(candidate.blogArchive.sha256).toBe(sha256(blogBytes))
  })

  it('requires declared asset paths and exact current source identity', () => {
    const { manifest, lock, paths } = fixture()
    expect(validateCandidateManifest(manifest, lock)).toEqual(paths)
    expect(() => validateCandidateManifest({ ...manifest, m3RunId: 'different' }, lock))
      .toThrow('PUBLIC_SOURCE_IDENTITY_MISMATCH')
    expect(() => validateCandidateManifest(manifest, { ...lock, assets: { ...lock.assets, 'search/1.json': 'a'.repeat(64) } }))
      .toThrow('PUBLIC_SOURCE_ASSET_SET_MISMATCH')
  })

  it('reconciles unique product, listing, search and canonical URL identities', () => {
    const { manifest, bucket, listing, search } = fixture()
    const result = validatePublicRecords(manifest, [bucket], [listing], [search])
    expect(result.products).toHaveLength(1)
    expect(result.listingCount).toBe(1)
    expect(result.searchCount).toBe(1)
    expect(result.sitemapIds).toEqual(new Set([7]))
  })

  it('fails on duplicate product IDs and route mismatches', () => {
    const { manifest, bucket, listing, search, product } = fixture()
    const twoProductManifest = { ...manifest, products: 2, productBuckets: ['00', '01'] }
    expect(() => validatePublicRecords(twoProductManifest, [
      bucket,
      { ...bucket, products: [{ ...product, sku: 'OTHER' }] },
    ], [listing], [search])).toThrow('PUBLIC_PRODUCT_IDENTITY_DUPLICATE:7')
    expect(() => validatePublicRecords(manifest, [
      { ...bucket, products: [{ ...product, url: '/wrong/path' }] },
    ], [listing], [search])).toThrow('PUBLIC_PRODUCT_CANONICAL_URL_MISMATCH:7')
  })

  it('fails on product-to-listing disagreement and content-stat drift', () => {
    const { manifest, bucket, listing, search, product } = fixture()
    expect(() => validatePublicRecords(manifest, [bucket], [
      { ...listing, products: [{ ...listing.products[0], sku: 'WRONG' }] },
    ], [search])).toThrow('PUBLIC_LISTING_PRODUCT_MISMATCH:7')
    expect(() => validatePublicRecords({ ...manifest, contentStats: { ...manifest.contentStats, summaries: 2 } },
      [{ ...bucket, products: [{ ...product, publicContent: { ...product.publicContent, summary: 'text' } }] }], [listing], [search]))
      .toThrow('PUBLIC_CONTENT_STATS_MISMATCH')
  })
})
