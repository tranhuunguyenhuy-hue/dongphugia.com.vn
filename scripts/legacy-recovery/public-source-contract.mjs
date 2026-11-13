import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const PUBLIC_SOURCE_CONTRACT = 'dpg:legacy-admin-public-source-lock:v1'
export const PUBLIC_CATALOGUE_CONTRACT = 'dpg:public-catalogue-snapshot:v1'
export const BLOG_ARCHIVE_CONTRACT = 'dpg:verified-legacy-blog-snapshot:v1'
export const PAGE_SIZE = 48
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

export function verifyBlogArchiveDigest(bytes, expectedSha256) {
  if (!/^[a-f0-9]{64}$/.test(expectedSha256 ?? '') || sha256(bytes) !== expectedSha256) {
    throw new Error('BLOG_ARCHIVE_DIGEST_MISMATCH')
  }
  return expectedSha256
}

export function expectedPublicAssetPaths(manifest) {
  if (!manifest || !Array.isArray(manifest.productBuckets) || !Array.isArray(manifest.categories)) {
    throw new Error('PUBLIC_MANIFEST_INVALID')
  }
  const paths = ['manifest.json', ...manifest.productBuckets.map((bucket) => `products/${bucket}.json`)]
  for (const category of manifest.categories) {
    for (const listing of category.listings ?? []) {
      if (!Number.isSafeInteger(listing.totalCount) || listing.totalCount < 1) throw new Error('PUBLIC_LISTING_INVALID')
      for (let page = 1; page <= Math.ceil(listing.totalCount / PAGE_SIZE); page++) {
        paths.push(`listings/${category.slug}/${listing.slug}/${page}.json`)
      }
    }
  }
  for (const shard of manifest.searchShards ?? []) {
    if (!/^[0-3]$/.test(shard)) throw new Error('PUBLIC_SEARCH_SHARD_INVALID')
    paths.push(`search/${shard}.json`)
  }
  if (new Set(paths).size !== paths.length) throw new Error('PUBLIC_ASSET_PATH_DUPLICATE')
  return paths.sort((a, b) => a === 'manifest.json' ? -1 : b === 'manifest.json' ? 1 : a.localeCompare(b))
}

export function validateCandidateManifest(manifest, lock) {
  if (!manifest || manifest.contract !== PUBLIC_CATALOGUE_CONTRACT
    || lock?.contract !== PUBLIC_SOURCE_CONTRACT
    || lock.origin !== 'https://www.dongphugia.vn'
    || manifest.checkpoint !== lock.identity?.checkpoint
    || manifest.m3CodeSha !== lock.identity?.m3CodeSha
    || String(manifest.m3RunId) !== String(lock.identity?.m3RunId)
    || manifest.products !== lock.counts?.products
    || manifest.listingProducts !== lock.counts?.listingProducts
    || manifest.productBuckets?.length !== lock.counts?.productBuckets
    || manifest.categories?.length !== lock.counts?.categories
    || manifest.searchShards?.length !== lock.counts?.searchShards
    || !/^[a-f0-9]{64}$/.test(lock.manifest?.sha256 ?? '')) {
    throw new Error('PUBLIC_SOURCE_IDENTITY_MISMATCH')
  }
  const paths = expectedPublicAssetPaths(manifest)
  const lockedPaths = new Set(Object.keys(lock.assets ?? {}))
  if (paths.length !== lockedPaths.size || paths.some((path) => !lockedPaths.has(path))) {
    throw new Error('PUBLIC_SOURCE_ASSET_SET_MISMATCH')
  }
  if (paths.some((path) => !/^[a-f0-9]{64}$/.test(lock.assets[path] ?? ''))) {
    throw new Error('PUBLIC_SOURCE_ASSET_DIGEST_INVALID')
  }
  return paths
}

