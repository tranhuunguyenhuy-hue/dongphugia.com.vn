import { createHash } from 'node:crypto'
import { isRestoredPublicPricing } from '../catalogue-direct/public-restored-pricing.mjs'
import { isSafePublicContent } from '../catalogue-direct/public-product-content.mjs'
import { safeImage } from '../catalogue-direct/public-image-policy.mjs'
import { sha256 } from './public-source-contract.mjs'

const PRICE_SOURCES = {
  'legacy-hita-pm-approved-2026-11-03': { source: 'hita', updatedAt: '2026-11-03' },
  'legacy-manual-2026-07-02': { source: 'manual', updatedAt: '2026-07-02' },
}
const PUBLISHED_TAXONOMY_ALIASES = new Map([
  ['thiet-bi-ve-sinh/lavabo', new Set(['Lavabo', 'Chậu Lavabo'])],
])

function normalizedLabel(value) {
  return typeof value === 'string' ? value.normalize('NFKC').trim().toLocaleLowerCase('vi') : ''
}

function taxonomyNameMatches(path, publicName, sourceName) {
  if (normalizedLabel(publicName) === normalizedLabel(sourceName)) return true
  return PUBLISHED_TAXONOMY_ALIASES.get(path)?.has(publicName)
    && PUBLISHED_TAXONOMY_ALIASES.get(path)?.has(sourceName)
}

function canonicalJson(value) {
  if (value instanceof Date) return JSON.stringify(value.toISOString())
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function digestRecord(value) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex')
}

export function reconcileIdempotencyLedger(existingEntries, incomingEntries) {
  const byRecord = new Map(existingEntries.map((entry) => [`${entry.kind}:${entry.sourceId}`, entry]))
  const incomingIds = new Set()
  const inserted = []
  let identicalNoops = 0
  let conflicts = 0
  for (const entry of incomingEntries) {
    const identity = `${entry.kind}:${entry.sourceId}`
    if (incomingIds.has(identity)) throw new Error(`IMPORT_LEDGER_DUPLICATE_ID:${identity}`)
    incomingIds.add(identity)
    const prior = byRecord.get(identity)
    if (!prior) {
      byRecord.set(identity, entry)
      inserted.push(entry)
      continue
    }
    if (prior.sourceIdentity === entry.sourceIdentity && prior.sourceDigest === entry.sourceDigest
      && prior.idempotencyKey === entry.idempotencyKey) {
      identicalNoops++
      continue
    }
    conflicts++
    throw new Error(`IMPORT_LEDGER_SOURCE_CONFLICT:${identity}`)
  }
  return { entries: [...byRecord.values()], inserted: inserted.length, identicalNoops, conflicts }
}

function ledgerEntry(kind, sourceIdentity, sourceId, sourceDigest) {
  const idempotencyKey = digestRecord({ kind, sourceIdentity, sourceId, sourceDigest })
  return { kind, sourceIdentity, sourceId, sourceDigest, idempotencyKey }
}

function restoredPriceFields(product) {
  const priceSource = PRICE_SOURCES[product.price_provenance]
  if (product.price === null) {
    return {
      price: null,
      original_price: null,
      list_price: null,
      sale_price: null,
      online_discount_amount: null,
      price_display: 'Liên hệ báo giá',
      price_source: 'unknown',
      price_state: 'unknown',
      price_confidence: 'low',
      price_updated_at: null,
      source_system: 'legacy-public-snapshot',
      is_promotion: false,
    }
  }
  if (!priceSource) throw new Error(`PRODUCT_PRICE_PROVENANCE_UNSUPPORTED:${product.id}`)
  const value = {
    price: product.price,
    original_price: product.original_price,
    list_price: product.list_price,
    sale_price: product.sale_price,
    online_discount_amount: product.online_discount_amount,
    final_online_price: product.final_online_price,
    price_display: product.price_display,
    is_promotion: product.is_promotion,
    price_provenance: product.price_provenance,
  }
  if (!isRestoredPublicPricing(value)) throw new Error(`PRODUCT_PRICE_FIELDS_INVALID:${product.id}`)
  return {
    price: product.price,
    original_price: product.original_price,
    list_price: product.list_price,
    sale_price: product.sale_price,
    online_discount_amount: product.online_discount_amount,
    price_display: null,
    price_source: priceSource.source,
    price_state: 'historical_snapshot',
    price_confidence: 'high',
    price_updated_at: new Date(`${priceSource.updatedAt}T00:00:00.000Z`),
    source_system: product.price_provenance,
    is_promotion: product.is_promotion,
  }
}

