export const PUBLIC_SNAPSHOT_LISTING_CONTRACT = 'dpg:public-catalogue-listing-shard:v1'
export const PUBLIC_SNAPSHOT_LISTING_PAGE_SIZE = 48
export const PUBLIC_SNAPSHOT_LISTING_MAX_PAGES = 64
export const PUBLIC_SNAPSHOT_LISTING_MAX_BRANDS = 32

const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SAFE_CHECKPOINT = /^[a-f0-9]{40}$/
const PUBLIC_IMAGE_HOSTS = new Set([
    'dpg-products.b-cdn.net',
    'cdn.dongphugia.com.vn',
    'cdn.hita.com.vn',
    'hita.com.vn',
    'vietceramics.com',
    'tygjmrhandbffjllxveu.supabase.co',
])

export type PublicSnapshotListingProduct = {
    id: number
    name: string
    display_name: string
    slug: string
    sku: string
    price: null
    price_display: 'Liên hệ báo giá'
    stock_status: 'contact'
    image_main_url: string | null
    is_active: true
    is_featured: boolean
    is_promotion: false
    variant_options: []
    categories: { name: string; slug: string }
    subcategories: { name: string; slug: string }
    brands: { name: string; slug: string } | null
    canonical_category_slug: string
    canonical_subcategory_slug: string
    url: string
}

export type PublicSnapshotListingShard = {
    contract: typeof PUBLIC_SNAPSHOT_LISTING_CONTRACT
    checkpoint: string
    categorySlug: string
    listingSlug: string
    page: number
    pageSize: typeof PUBLIC_SNAPSHOT_LISTING_PAGE_SIZE
    totalCount: number
    totalPages: number
    products: PublicSnapshotListingProduct[]
}

export type PublicSnapshotListingFilters = {
    brands: string[]
    featured: boolean
    page: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isSafeText(value: unknown, maxLength = 240): value is string {
    return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]) {
    const keys = Object.keys(value)
    return keys.length === expected.length && keys.every((key) => expected.includes(key))
}

function isSafeImage(value: unknown): value is string | null {
    if (value === null) return true
    if (typeof value !== 'string' || value.length > 2048) return false
    if (/^\/images\/[A-Za-z0-9_./-]+$/.test(value) && !value.includes('..')) return true

    try {
        const url = new URL(value)
        return url.protocol === 'https:'
            && !url.username
            && !url.password
            && !url.search
            && !url.hash
            && PUBLIC_IMAGE_HOSTS.has(url.hostname)
            && (!url.hostname.endsWith('.supabase.co') || url.pathname.startsWith('/storage/v1/object/public/'))
    } catch {
        return false
    }
}

export function isPublicSnapshotListingProduct(
    value: unknown,
    categorySlug?: string,
    listingSlug?: string,
): value is PublicSnapshotListingProduct {
    if (!isRecord(value)) return false
    if (!hasExactKeys(value, [
        'id', 'name', 'display_name', 'slug', 'sku', 'price', 'price_display', 'stock_status',
        'image_main_url', 'is_active', 'is_featured', 'is_promotion', 'variant_options',
        'categories', 'subcategories', 'brands', 'canonical_category_slug',
        'canonical_subcategory_slug', 'url',
    ])) return false
    if (!Number.isSafeInteger(value.id) || (value.id as number) <= 0
        || !isSafeText(value.name) || !isSafeText(value.display_name)
        || typeof value.slug !== 'string' || !SAFE_SLUG.test(value.slug)
        || typeof value.sku !== 'string' || value.sku.length > 120
        || value.price !== null || value.price_display !== 'Liên hệ báo giá'
        || value.stock_status !== 'contact' || !isSafeImage(value.image_main_url)
        || value.is_active !== true || typeof value.is_featured !== 'boolean'
        || value.is_promotion !== false || !Array.isArray(value.variant_options)
        || value.variant_options.length !== 0) return false

    if (!isRecord(value.categories) || !hasExactKeys(value.categories, ['name', 'slug'])
        || !isSafeText(value.categories.name)
        || typeof value.categories.slug !== 'string' || !SAFE_SLUG.test(value.categories.slug)
        || !isRecord(value.subcategories) || !hasExactKeys(value.subcategories, ['name', 'slug'])
        || !isSafeText(value.subcategories.name)
        || typeof value.subcategories.slug !== 'string' || !SAFE_SLUG.test(value.subcategories.slug)
        || (value.brands !== null && (!isRecord(value.brands)
            || !hasExactKeys(value.brands, ['name', 'slug'])
            || !isSafeText(value.brands.name)
            || typeof value.brands.slug !== 'string'
            || !SAFE_SLUG.test(value.brands.slug)))) return false

    const canonicalCategory = categorySlug ?? value.categories.slug
    const canonicalListing = listingSlug ?? value.subcategories.slug
    return value.categories.slug === canonicalCategory
        && value.subcategories.slug === canonicalListing
        && value.canonical_category_slug === canonicalCategory
        && value.canonical_subcategory_slug === canonicalListing
        && value.url === `/${canonicalCategory}/${canonicalListing}/${value.slug}`
}

