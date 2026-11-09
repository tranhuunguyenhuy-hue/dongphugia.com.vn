import { describe, expect, it } from "vitest"
import { resolveFinalOnlinePrice, resolveProductCommerce } from "./product-commerce"

it('only computes a final online price for a valid public discount', () => {
  expect(resolveFinalOnlinePrice(21_223_200, 3_183_000)).toBe(18_040_200)
  expect(resolveFinalOnlinePrice(21_223_200, 21_223_200)).toBeNull()
  expect(resolveFinalOnlinePrice(null, 3_183_000)).toBeNull()
})

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
      canRequestOrder: true,
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
      canRequestOrder: false,
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
      canRequestOrder: false,
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
      canRequestOrder: false,
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

  it("allows a priced contact-status product into a staff-confirmed request cart without claiming stock", () => {
    expect(resolveProductCommerce({
      listPrice: 1_000_000,
      stockStatus: "contact",
    })).toMatchObject({
      priceMode: "PUBLIC_PRICE",
      displayPrice: 1_000_000,
      availability: "QuoteOnly",
      canAddToCart: false,
      canRequestOrder: true,
      canRequestQuote: true,
    })
  })

  it("allows a priced preorder into a staff-confirmed request cart", () => {
    expect(resolveProductCommerce({
      listPrice: 1_000_000,
      stockStatus: "pre_order",
    }).canRequestOrder).toBe(true)
  })

  it("does not allow discontinued products into a request cart", () => {
    expect(resolveProductCommerce({
      listPrice: 1_000_000,
      stockStatus: "discontinued",
    }).canRequestOrder).toBe(false)
  })
})
