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
  it("includes an Offer only when a valid price exists", () => {
    const schema = buildProductSchema({ ...product, price: 1_250_000 })

    expect(schema.offers).toMatchObject({
      "@type": "Offer",
      price: 1_250_000,
      priceCurrency: "VND",
    })
  })

  it.each([null, 0, -1])("omits Offer for a non-sellable price: %s", (price) => {
    const schema = buildProductSchema({ ...product, price })

    expect(schema).not.toHaveProperty("offers")
  })
})
