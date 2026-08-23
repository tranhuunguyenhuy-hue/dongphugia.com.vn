import { describe, expect, it } from "vitest"
import { resolveProductCommerce } from "./product-commerce"

describe("resolveProductCommerce", () => {
  it("projects canonical public sale price and in-stock purchase state", () => {
    expect(resolveProductCommerce({
      listPrice: 1_250_000,
      salePrice: 1_100_000,
      stockStatus: "in_stock",
    })).toEqual({
      priceMode: "PUBLIC_PRICE",
      listPrice: 1_250_000,
      originalPrice: 1_250_000,
      salePrice: 1_100_000,
      displayPrice: 1_100_000,
      availability: "InStock",
      canAddToCart: true,
      canRequestQuote: true,
    })
  })

  it("withholds an unmapped legacy availability", () => {
    expect(resolveProductCommerce({
      listPrice: 1_250_000,
      salePrice: null,
      stockStatus: "out_of_stock",
    })).toMatchObject({
      priceMode: "CONTACT_FOR_QUOTE",
      listPrice: 1_250_000,
      displayPrice: null,
      availability: null,
      canAddToCart: false,
      canRequestQuote: false,
    })
  })

  it("keeps legacy price fields reference-only during compatibility", () => {
    expect(resolveProductCommerce({
      originalPrice: 1_250_000,
      compatibilityPrice: 1_100_000,
      stockStatus: "in_stock",
    })).toMatchObject({
      priceMode: "CONTACT_FOR_QUOTE",
      listPrice: 1_250_000,
      originalPrice: 1_250_000,
      salePrice: null,
      displayPrice: null,
      availability: "InStock",
      canAddToCart: false,
      canRequestQuote: true,
    })
  })

  it.each([
    { listPrice: null, originalPrice: null, salePrice: null, compatibilityPrice: null },
    { listPrice: null, originalPrice: 0, salePrice: null, compatibilityPrice: null },
    { listPrice: 1_000_000, originalPrice: null, salePrice: 1_000_000, compatibilityPrice: null },
    { listPrice: 1_000_000, originalPrice: null, salePrice: 1_200_000, compatibilityPrice: null },
  ])("fails invalid commerce facts closed as quote-only: %o", (prices) => {
    expect(resolveProductCommerce({ ...prices, stockStatus: "in_stock" })).toMatchObject({
      priceMode: "CONTACT_FOR_QUOTE",
      salePrice: null,
      displayPrice: null,
      availability: "InStock",
      canAddToCart: false,
      canRequestQuote: true,
    })
  })

  it.each([
    ["pre_order", "PreOrder"],
    ["preorder", "PreOrder"],
    ["contact", "QuoteOnly"],
    ["discontinued", "Discontinued"],
  ] as const)("maps %s into the approved Availability vocabulary", (stockStatus, availability) => {
    expect(resolveProductCommerce({
      listPrice: 1_000_000,
      stockStatus,
    }).availability).toBe(availability)
  })
})
