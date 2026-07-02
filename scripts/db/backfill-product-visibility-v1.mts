import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const execute = process.argv.includes('--execute')

type ProductRow = {
  id: number
  sku: string
  name: string
  is_active: boolean
  is_featured: boolean
  is_master: boolean
  sort_order: number
  stock_status: string
  price: unknown
  original_price: unknown
  online_discount_amount: unknown
  price_display: string | null
  source_url: string | null
  hita_product_id: string | null
  product_type: string | null
  variant_group: string | null
  image_main_url: string | null
  specs: unknown
  description: string | null
  brand: string | null
}

type VisibilityPatch = {
  publication_status: string
  pdp_visibility: string
  listing_visibility: string
  search_visibility: string
  listing_tier: number
  listing_priority: number
  listing_reason: string
  data_quality_score: number
  sale_status: string
  price_state: string
  list_price: unknown
  sale_price: unknown
  price_source: string
  price_confidence: string
  price_updated_at: Date | null
  sellable_status: string
  seo_indexing: string
  sitemap_include: boolean
  source_system: string
  source_confidence: string
  last_crawled_at: Date | null
  crawl_status: string
}

function hasValue(value: unknown) {
  return value !== null && value !== undefined && String(value) !== ''
}

function isHitaMapped(product: ProductRow) {
  return Boolean(product.hita_product_id || product.source_url?.includes('hita.com.vn'))
}

function isContactPrice(product: ProductRow) {
  const text = `${product.price_display || ''} ${product.stock_status || ''}`.toLowerCase()
  return text.includes('liên hệ') || text.includes('lien he') || text.includes('contact')
}

function dataQualityScore(product: ProductRow) {
  let score = 0
  if (product.name) score += 10
  if (product.sku) score += 10
  if (product.image_main_url) score += 20
  if (hasValue(product.price)) score += 20
  if (product.description && product.description.trim().length > 80) score += 15
  const specs = product.specs && typeof product.specs === 'object' ? product.specs as Record<string, unknown> : {}
  if (Object.keys(specs).length > 0) score += 15
  if (isHitaMapped(product)) score += 10
  return Math.min(score, 100)
}

function classify(product: ProductRow): VisibilityPatch {
  const mapped = isHitaMapped(product)
  const qualityScore = dataQualityScore(product)
  const discontinued = product.stock_status === 'discontinued'
  const contact = !hasValue(product.price) && isContactPrice(product)
  const accessory = (product.product_type || '').toLowerCase().includes('phu-kien')
  const variantChild = product.is_master === false
  const hasIdentity = Boolean(product.sku && product.name && (mapped || product.source_url || product.hita_product_id || product.image_main_url))

  let publicationStatus = product.is_active || mapped ? 'public' : 'private'
  let pdpVisibility = publicationStatus === 'public' ? 'public' : 'private'
  let searchVisibility = publicationStatus === 'public' ? 'visible' : 'hidden'
  let seoIndexing = publicationStatus === 'public' ? 'index' : 'noindex'
  let sitemapInclude = publicationStatus === 'public'

  if (!hasIdentity) {
    publicationStatus = 'private'
    pdpVisibility = 'private'
    searchVisibility = 'hidden'
    seoIndexing = 'noindex'
    sitemapInclude = false
  }

  let saleStatus = 'available'
  let priceState = hasValue(product.price) ? 'priced' : 'unknown'
  let sellableStatus = 'sellable'

  if (discontinued) {
    saleStatus = 'discontinued'
    priceState = 'discontinued'
    sellableStatus = 'not_sellable'
  } else if (contact) {
    saleStatus = 'contact_for_price'
    priceState = 'contact'
    sellableStatus = 'quote_only'
  } else if (!hasValue(product.price)) {
    saleStatus = 'updating'
    priceState = 'updating'
    sellableStatus = 'quote_only'
  }

  let listingVisibility = 'default'
  let listingTier = 2
  let listingReason = 'master_product'

  if (product.is_featured || product.sort_order > 0) {
    listingTier = 1
    listingReason = 'strategic'
  } else if (variantChild) {
    listingVisibility = 'search_only'
    listingTier = 3
    listingReason = 'variant_child'
    seoIndexing = 'canonical_to_parent'
    sitemapInclude = false
  } else if (accessory) {
    listingVisibility = 'low_priority'
    listingTier = 3
    listingReason = 'accessory'
  }

  if (saleStatus === 'discontinued') {
    listingVisibility = 'search_only'
    listingTier = 4
    listingReason = 'discontinued'
  } else if (saleStatus === 'contact_for_price' || saleStatus === 'updating') {
    listingVisibility = listingVisibility === 'default' ? 'low_priority' : listingVisibility
    listingTier = Math.max(listingTier, 3)
    listingReason = saleStatus
  }

  if (publicationStatus !== 'public') {
    listingVisibility = 'hidden'
    listingTier = 9
  }

  const listingPriority = product.sort_order > 0 ? product.sort_order : 0
  const priceSource = mapped ? 'hita' : 'manual'

  return {
    publication_status: publicationStatus,
    pdp_visibility: pdpVisibility,
    listing_visibility: listingVisibility,
    search_visibility: searchVisibility,
    listing_tier: listingTier,
    listing_priority: listingPriority,
    listing_reason: listingReason,
    data_quality_score: qualityScore,
    sale_status: saleStatus,
    price_state: priceState,
    list_price: product.original_price,
    sale_price: product.price,
    price_source: priceSource,
    price_confidence: hasValue(product.price) || priceState === 'contact' || priceState === 'discontinued' ? 'high' : 'low',
    price_updated_at: hasValue(product.price) ? new Date() : null,
    sellable_status: sellableStatus,
    seo_indexing: seoIndexing,
    sitemap_include: sitemapInclude,
    source_system: mapped ? 'hita' : 'manual',
    source_confidence: mapped ? 'high' : 'medium',
    last_crawled_at: mapped ? new Date() : null,
    crawl_status: mapped ? 'fresh' : 'unknown',
  }
}