function productValidationReasons(product, bundle, expectedListingById, subcategorySourceNames) {
  const reasons = []
  if (!product.sku || product.sku.length > 100) reasons.push('SKU_MISSING_OR_TOO_LONG')
  if (!product.name || product.name.length > 500) reasons.push('NAME_MISSING_OR_TOO_LONG')
  if (!product.display_name || product.display_name.length > 500) reasons.push('DISPLAY_NAME_MISSING_OR_TOO_LONG')
  if (!product.image_main_url || safeImage(product.image_main_url) !== product.image_main_url) reasons.push('MAIN_MEDIA_URL_UNSAFE_OR_MISSING')
  if (!product.publicContent || !isSafePublicContent(product.publicContent)) reasons.push('PUBLIC_CONTENT_UNSAFE_OR_INCOMPLETE')
  const category = bundle.manifest.categories.find((entry) => entry.slug === product.categories.slug)
  const listing = category?.listings.find((entry) => entry.slug === product.subcategories.slug)
  if (!category || !listing || !product.categories.name || !product.subcategories.name) reasons.push('TAXONOMY_NAME_OR_SLUG_UNRESOLVED')
  if (category && !taxonomyNameMatches(category.slug, category.name, product.categories.name)) reasons.push('CATEGORY_SOURCE_NAME_MISMATCH')
  if (listing && !taxonomyNameMatches(`${category.slug}/${listing.slug}`, listing.name, product.subcategories.name)) {
    reasons.push('SUBCATEGORY_SOURCE_NAME_MISMATCH')
  }
  const sourceNames = subcategorySourceNames.get(`${product.categories.slug}/${product.subcategories.slug}`)
  if (!sourceNames?.has(product.subcategories.name)) reasons.push('SUBCATEGORY_SOURCE_NAME_MISSING')
  const expectedListing = expectedListingById.has(product.id) ? expectedListingById.get(product.id) : null
  if (expectedListing && expectedListing !== `${product.categories.slug}/${product.subcategories.slug}`) reasons.push('LISTING_MEMBERSHIP_MISMATCH')
  if (product.brands && (!product.brands.slug || !product.brands.name || product.brands.name.length > 200)) reasons.push('BRAND_IDENTITY_INCOMPLETE')
  if (product.price !== null && !PRICE_SOURCES[product.price_provenance]) reasons.push('PRICE_PROVENANCE_UNSUPPORTED')
  return reasons
}

