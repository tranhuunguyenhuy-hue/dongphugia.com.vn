import { toNullableNumber } from "@/lib/seo/product-seo"

export type ProductPriceMode = "PUBLIC_PRICE" | "CONTACT_FOR_QUOTE"
export type ProductAvailability = "InStock" | "PreOrder" | "QuoteOnly" | "Discontinued"

export type ProductCommerceInput = {
  /** Canonical reference/list price. */
  listPrice?: unknown
  /** Legacy reference price; canonical selling price is salePrice. */
  originalPrice?: unknown
  salePrice?: unknown
  /** Legacy compatibility price; never a canonical selling-price writer. */
  compatibilityPrice?: unknown
  stockStatus?: string | null
}

export type ProductCommerceProjection = {
  priceMode: ProductPriceMode
  /** Canonical/compatibility reference price exposed for legacy UI consumers. */
  listPrice: number | null
  /** @deprecated Use listPrice. Kept as a compatibility read alias. */
  originalPrice: number | null
  salePrice: number | null
  displayPrice: number | null
  availability: ProductAvailability | null
  canAddToCart: boolean
  canRequestQuote: boolean
}

export function mapProductAvailability(stockStatus: string | null | undefined): ProductAvailability | null {
  switch (stockStatus) {
    case "in_stock":
      return "InStock"
    case "pre_order":
    case "preorder":
      return "PreOrder"
    case "contact":
      return "QuoteOnly"
    case "discontinued":
      return "Discontinued"
    default:
      // `out_of_stock` and any unknown legacy value remain an explicit
      // exception. They must not be silently converted into a canonical state.
      return null
  }
}

const quoteOnly = (availability: ProductAvailability | null, listPrice: number | null = null): ProductCommerceProjection => ({
  priceMode: "CONTACT_FOR_QUOTE",
  listPrice,
  originalPrice: listPrice,
  salePrice: null,
  displayPrice: null,
  availability,
  canAddToCart: false,
  canRequestQuote: availability !== null && availability !== "Discontinued",
})

export function resolveProductCommerce(
  input: ProductCommerceInput,
): ProductCommerceProjection {
  const availability = mapProductAvailability(input.stockStatus)
  const canonicalListPrice = toNullableNumber(input.listPrice)
  const suppliedOriginal = toNullableNumber(input.originalPrice)
  const suppliedSale = toNullableNumber(input.salePrice)
  const compatibilityPrice = toNullableNumber(input.compatibilityPrice)

  const legacyReferencePrice = suppliedOriginal && suppliedOriginal > 0
    ? suppliedOriginal
    : compatibilityPrice && compatibilityPrice > 0
      ? compatibilityPrice
      : null
  const listPrice = canonicalListPrice && canonicalListPrice > 0
    ? canonicalListPrice
    : legacyReferencePrice

  if (availability === "Discontinued" || availability === null) return quoteOnly(availability, listPrice)

  // Legacy price fields remain reference-only. They can explain a quote-only
  // row during the compatibility window, but cannot create a public selling
  // price without a canonical list/sale fact.
  const hasCanonicalList = canonicalListPrice !== null && canonicalListPrice > 0
  if (listPrice === null || (!hasCanonicalList && suppliedSale === null)) {
    return quoteOnly(availability, listPrice)
  }

  const hasExplicitSale = input.salePrice !== null && input.salePrice !== undefined
  if (hasExplicitSale && (suppliedSale === null || suppliedSale <= 0 || (listPrice !== null && suppliedSale >= listPrice))) {
    return quoteOnly(availability, listPrice)
  }

  const salePrice = hasExplicitSale ? suppliedSale : null
  const displayPrice = salePrice ?? (hasCanonicalList ? canonicalListPrice : null)

  if (displayPrice === null) return quoteOnly(availability, listPrice)

  return {
    priceMode: "PUBLIC_PRICE",
    listPrice,
    originalPrice: listPrice,
    salePrice,
    displayPrice,
    availability,
    canAddToCart: availability === "InStock",
    canRequestQuote: true,
  }
}