function bump(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) || 0) + 1)
}

async function main() {
  const products = await prisma.products.findMany({
    select: {
      id: true,
      sku: true,
      name: true,
      is_active: true,
      is_featured: true,
      is_master: true,
      sort_order: true,
      stock_status: true,
      price: true,
      original_price: true,
      online_discount_amount: true,
      price_display: true,
      source_url: true,
      hita_product_id: true,
      product_type: true,
      variant_group: true,
      image_main_url: true,
      specs: true,
      description: true,
      brands: { select: { slug: true } },
    },
  })

  const byPublication = new Map<string, number>()
  const byListing = new Map<string, number>()
  const bySale = new Map<string, number>()
  const byPrice = new Map<string, number>()
  const brandRows = new Map<string, Record<string, number>>()

  const patches = products.map((product) => {
    const row = { ...product, brand: product.brands?.slug || null }
    const patch = classify(row)
    bump(byPublication, patch.publication_status)
    bump(byListing, patch.listing_visibility)
    bump(bySale, patch.sale_status)
    bump(byPrice, patch.price_state)
    const brand = row.brand || 'unknown'
    const current = brandRows.get(brand) || { total: 0, public: 0, default: 0, low_priority: 0, search_only: 0, hidden: 0, discontinued: 0 }
    current.total += 1
    if (patch.publication_status === 'public') current.public += 1
    current[patch.listing_visibility] = (current[patch.listing_visibility] || 0) + 1
    if (patch.sale_status === 'discontinued') current.discontinued += 1
    brandRows.set(brand, current)
    return { id: product.id, sku: product.sku, patch }
  })

  console.log(`Mode: ${execute ? 'EXECUTE' : 'DRY-RUN'}`)
  console.log(`Products scanned: ${products.length}`)
  console.table(Object.fromEntries(byPublication))
  console.table(Object.fromEntries(byListing))
  console.table(Object.fromEntries(bySale))
  console.table(Object.fromEntries(byPrice))
  console.table([...brandRows.entries()].map(([brand, row]) => ({ brand, ...row })).sort((a, b) => b.total - a.total).slice(0, 30))

  if (!execute) {
    console.log('Dry-run only. Re-run with --execute to update products.')
    return
  }

  for (const item of patches) {
    await prisma.products.update({
      where: { id: item.id },
      data: item.patch,
    })
  }

  console.log(`Updated products: ${patches.length}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