export function validatePublicRecords(manifest, buckets, listings, searchShards = []) {
  if (buckets.length !== manifest.productBuckets.length) throw new Error('PUBLIC_PRODUCT_BUCKET_COUNT_MISMATCH')
  const products = []
  for (const bucket of buckets) {
    if (bucket.contract !== PUBLIC_CATALOGUE_CONTRACT || bucket.checkpoint !== manifest.checkpoint
      || !Array.isArray(bucket.products)) throw new Error('PUBLIC_PRODUCT_BUCKET_INVALID')
    products.push(...bucket.products)
  }
  if (products.length !== manifest.products) throw new Error('PUBLIC_PRODUCT_COUNT_MISMATCH')

  const ids = new Set()
  const skus = new Set()
  const urls = new Set()
  const byId = new Map()
  for (const product of products) {
    if (!Number.isSafeInteger(product.id) || product.id < 1 || typeof product.sku !== 'string' || !product.sku
      || typeof product.slug !== 'string' || !SLUG.test(product.slug)
      || !product.categories || typeof product.categories.name !== 'string' || !SLUG.test(product.categories.slug)
      || !product.subcategories || typeof product.subcategories.name !== 'string' || !SLUG.test(product.subcategories.slug)
      || typeof product.url !== 'string') throw new Error(`PUBLIC_PRODUCT_REQUIRED_FIELD:${product?.id ?? 'unknown'}`)
    if (ids.has(product.id) || skus.has(product.sku) || urls.has(product.url)) {
      throw new Error(`PUBLIC_PRODUCT_IDENTITY_DUPLICATE:${product.id}`)
    }
    const canonical = `/${product.categories.slug}/${product.subcategories.slug}/${product.slug}`
    if (product.url !== canonical) throw new Error(`PUBLIC_PRODUCT_CANONICAL_URL_MISMATCH:${product.id}`)
    ids.add(product.id); skus.add(product.sku); urls.add(product.url); byId.set(product.id, product)
  }

  const listingIds = new Set()
  let listingCount = 0
  const listingKeys = new Set()
  for (const entry of listings) {
    if (entry.contract !== PUBLIC_CATALOGUE_CONTRACT || entry.checkpoint !== manifest.checkpoint
      || !Array.isArray(entry.products) || !Number.isSafeInteger(entry.page) || !Number.isSafeInteger(entry.totalCount)) {
      throw new Error('PUBLIC_LISTING_PAGE_INVALID')
    }
    const key = `${entry.categorySlug}/${entry.listingSlug}`
    if (listingKeys.has(`${key}/${entry.page}`)) throw new Error('PUBLIC_LISTING_PAGE_DUPLICATE')
    listingKeys.add(`${key}/${entry.page}`)
    const category = manifest.categories.find((candidate) => candidate.slug === entry.categorySlug)
    const listing = category?.listings.find((candidate) => candidate.slug === entry.listingSlug)
    const expectedPages = listing ? Math.ceil(listing.totalCount / PAGE_SIZE) : 0
    const expectedPageCount = listing ? Math.min(PAGE_SIZE, listing.totalCount - ((entry.page - 1) * PAGE_SIZE)) : 0
    if (!listing || entry.page < 1 || entry.page > expectedPages || entry.totalCount !== listing.totalCount
      || entry.products.length !== expectedPageCount) throw new Error(`PUBLIC_LISTING_PAGE_SHAPE_INVALID:${key}/${entry.page}`)
    for (const listed of entry.products) {
      const product = byId.get(listed.id)
      if (!product || listingIds.has(listed.id) || product.url !== `/${key}/${product.slug}`
        || listed.url !== product.url || listed.sku !== product.sku) {
        throw new Error(`PUBLIC_LISTING_PRODUCT_MISMATCH:${listed.id}`)
      }
      listingIds.add(listed.id); listingCount++
    }
  }
  if (listingCount !== manifest.listingProducts) throw new Error('PUBLIC_LISTING_PRODUCT_COUNT_MISMATCH')

  const sitemapIds = manifest.sitemapProductIds
  if (!Array.isArray(sitemapIds) || new Set(sitemapIds).size !== sitemapIds.length
    || sitemapIds.some((id) => !ids.has(id))) throw new Error('PUBLIC_SITEMAP_IDENTITY_INVALID')
  const searchIds = new Set()
  let searchCount = 0
  for (let index = 0; index < searchShards.length; index++) {
    const shard = searchShards[index]
    if (shard.contract !== PUBLIC_CATALOGUE_CONTRACT || shard.checkpoint !== manifest.checkpoint
      || !Array.isArray(shard.products) || String(index) !== manifest.searchShards[index]) {
      throw new Error('PUBLIC_SEARCH_SHARD_INVALID')
    }
    for (const product of shard.products) {
      const canonical = byId.get(product.id)
      if (!canonical || searchIds.has(product.id) || canonical.sku !== product.sku || canonical.slug !== product.slug
        || canonical.url !== product.url || canonical.categories.slug !== product.category_slug
        || canonical.subcategories.slug !== product.subcategory_slug) throw new Error(`PUBLIC_SEARCH_PRODUCT_MISMATCH:${product.id}`)
      searchIds.add(product.id); searchCount++
    }
  }
  if (searchCount !== manifest.searchProducts) throw new Error('PUBLIC_SEARCH_PRODUCT_COUNT_MISMATCH')

  const groups = new Map()
  for (const product of products) {
    if (product.variant_group === undefined) continue
    if (!groups.has(product.variant_group)) groups.set(product.variant_group, [])
    groups.get(product.variant_group).push(product)
  }
  const declaredGroups = manifest.variantGroups ?? {}
  if (groups.size !== Object.keys(declaredGroups).length) throw new Error('PUBLIC_VARIANT_GROUP_COUNT_MISMATCH')
  for (const [key, members] of groups) {
    const declared = declaredGroups[key]
    if (!Array.isArray(declared) || members.length !== declared.length || members.length < 2 || members.length > 8) {
      throw new Error(`PUBLIC_VARIANT_GROUP_INVALID:${key}`)
    }
    for (const member of declared) {
      const product = byId.get(member.id)
      if (!product || product.variant_group !== key || product.variant_type !== member.variant_type
        || product.variant_label !== member.variant_label || product.sku !== member.sku || product.url !== member.url) {
        throw new Error(`PUBLIC_VARIANT_MEMBER_MISMATCH:${key}:${member.id}`)
      }
    }
  }

  const stats = {
    summaries: products.filter((product) => Boolean(product.publicContent?.summary)).length,
    descriptionBlocks: products.filter((product) => Boolean(product.publicContent?.descriptionBlocks?.length)).length,
    specifications: products.filter((product) => Object.keys(product.publicContent?.specifications ?? {}).length > 0).length,
    galleries: products.filter((product) => Boolean(product.publicContent?.gallery?.length)).length,
    referencePrices: products.filter((product) => Boolean(product.publicContent?.referencePrice)).length,
    variantProducts: products.filter((product) => Boolean(product.variant_group)).length,
    publicPrices: products.filter((product) => product.price !== null).length,
    hitaPrices: products.filter((product) => product.price_provenance === 'legacy-hita-pm-approved-2026-11-03').length,
    manualPrices: products.filter((product) => product.price_provenance === 'legacy-manual-2026-07-02').length,
    verifiedOriginalPrices: products.filter((product) => product.original_price !== null).length,
    onlineFinalPrices: products.filter((product) => product.final_online_price !== null).length,
    richDescriptions: products.filter((product) => typeof product.publicContent?.descriptionHtml === 'string').length,
    productsWithDocuments: products.filter((product) => Boolean(product.publicContent?.documents?.length)).length,
  }
  if (JSON.stringify(stats) !== JSON.stringify(manifest.contentStats)) throw new Error('PUBLIC_CONTENT_STATS_MISMATCH')
  return { products, productIds: ids, listingIds, searchIds, sitemapIds: new Set(sitemapIds), productById: byId, listingCount, searchCount, stats }
}

