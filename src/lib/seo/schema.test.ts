import { describe, expect, it } from "vitest"
import { buildProductSchema } from "./schema"

const product = {
  name: "Sản phẩm thử nghiệm",
  sku: "TEST-01",
  slug: "san-pham-thu-nghiem",
  categorySlug: "thiet-bi-ve-sinh",
  subcategorySlug: "bon-cau",
  stock_status: "in_stock",
}

describe("buildProductSchema", () => {
  it("emits Product + Offer with the canonical sale price when in stock", () => {
    const schema = buildProductSchema({
      ...product,
      original_price: 1_250_000,
      list_price: 1_250_000,
      sale_price: 1_100_000,
      price: null,
    })

    expect(schema?.offers).toMatchObject({
      "@type": "Offer",
      price: 1_100_000,
      priceCurrency: "VND",
      availability: "https://schema.org/InStock",
    })
    expect(schema?.offers).not.toHaveProperty("priceValidUntil")
  })

  it("withholds structured data for an unmapped legacy availability", () => {
    const schema = buildProductSchema({
      ...product,
      original_price: 1_250_000,
      list_price: 1_250_000,
      sale_price: null,
      price: null,
      stock_status: "out_of_stock",
    })

    expect(schema).toBeNull()
  })

  it("omits Product rich-result markup for a quote-only product", () => {
    expect(buildProductSchema({
      ...product,
      original_price: null,
      sale_price: null,
      price: null,
    })).toBeNull()
  })
})