export function buildRecoveryImportPlan(bundle, blogArchive, blogArchiveBytes) {
  const expectedListingById = new Map()
  for (const page of bundle.listingPages) {
    for (const item of page.products) expectedListingById.set(item.id, `${page.categorySlug}/${page.listingSlug}`)
  }

  const categories = bundle.manifest.categories.map(({ slug, name }) => ({ slug, name }))
  const subcategorySourceNames = new Map()
  for (const product of bundle.products) {
    const key = `${product.categories.slug}/${product.subcategories.slug}`
    if (!subcategorySourceNames.has(key)) subcategorySourceNames.set(key, new Set())
    subcategorySourceNames.get(key).add(product.subcategories.name)
  }
  const subcategories = bundle.manifest.categories.flatMap((category) => category.listings.map((listing) => ({
    categorySlug: category.slug,
    name: listing.name,
    slug: listing.slug,
    thumbnail_url: listing.thumbnail_url ? safeImage(listing.thumbnail_url) : null,
    sourceNames: [...(subcategorySourceNames.get(`${category.slug}/${listing.slug}`) ?? [])].sort(),
    publicDisplayName: listing.name,
  })))
  const brandMap = new Map()
  const products = []
  const quarantinedProducts = []
  for (const product of bundle.products) {
    const reasons = productValidationReasons(product, bundle, expectedListingById, subcategorySourceNames)
    if (reasons.length) {
      quarantinedProducts.push({ id: product.id, sku: product.sku ?? null, url: product.url, reasons })
      continue
    }
    if (product.brands) {
      const prior = brandMap.get(product.brands.slug)
      if (prior && prior.name !== product.brands.name) {
        quarantinedProducts.push({ id: product.id, sku: product.sku, url: product.url, reasons: ['BRAND_SLUG_NAME_CONFLICT'] })
        continue
      }
      brandMap.set(product.brands.slug, { name: product.brands.name, slug: product.brands.slug })
    }
    const price = restoredPriceFields(product)
    const data = {
      id: product.id,
      sku: product.sku,
      name: product.name,
      display_name: product.display_name,
      slug: product.slug,
      price: price.price,
      original_price: price.original_price,
      list_price: price.list_price,
      sale_price: price.sale_price,
      online_discount_amount: price.online_discount_amount,
      price_display: price.price_display,
      price_source: price.price_source,
      price_state: price.price_state,
      price_confidence: price.price_confidence,
      price_updated_at: price.price_updated_at,
      source_system: price.source_system,
      is_promotion: price.is_promotion,
      stock_status: 'contact',
      sellable_status: 'contact',
      sale_status: 'contact',
      is_active: product.is_active,
      is_featured: product.is_featured,
      image_main_url: product.image_main_url,
      description: product.publicContent.summary,
      specs: product.publicContent.specifications,
      variant_group: product.variant_group ?? null,
      variant_type: product.variant_type ?? null,
      variant_label: product.variant_label ?? null,
      listing_visibility: expectedListingById.has(product.id) ? 'default' : 'hidden',
      pdp_visibility: 'public',
      search_visibility: bundle.searchIds.has(product.id) ? 'visible' : 'hidden',
      seo_indexing: bundle.sitemapIds.has(product.id) ? 'index' : 'noindex',
      sitemap_include: bundle.sitemapIds.has(product.id),
    }
    const identity = {
      sourceIdentity: `${bundle.manifest.checkpoint}:${bundle.manifestSha256}:${bundle.manifest.m3CodeSha}:${bundle.manifest.m3RunId}`,
      sourceId: product.id,
      canonicalUrl: product.url,
      data,
    }
    products.push({
      data,
      canonicalUrl: product.url,
      categorySlug: product.categories.slug,
      subcategorySlug: product.subcategories.slug,
      brandSlug: product.brands?.slug ?? null,
      sourceIdentity: identity.sourceIdentity,
      sourceDigest: digestRecord(identity),
      mediaBytesVerified: false,
    })
  }

  const descriptions = products.flatMap((row) => {
    const source = bundle.productById.get(row.data.id).publicContent
    return source.descriptionHtml ? [{ product_id: row.data.id, raw_html: source.descriptionHtml, clean_html: source.descriptionHtml, source: 'legacy-public-snapshot' }] : []
  })
  const images = products.flatMap((row) => bundle.productById.get(row.data.id).publicContent.gallery.map((image_url, sort_order) => ({
    product_id: row.data.id,
    image_url,
    alt_text: null,
    image_type: 'gallery',
    sort_order,
  })))
  const documents = products.flatMap((row) => bundle.productById.get(row.data.id).publicContent.documents.map((document, sort_order) => ({
    product_id: row.data.id,
    name: document.name,
    url: document.url,
    document_type: document.type.slice(0, 30),
    sort_order,
  })))

  const blog = reconcileBlogArchive(blogArchive)
  const blogCategories = blog.categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    thumbnail_url: category.thumbnail_url,
    is_active: category.is_active,
    sort_order: category.sort_order,
    seo_title: category.seo_title,
    seo_description: category.seo_description,
  }))
  const blogPosts = blog.published.map((post) => {
    const data = {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    content: post.content,
    category_id: post.category_id,
    thumbnail_url: post.thumbnail_url,
    cover_image_url: post.cover_image_url,
    seo_title: post.seo_title,
    seo_description: post.seo_description,
    seo_keywords: post.seo_keywords,
    reading_time: post.reading_time,
    view_count: post.view_count,
    status: post.status,
    published_at: new Date(post.published_at),
    author_name: post.author_name,
    author_avatar: post.author_avatar,
    is_featured: post.is_featured,
    is_pinned: post.is_pinned,
    created_at: new Date(post.created_at),
    updated_at: new Date(post.updated_at),
    }
    const sourceBodyMd5 = post.content_md5
    const canonicalUrl = `/blog/${post.category.slug}/${post.slug}`
    const sourceIdentity = `${blogArchive.source_project}:${blogArchive.snapshot_date}:${blogArchive.source_backup?.manifest_sha256 ?? 'archive'}`
    return {
      data,
      sourceIdentity,
      sourceBodyMd5,
      canonicalUrl,
      mediaBytesVerified: false,
      sourceDigest: digestRecord({ sourceIdentity, sourceId: post.id, sourceBodyMd5, canonicalUrl, data }),
    }
  })

  const idempotencyLedger = [
    ...products.map((product) => ledgerEntry('product', product.sourceIdentity, product.data.id, product.sourceDigest)),
    ...blogPosts.map((post) => ledgerEntry('blog_post', post.sourceIdentity, post.data.id, post.sourceDigest)),
  ]

  const productContentWithColors = products.filter((row) => bundle.productById.get(row.data.id).colors).length
  const productContentWithCardFeatures = products.filter((row) => bundle.productById.get(row.data.id).product_feature_values?.length).length
  const variantMembers = products.filter((row) => row.data.variant_group)
  const quarantineVariantGroups = [...new Set(variantMembers.map((row) => row.data.variant_group))].map((group) => ({
    group,
    productIds: variantMembers.filter((row) => row.data.variant_group === group).map((row) => row.data.id),
    reason: 'LEGACY_GROUP_AXES_NOT_PRESENT_IN_PUBLIC_PROJECTION',
  }))

  return {
    source: {
      checkpoint: bundle.manifest.checkpoint,
      m3CodeSha: bundle.manifest.m3CodeSha,
      m3RunId: String(bundle.manifest.m3RunId),
      manifestSha256: sha256(bundle.manifestBytes),
      blogArchiveSha256: sha256(blogArchiveBytes),
      mediaBytesVerified: false,
    },
    categories,
    subcategories,
    brands: [...brandMap.values()].sort((a, b) => a.slug.localeCompare(b.slug)),
    products,
    productDescriptions: descriptions,
    productImages: images,
    productDocuments: documents,
    blogCategories,
    blogPosts,
    idempotencyLedger,
    quarantinedProducts,
    quarantinedBlogPosts: blog.quarantined,
    quarantinedVariantGroups: quarantineVariantGroups,
    schemaGaps: {
      categoryIdsAbsentFromPublicSnapshot: categories.length,
      subcategoryIdsAbsentFromPublicSnapshot: subcategories.length,
      brandIdsAbsentFromPublicSnapshot: brandMap.size,
      productColorsNotMappedToLegacyColorRows: productContentWithColors,
      productCardFeaturesNotMappedToFeatureRows: productContentWithCardFeatures,
      variantGroupsWithoutSourceAxes: quarantineVariantGroups.length,
      variantProductsWithoutPersistedGroupRelation: variantMembers.length,
      publicProductUrlsReconstructedFromSlugTaxonomy: products.length,
      productDescriptionBlocksNotStoredAsSeparateRows: bundle.stats.descriptionBlocks,
      subcategoryNameCaseOnlyReconciliations: [...subcategorySourceNames.entries()]
        .filter(([key, names]) => {
          const [categorySlug, subcategorySlug] = key.split('/')
          const listing = bundle.manifest.categories.find((category) => category.slug === categorySlug)?.listings
            .find((entry) => entry.slug === subcategorySlug)
          return listing && [...names].some((name) => name !== listing.name)
        }).length,
      subcategorySlugsWithMultipleProductSourceNames: [...subcategorySourceNames.values()].filter((names) => names.size > 1).length,
      publicListingNamesDifferentFromProductSourceNames: subcategories.filter((row) => row.sourceNames.some((name) => name !== row.publicDisplayName)).length,
      knownLavaboPublicLabelAliasProducts: bundle.products.filter((product) => product.categories.slug === 'thiet-bi-ve-sinh'
        && product.subcategories.slug === 'lavabo' && product.subcategories.name === 'Lavabo').length,
    },
    counts: {
      publicProducts: bundle.products.length,
      importableProducts: products.length,
      quarantinedProducts: quarantinedProducts.length,
      rootCategories: categories.length,
      subcategories: subcategories.length,
      brands: brandMap.size,
      listingProducts: bundle.listingCount,
      searchProducts: bundle.searchCount,
      pricedHistoricalProducts: products.filter((product) => product.data.price !== null).length,
      unknownPriceProducts: products.filter((product) => product.data.price === null).length,
      variantProducts: variantMembers.length,
      variantGroups: quarantineVariantGroups.length,
      productDescriptions: descriptions.length,
      galleryImages: images.length,
      productDocuments: documents.length,
      blogCategories: blogCategories.length,
      publishedBlogPosts: blogPosts.length,
      quarantinedBlogPosts: blog.quarantined.length,
    },
  }
}