export async function readVerifiedBundle(root, lock) {
  const manifestBytes = await readFile(join(root, 'manifest.json'))
  if (sha256(manifestBytes) !== lock.manifest.sha256) throw new Error('PUBLIC_MANIFEST_DIGEST_MISMATCH')
  const manifest = JSON.parse(manifestBytes)
  const paths = validateCandidateManifest(manifest, lock)
  const files = new Map([['manifest.json', manifestBytes]])
  for (const assetPath of paths.slice(1)) {
    const bytes = await readFile(join(root, assetPath))
    if (sha256(bytes) !== lock.assets[assetPath]) throw new Error(`PUBLIC_ASSET_DIGEST_MISMATCH:${assetPath}`)
    files.set(assetPath, bytes)
  }
  const buckets = manifest.productBuckets.map((bucket) => JSON.parse(files.get(`products/${bucket}.json`)))
  const listingPages = []
  for (const category of manifest.categories) {
    for (const listing of category.listings) {
      for (let page = 1; page <= Math.ceil(listing.totalCount / PAGE_SIZE); page++) {
        listingPages.push({
          categorySlug: category.slug,
          listingSlug: listing.slug,
          ...JSON.parse(files.get(`listings/${category.slug}/${listing.slug}/${page}.json`)),
        })
      }
    }
  }
  const searchShards = (manifest.searchShards ?? []).map((shard) => JSON.parse(files.get(`search/${shard}.json`)))
  const records = validatePublicRecords(manifest, buckets, listingPages, searchShards)
  return { manifest, manifestBytes, manifestSha256: sha256(manifestBytes), paths, files, buckets, listingPages, searchShards, ...records }
}

