import { describe, expect, it } from "vitest"
import { buildProductMetadata } from "./product-seo"

const product = {
  name: "Sản phẩm thử nghiệm",
  canonicalUrl: "/thiet-bi-ve-sinh/bon-cau/san-pham-thu-nghiem",
  categoryName: "Thiết bị vệ sinh",
}

describe("buildProductMetadata", () => {
  it("emits noindex when the product is explicitly excluded from indexing", () => {
    expect(buildProductMetadata({ ...product, seoIndexing: "noindex" }).robots).toEqual({
      index: false,
      follow: true,
    })
  })

  it("does not suppress indexing for a public indexable product", () => {
    expect(buildProductMetadata({ ...product, seoIndexing: "index" }).robots).toBeUndefined()
  })
})
