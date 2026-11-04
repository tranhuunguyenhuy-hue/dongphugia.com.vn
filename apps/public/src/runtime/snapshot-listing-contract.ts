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
    price: number | null
    price_display: string | null
    original_price?: number | null
    list_price?: number | null
    sale_price?: number | null
    online_discount_amount?: number | null
    final_online_price?: number | null
    price_provenance?: string | null
    stock_status: 'contact'
    image_main_url: string | null
    is_active: true
    is_featured: boolean
    is_promotion: boolean
    variant_options: []
    product_feature_values?: {product_features:{name:string}}[]
    colors?: {name:string;hex_code:string|null}|null
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
    sort?: 'default' | 'price-asc' | 'price-desc'
    priceRange?: readonly [number,number]
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

const RESTORED_PRICE_KEYS=['original_price','list_price','sale_price','online_discount_amount','final_online_price','price_provenance'] as const
function validMoney(value:unknown){return Number.isSafeInteger(value)&&typeof value==='number'&&value>0&&value<=1_000_000_000}
function isSafeRestoredPrice(value:Record<string,unknown>){
    if(!RESTORED_PRICE_KEYS.every(key=>Object.hasOwn(value,key)))return value.price===null&&value.price_display==='Liên hệ báo giá'&&value.is_promotion===false
    if(value.price===null)return RESTORED_PRICE_KEYS.every(key=>value[key]===null)
        &&value.price_display==='Liên hệ báo giá'&&value.is_promotion===false
    if(!validMoney(value.price)||!validMoney(value.list_price)
        ||(value.original_price===null?value.list_price!==value.price:value.list_price!==value.original_price||!validMoney(value.original_price))
        ||(value.price as number)>(value.list_price as number)
        ||value.sale_price!==((value.price as number)<(value.list_price as number)?value.price:null)
        ||value.is_promotion!==((value.price as number)<(value.list_price as number))
        ||value.price_display!==null
        ||!['legacy-manual-2026-07-02','legacy-hita-pm-approved-2026-11-03'].includes(String(value.price_provenance)))return false
    if(value.online_discount_amount===null)return value.final_online_price===null
    return validMoney(value.online_discount_amount)
        &&(value.online_discount_amount as number)<(value.price as number)
        &&value.final_online_price===(value.price as number)-(value.online_discount_amount as number)
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
        ...(RESTORED_PRICE_KEYS.every(key=>Object.hasOwn(value,key))?RESTORED_PRICE_KEYS:[]),
        ...(Object.hasOwn(value,'product_feature_values')?['product_feature_values','colors']:[]),
    ])) return false
    if (!Number.isSafeInteger(value.id) || (value.id as number) <= 0
        || !isSafeText(value.name) || !isSafeText(value.display_name)
        || typeof value.slug !== 'string' || !SAFE_SLUG.test(value.slug)
        || typeof value.sku !== 'string' || value.sku.length > 120
        || !isSafeRestoredPrice(value)
        || value.stock_status !== 'contact' || !isSafeImage(value.image_main_url)
        || value.is_active !== true || typeof value.is_featured !== 'boolean'
        || typeof value.is_promotion !== 'boolean' || !Array.isArray(value.variant_options)
        || value.variant_options.length !== 0) return false
    if(Object.hasOwn(value,'product_feature_values')&&(!Array.isArray(value.product_feature_values)
        ||value.product_feature_values.length>3
        ||value.product_feature_values.some(item=>!isRecord(item)||!hasExactKeys(item,['product_features'])
            ||!isRecord(item.product_features)||!hasExactKeys(item.product_features,['name'])||!isSafeText(item.product_features.name,80))
        ||(value.colors!==null&&(!isRecord(value.colors)||!hasExactKeys(value.colors,['name','hex_code'])
            ||!isSafeText(value.colors.name,50)
            ||(value.colors.hex_code!==null&&(typeof value.colors.hex_code!=='string'||!/^#[0-9a-fA-F]{6}$/.test(value.colors.hex_code)))))))return false

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
    const allowed = new Set(['brand', 'is_featured', 'page', 'sort', 'price', 'fbclid', 'gclid'])
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
    const sorts=search.getAll('sort')
    if(sorts.length>1||(sorts.length===1&&!['default','price-asc','price-desc'].includes(sorts[0])))return null
    const prices=search.getAll('price')
    if(prices.length>1||(prices.length===1&&!/^\d{1,8}-\d{1,8}$/.test(prices[0])))return null
    const range=prices.length===1?prices[0].split('-').map(Number):null
    if(range&&(range.length!==2||range[0]<0||range[0]>=range[1]||range[1]>50_000_000))return null

    return { brands, featured: featuredValues.length === 1, page: Number(pageText),sort:(sorts[0]??'default') as PublicSnapshotListingFilters['sort'],...(range?{priceRange:range as [number,number]}:{}) }
}

export function filterPublicSnapshotListing(
    products: readonly PublicSnapshotListingProduct[],
    filters: PublicSnapshotListingFilters,
    pageSize: 12 | 24,
) {
    const brands = new Set(filters.brands)
    const filtered = products.filter((product) =>
        (brands.size === 0 || (product.brands !== null && brands.has(product.brands.slug)))
        && (!filters.featured || product.is_featured)
        && (!filters.priceRange || (product.price!==null&&product.price>=filters.priceRange[0]
            &&(filters.priceRange[1]===50_000_000||product.price<=filters.priceRange[1]))),
    )
    if(filters.sort==='price-asc'||filters.sort==='price-desc')filtered.sort((a,b)=>{
        if(a.price===null)return b.price===null?0:1
        if(b.price===null)return -1
        return (filters.sort==='price-asc'?a.price-b.price:b.price-a.price)||a.id-b.id
    })
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
