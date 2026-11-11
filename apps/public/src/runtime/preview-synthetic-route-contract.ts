export const PREVIEW_SYNTHETIC_CATEGORY_SLUG = 'preview-synthetic'
export const PREVIEW_SYNTHETIC_LISTING_SLUG = 'sku-options'

const SKU_BY_PRODUCT_SLUG: Readonly<Record<string, string>> = Object.freeze({
  'preview-option-a': 'DPG-290-SYN-A',
  'preview-option-b': 'DPG-290-SYN-B',
})

export function expectedPreviewSyntheticSku(productSlug: string) {
  return SKU_BY_PRODUCT_SLUG[productSlug] ?? null
}

export function isPreviewSyntheticCategoryRoute(environment: string, categorySlug: string) {
  return environment !== 'production' && categorySlug === PREVIEW_SYNTHETIC_CATEGORY_SLUG
}

export function isPreviewSyntheticListingRoute(
  environment: string,
  categorySlug: string,
  listingSlug: string,
) {
  return isPreviewSyntheticCategoryRoute(environment, categorySlug)
    && listingSlug === PREVIEW_SYNTHETIC_LISTING_SLUG
}

export function isPreviewSyntheticProductRoute(
  environment: string,
  categorySlug: string,
  listingSlug: string,
  productSlug: string,
) {
  return isPreviewSyntheticListingRoute(environment, categorySlug, listingSlug)
    && expectedPreviewSyntheticSku(productSlug) !== null
}
