import { publicSnapshotCheckpoint } from './public-snapshot-mode'
import { getSnapshotProducts, readSnapshotManifest } from './public-snapshot-catalogue'
import {
    isPublicSnapshotListingProduct,
    PUBLIC_SNAPSHOT_LISTING_CONTRACT,
    PUBLIC_SNAPSHOT_LISTING_MAX_PAGES,
    PUBLIC_SNAPSHOT_LISTING_PAGE_SIZE,
    type PublicSnapshotListingShard,
} from './snapshot-listing-contract'

const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export async function getPublicSnapshotListingShard(
    category: string,
    listing: string,
    page = 1,
): Promise<PublicSnapshotListingShard | null> {
    if (!SAFE_SLUG.test(category) || !SAFE_SLUG.test(listing) || !Number.isSafeInteger(page) || page < 1) return null

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

    const checkpoint = publicSnapshotCheckpoint()
    if (!checkpoint) throw new Error('PUBLIC_CATALOGUE_UNAVAILABLE')
    const source = await getSnapshotProducts(category, listing, page)
    const expectedProducts = Math.min(
        PUBLIC_SNAPSHOT_LISTING_PAGE_SIZE,
        listingRecord.totalCount - (page - 1) * PUBLIC_SNAPSHOT_LISTING_PAGE_SIZE,
    )
    if (source.totalCount !== listingRecord.totalCount || source.page !== page
        || source.products.length !== expectedProducts
        || source.products.some((product) => !isPublicSnapshotListingProduct(product, category, listing))) {
        throw new Error('PUBLIC_CATALOGUE_UNAVAILABLE')
    }

    const products = source.products.map((product) => ({
        id: product.id,
        name: product.name,
        display_name: product.display_name,
        slug: product.slug,
        sku: product.sku,
        price: null,
        price_display: 'Liên hệ báo giá' as const,
        stock_status: 'contact' as const,
        image_main_url: product.image_main_url,
        is_active: true as const,
        is_featured: product.is_featured,
        is_promotion: false as const,
        variant_options: [] as [],
        categories: product.categories,
        subcategories: product.subcategories,
        brands: product.brands,
        canonical_category_slug: product.canonical_category_slug,
        canonical_subcategory_slug: product.canonical_subcategory_slug,
        url: product.url,
    }))

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
