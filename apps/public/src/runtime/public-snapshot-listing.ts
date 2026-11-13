declare const __DPG_BUILD_SOURCE_SHA__: string
import { getSnapshotProducts, readSnapshotManifest } from './public-snapshot-catalogue'
import { publicPostgresEnabled } from './public-db'
import { getLiveListing } from './live-public-catalogue'
import { publicSnapshotCheckpoint } from './public-snapshot-mode'
import {
    isPublicSnapshotListingProduct,
    PUBLIC_SNAPSHOT_LISTING_CONTRACT,
    PUBLIC_SNAPSHOT_LISTING_MAX_PAGES,
    PUBLIC_SNAPSHOT_LISTING_PAGE_SIZE,
    type PublicSnapshotListingShard,
    type PublicSnapshotListingProduct,
} from './snapshot-listing-contract'

const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export async function getPublicSnapshotListingShard(
    category: string,
    listing: string,
    page = 1,
): Promise<PublicSnapshotListingShard | null> {
    if (!SAFE_SLUG.test(category) || !SAFE_SLUG.test(listing) || !Number.isSafeInteger(page) || page < 1) return null

    if (publicPostgresEnabled()) {
        const live = await getLiveListing(category, listing, page)
        if (live.totalCount === 0) return null
        const totalPages = Math.ceil(live.totalCount / PUBLIC_SNAPSHOT_LISTING_PAGE_SIZE)
        if (totalPages > PUBLIC_SNAPSHOT_LISTING_MAX_PAGES) {
            throw new Error('PUBLIC_DATABASE_LISTING_TOO_LARGE')
        }
        if (page > totalPages) return null
        const checkpoint = publicSnapshotCheckpoint()
            ?? (typeof __DPG_BUILD_SOURCE_SHA__ === 'undefined' ? '' : __DPG_BUILD_SOURCE_SHA__)
        if (!/^[a-f0-9]{40}$/.test(checkpoint)) {
            throw new Error('PUBLIC_DATABASE_SOURCE_ID_REQUIRED')
        }
        const products: PublicSnapshotListingProduct[] = live.products.map(p => ({
            id: p.id, name: p.name, display_name: p.display_name,
            slug: p.slug, sku: p.sku, price: p.price, price_display: p.price_display,
            stock_status: p.stock_status, image_main_url: p.image_main_url,
            is_active: p.is_active, is_featured: p.is_featured,
            is_promotion: p.is_promotion, variant_options: [],
            categories: p.categories, subcategories: p.subcategories,
            brands: p.brands,
            canonical_category_slug: p.canonical_category_slug,
            canonical_subcategory_slug: p.canonical_subcategory_slug,
            url: p.url,
        }))
        if (products.some(p => !isPublicSnapshotListingProduct(p, category, listing))) {
            throw new Error('PUBLIC_DATABASE_LISTING_INVALID')
        }
        return {
            contract: PUBLIC_SNAPSHOT_LISTING_CONTRACT,
            checkpoint, categorySlug: category, listingSlug: listing,
            page, pageSize: PUBLIC_SNAPSHOT_LISTING_PAGE_SIZE,
            totalCount: live.totalCount, totalPages, products,
        }
    }
    const manifest = await readSnapshotManifest()
    if (!Array.isArray(manifest.categories)) throw new Error('PUBLIC_CATALOGUE_UNAVAILABLE')
    const categoryRecord = manifest.categories.find((value) => value.slug === category)
    if (!categoryRecord) return null
    if (!Array.isArray(categoryRecord.listings)) throw new Error('PUBLIC_CATALOGUE_UNAVAILABLE')
    const listingRecord = categoryRecord.listings.find((value) => value.slug === listing)
    if (!listingRecord) return null

    if (!Number.isSafeInteger(listingRecord.totalCount) || listingRecord.totalCount < 1
        || Math.ceil(listingRecord.totalCount / PUBLIC_SNAPSHOT_LISTING_PAGE_SIZE) > PUBLIC_SNAPSHOT_LISTING_MAX_PAGES) {
        throw new Error('PUBLIC_CATALOGUE_UNAVAILABLE')
    }
    const totalPages = Math.ceil(listingRecord.totalCount / PUBLIC_SNAPSHOT_LISTING_PAGE_SIZE)
    if (page > totalPages) return null

    const checkpoint = manifest.checkpoint
    if (!/^[a-f0-9]{40}$/.test(checkpoint)
        || (process.env.PUBLIC_CATALOGUE_SOURCE !== 'production-published-snapshot'
            && checkpoint !== publicSnapshotCheckpoint())) throw new Error('PUBLIC_CATALOGUE_UNAVAILABLE')
    const source = await getSnapshotProducts(category, listing, page)
    const expectedProducts = Math.min(
        PUBLIC_SNAPSHOT_LISTING_PAGE_SIZE,
        listingRecord.totalCount - (page - 1) * PUBLIC_SNAPSHOT_LISTING_PAGE_SIZE,
    )
    // Product buckets retain audited variant metadata for PDP selection. Listing
    // shards use the narrower public card DTO; validate that the source carries
    // only those known fields before projecting it.
    const listingKeys = new Set([
        'id', 'name', 'display_name', 'slug', 'sku', 'price', 'price_display',
        'stock_status', 'image_main_url', 'is_active', 'is_featured',
        'is_promotion', 'variant_options', 'categories', 'subcategories',
        'brands', 'canonical_category_slug', 'canonical_subcategory_slug',
        'url', 'variant_group', 'variant_type', 'variant_label',
        'original_price', 'list_price', 'sale_price', 'online_discount_amount',
        'final_online_price', 'price_provenance',
        'product_feature_values', 'colors',
    ])
    const products = source.products.map((product) => ({
        id: product.id, name: product.name, display_name: product.display_name,
        slug: product.slug, sku: product.sku, price: product.price,
        price_display: product.price_display,
        ...(Object.hasOwn(product,'price_provenance')?{
            original_price:product.original_price??null,list_price:product.list_price??null,
            sale_price:product.sale_price??null,online_discount_amount:product.online_discount_amount??null,
            final_online_price:product.final_online_price??null,price_provenance:product.price_provenance??null,
        }:{}),
        ...(Object.hasOwn(product,'product_feature_values')?{
            product_feature_values:product.product_feature_values??[],colors:product.colors??null,
        }:{}),
        stock_status: 'contact' as const, image_main_url: product.image_main_url,
        is_active: true as const, is_featured: product.is_featured,
        is_promotion: product.is_promotion, variant_options: [] as [],
        categories: product.categories, subcategories: product.subcategories,
        brands: product.brands,
        canonical_category_slug: product.canonical_category_slug,
        canonical_subcategory_slug: product.canonical_subcategory_slug,
        url: product.url,
    }))
    if (source.totalCount !== listingRecord.totalCount || source.page !== page
        || source.products.length !== expectedProducts
        || source.products.some((product) => Object.keys(product).some((key) => !listingKeys.has(key))
            || product.stock_status !== 'contact'
            || product.is_active !== true
            || !Array.isArray(product.variant_options) || product.variant_options.length !== 0)
        || products.some((product) => !isPublicSnapshotListingProduct(product, category, listing))) {
        throw new Error('PUBLIC_CATALOGUE_UNAVAILABLE')
    }

    return {
        contract: PUBLIC_SNAPSHOT_LISTING_CONTRACT,
        checkpoint,
        categorySlug: category,
        listingSlug: listing,
        page,
        pageSize: PUBLIC_SNAPSHOT_LISTING_PAGE_SIZE,
        totalCount: listingRecord.totalCount,
        totalPages,
        products,
    }
}