export function reconcileBlogArchive(archive) {
  if (!archive || archive.contract !== BLOG_ARCHIVE_CONTRACT || !Array.isArray(archive.categories)
    || !Array.isArray(archive.posts)) throw new Error('BLOG_ARCHIVE_CONTRACT_INVALID')
  const categoriesById = new Map()
  const categorySlugs = new Set()
  for (const category of archive.categories) {
    if (!Number.isSafeInteger(category.id) || category.id < 1 || typeof category.name !== 'string'
      || typeof category.slug !== 'string' || !SLUG.test(category.slug)
      || categoriesById.has(category.id) || categorySlugs.has(category.slug)) throw new Error('BLOG_CATEGORY_IDENTITY_INVALID')
    categoriesById.set(category.id, category); categorySlugs.add(category.slug)
  }
  const postsById = new Map()
  const postSlugs = new Set()
  const published = []
  const quarantined = []
  for (const post of archive.posts) {
    if (!Number.isSafeInteger(post.id) || post.id < 1 || typeof post.slug !== 'string' || !SLUG.test(post.slug)
      || postsById.has(post.id) || postSlugs.has(post.slug)) throw new Error('BLOG_POST_IDENTITY_INVALID')
    postsById.set(post.id, post); postSlugs.add(post.slug)
    if (post.status !== 'published' || !post.published_at) continue
    if (!categoriesById.has(post.category_id)) {
      quarantined.push({ id: post.id, slug: post.slug, reason: 'BLOG_CATEGORY_MISSING' }); continue
    }
    if (typeof post.content !== 'string' || !post.content.trim()) {
      quarantined.push({ id: post.id, slug: post.slug, reason: 'BLOG_BODY_MISSING' }); continue
    }
    if (!/^[a-f0-9]{32}$/.test(post.content_md5 ?? '')
      || createHash('md5').update(post.content).digest('hex') !== post.content_md5) {
      quarantined.push({ id: post.id, slug: post.slug, reason: 'BLOG_BODY_DIGEST_MISMATCH' }); continue
    }
    published.push({ ...post, category: categoriesById.get(post.category_id) })
  }
  return { categories: archive.categories, published, quarantined }
}
