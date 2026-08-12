import { toNullableNumber } from "@/lib/seo/product-seo"

export type ProductPriceMode = "PUBLIC_PRICE" | "CONTACT_FOR_QUOTE"
export type ProductAvailability = "IN_STOCK" | "OUT_OF_STOCK"

export type ProductCommerceInput = {
  originalPrice?: unknown
  salePrice?: unknown
  legacyPrice?: unknown
  stockStatus?: string | null
}

export type ProductCommerceProjection = {
  priceMode: ProductPriceMode
  originalPrice: number | null
  salePrice: number | null
  displayPrice: number | null
  availability: ProductAvailability
  canAddToCart: boolean
}

const quoteOnly = (availability: ProductAvailability): ProductCommerceProjection => ({
  priceMode: "CONTACT_FOR_QUOTE",
  originalPrice: null,
  salePrice: null,
  displayPrice: null,
  availability,
  canAddToCart: false,
})

export function resolveProductCommerce(
  input: ProductCommerceInput,
): ProductCommerceProjection {
  const availability = input.stockStatus === "in_stock" ? "IN_STOCK" : "OUT_OF_STOCK"
  const suppliedOriginal = toNullableNumber(input.originalPrice)
  const suppliedSale = toNullableNumber(input.salePrice)
  const legacyPrice = toNullableNumber(input.legacyPrice)

  const originalPrice = suppliedOriginal && suppliedOriginal > 0
    ? suppliedOriginal
    : legacyPrice && legacyPrice > 0
      ? legacyPrice
      : null

  if (originalPrice === null) return quoteOnly(availability)

  const hasExplicitSale = input.salePrice !== null && input.salePrice !== undefined
  if (hasExplicitSale && (suppliedSale === null || suppliedSale <= 0 || suppliedSale >= originalPrice)) {
    return quoteOnly(availability)
  }

  const compatibilitySale = !hasExplicitSale
    && suppliedOriginal !== null
    && legacyPrice !== null
    && legacyPrice > 0
    && legacyPrice < originalPrice
      ? legacyPrice
      : null
  const salePrice = hasExplicitSale ? suppliedSale : compatibilitySale
  const displayPrice = salePrice ?? originalPrice

  return {
    priceMode: "PUBLIC_PRICE",
    originalPrice,
    salePrice,
    displayPrice,
    availability,
    canAddToCart: availability === "IN_STOCK",
  }
}
