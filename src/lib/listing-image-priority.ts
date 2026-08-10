export const MOBILE_LISTING_PRIORITY_CARD_COUNT = 2
export const LISTING_PRODUCT_IMAGE_SIZES =
    '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw'

type ListingImageProduct = {
    image_main_url?: string | null
    thumbnail?: string | null
    images?: string | null
}

export function shouldPrioritizeListingCard(index: number): boolean {
    return Number.isInteger(index) && index >= 0 && index < MOBILE_LISTING_PRIORITY_CARD_COUNT
}

function getListingImageSource(product: ListingImageProduct): string | null {
    if (product.image_main_url) return product.image_main_url
    if (product.thumbnail) return product.thumbnail

    if (!product.images) return null

    try {
        const images = JSON.parse(product.images) as unknown
        return Array.isArray(images) && typeof images[0] === 'string' ? images[0] : null
    } catch {
        return null
    }
}

export function getAboveFoldListingImageSources(
    products: ListingImageProduct[],
): string[] {
    const sources = new Set<string>()

    for (const product of products.slice(0, MOBILE_LISTING_PRIORITY_CARD_COUNT)) {
        const source = getListingImageSource(product)
        if (source) sources.add(source)
    }

    return [...sources]
}
