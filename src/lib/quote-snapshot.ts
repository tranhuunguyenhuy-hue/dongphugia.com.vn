import {
  resolveProductCommerce,
  type ProductCommerceInput,
  type ProductCommerceProjection,
} from "@/lib/product-commerce"

export type QuoteSnapshotProduct = ProductCommerceInput & {
  id: number
  sku: string
  name: string
}

export type QuoteItemSnapshot = {
  product_sku_snapshot: string
  product_name_snapshot: string
  commerce_mode_snapshot: "PUBLIC_PRICE" | "CONTACT_FOR_QUOTE"
  availability_snapshot: "InStock" | "PreOrder" | "QuoteOnly" | "Discontinued"
  list_price_snapshot: number | null
  sale_price_snapshot: number | null
  snapshot_at: Date
}

export function buildQuoteItemSnapshot(
  product: QuoteSnapshotProduct,
  snapshotAt = new Date(),
): QuoteItemSnapshot | null {
  const commerce = resolveProductCommerce(product)

  if (!isQuoteableCommerce(commerce)) return null

  return {
    product_sku_snapshot: product.sku.slice(0, 100),
    product_name_snapshot: product.name.slice(0, 500),
    commerce_mode_snapshot: commerce.priceMode,
    availability_snapshot: commerce.availability,
    list_price_snapshot: commerce.listPrice,
    sale_price_snapshot: commerce.salePrice,
    snapshot_at: snapshotAt,
  }
}

function isQuoteableCommerce(
  commerce: ProductCommerceProjection,
): commerce is ProductCommerceProjection & {
  availability: "InStock" | "PreOrder" | "QuoteOnly"
} {
  return commerce.canRequestQuote
    && commerce.availability !== null
    && commerce.availability !== "Discontinued"
}