export function isPublicSnapshotListingShard(
    value: unknown,
    expected?: { categorySlug?: string; listingSlug?: string; page?: number; checkpoint?: string },
): value is PublicSnapshotListingShard {
    if (!isRecord(value)) return false
    if (!hasExactKeys(value, [
        'contract', 'checkpoint', 'categorySlug', 'listingSlug', 'page', 'pageSize',
        'totalCount', 'totalPages', 'products',
    ])) return false
    const categorySlug = value.categorySlug
    const listingSlug = value.listingSlug
    const page = value.page
    const totalCount = value.totalCount
    const totalPages = value.totalPages
    if (value.contract !== PUBLIC_SNAPSHOT_LISTING_CONTRACT
        || typeof value.checkpoint !== 'string' || !SAFE_CHECKPOINT.test(value.checkpoint)
        || typeof categorySlug !== 'string' || !SAFE_SLUG.test(categorySlug)
        || typeof listingSlug !== 'string' || !SAFE_SLUG.test(listingSlug)
        || !Number.isSafeInteger(page) || (page as number) < 1
        || value.pageSize !== PUBLIC_SNAPSHOT_LISTING_PAGE_SIZE
        || !Number.isSafeInteger(totalCount) || (totalCount as number) < 1
        || (totalCount as number) > PUBLIC_SNAPSHOT_LISTING_PAGE_SIZE * PUBLIC_SNAPSHOT_LISTING_MAX_PAGES
        || !Number.isSafeInteger(totalPages)
        || totalPages !== Math.ceil((totalCount as number) / PUBLIC_SNAPSHOT_LISTING_PAGE_SIZE)
        || (totalPages as number) > PUBLIC_SNAPSHOT_LISTING_MAX_PAGES
        || (page as number) > (totalPages as number)
        || !Array.isArray(value.products)) return false

    if ((expected?.categorySlug && categorySlug !== expected.categorySlug)
        || (expected?.listingSlug && listingSlug !== expected.listingSlug)
        || (expected?.page && page !== expected.page)
        || (expected?.checkpoint && value.checkpoint !== expected.checkpoint)) return false

    const expectedProductCount = Math.min(
        PUBLIC_SNAPSHOT_LISTING_PAGE_SIZE,
        (totalCount as number) - ((page as number) - 1) * PUBLIC_SNAPSHOT_LISTING_PAGE_SIZE,
    )
    return value.products.length === expectedProductCount
        && value.products.every((product) => isPublicSnapshotListingProduct(product, categorySlug, listingSlug))
}

export function parsePublicSnapshotListingFilters(search: URLSearchParams): PublicSnapshotListingFilters | null {
    const allowed = new Set(['brand', 'is_featured', 'page', 'fbclid', 'gclid'])
    for (const key of search.keys()) {
        if (!allowed.has(key) && !key.startsWith('utm_')) return null
    }

    const brandValues = search.getAll('brand')
    if (brandValues.length > 1) return null
    const brands = brandValues.length === 0
        ? []
        : brandValues[0].split(',')
    if (brands.length > PUBLIC_SNAPSHOT_LISTING_MAX_BRANDS
        || brands.some((brand) => !SAFE_SLUG.test(brand))
        || new Set(brands).size !== brands.length) return null

    const featuredValues = search.getAll('is_featured')
    if (featuredValues.length > 1 || (featuredValues.length === 1 && featuredValues[0] !== 'true')) return null

    const pageValues = search.getAll('page')
    if (pageValues.length > 1) return null
    const pageText = pageValues[0] ?? '1'
    if (!/^[1-9][0-9]{0,3}$/.test(pageText)) return null

    return { brands, featured: featuredValues.length === 1, page: Number(pageText) }
}

export function filterPublicSnapshotListing(
    products: readonly PublicSnapshotListingProduct[],
    filters: PublicSnapshotListingFilters,
    pageSize: 12 | 24,
) {
    const brands = new Set(filters.brands)
    const filtered = products.filter((product) =>
        (brands.size === 0 || (product.brands !== null && brands.has(product.brands.slug)))
        && (!filters.featured || product.is_featured),
    )
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
    const pageInRange = filters.page <= totalPages
    return {
        products: pageInRange ? filtered.slice((filters.page - 1) * pageSize, filters.page * pageSize) : [],
        total: filtered.length,
        totalPages,
        page: filters.page,
        pageSize,
        pageInRange,
    }
}