export function reconcileBlogArchive(archive) {
  if (!archive || archive.contract !== 'dpg:verified-legacy-blog-snapshot:v1'
    || !Array.isArray(archive.categories) || !Array.isArray(archive.posts)) throw new Error('BLOG_ARCHIVE_CONTRACT_INVALID')
  const categories = new Map()
  const categorySlugs = new Set()
  for (const category of archive.categories) {
    if (!Number.isSafeInteger(category.id) || category.id < 1 || !category.name
      || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category.slug)
      || categories.has(category.id) || categorySlugs.has(category.slug)) throw new Error('BLOG_CATEGORY_IDENTITY_INVALID')
    categories.set(category.id, category)
    categorySlugs.add(category.slug)
  }
  const ids = new Set()
  const slugs = new Set()
  const published = []
  const quarantined = []
  for (const post of archive.posts) {
    if (!Number.isSafeInteger(post.id) || post.id < 1 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug)
      || ids.has(post.id) || slugs.has(post.slug)) throw new Error('BLOG_POST_IDENTITY_INVALID')
    ids.add(post.id)
    slugs.add(post.slug)
    if (post.status !== 'published' || !post.published_at) continue
    if (!categories.has(post.category_id)) {
      quarantined.push({ id: post.id, slug: post.slug, reason: 'BLOG_CATEGORY_MISSING' })
      continue
    }
    if (typeof post.content !== 'string' || !post.content.trim()) {
      quarantined.push({ id: post.id, slug: post.slug, reason: 'BLOG_BODY_MISSING' })
      continue
    }
    const digest = createHash('md5').update(post.content).digest('hex')
    if (digest !== post.content_md5) {
      quarantined.push({ id: post.id, slug: post.slug, reason: 'BLOG_BODY_DIGEST_MISMATCH' })
      continue
    }
    published.push({ ...post, category: categories.get(post.category_id) })
  }
  return { categories: archive.categories, published, quarantined }
}
