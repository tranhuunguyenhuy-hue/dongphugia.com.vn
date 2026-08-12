import { describe, expect, it } from "vitest"
import { resolveProductCommerce } from "./product-commerce"

describe("resolveProductCommerce", () => {
  it("projects a valid public sale price and in-stock purchase state", () => {
    expect(resolveProductCommerce({
      originalPrice: 1_250_000,
      salePrice: 1_100_000,
      legacyPrice: null,
      stockStatus: "in_stock",
    })).toEqual({
      priceMode: "PUBLIC_PRICE",
      originalPrice: 1_250_000,
      salePrice: 1_100_000,
      displayPrice: 1_100_000,
      availability: "IN_STOCK",
      canAddToCart: true,
    })
  })

  it("keeps a valid public price but prevents purchase when out of stock", () => {
    expect(resolveProductCommerce({
      originalPrice: 1_250_000,
      salePrice: null,
      legacyPrice: null,
      stockStatus: "out_of_stock",
    })).toMatchObject({
      priceMode: "PUBLIC_PRICE",
      displayPrice: 1_250_000,
      availability: "OUT_OF_STOCK",
      canAddToCart: false,
    })
  })

  it("supports the current database shape without changing the future contract", () => {
    expect(resolveProductCommerce({
      originalPrice: 1_250_000,
      salePrice: null,
      legacyPrice: 1_100_000,
      stockStatus: "in_stock",
    })).toMatchObject({
      originalPrice: 1_250_000,
      salePrice: 1_100_000,
      displayPrice: 1_100_000,
    })
  })

  it.each([
    { originalPrice: null, salePrice: null, legacyPrice: null },
    { originalPrice: 0, salePrice: null, legacyPrice: null },
    { originalPrice: 1_000_000, salePrice: 1_000_000, legacyPrice: null },
    { originalPrice: 1_000_000, salePrice: 1_200_000, legacyPrice: null },
  ])("fails invalid commerce facts closed as quote-only: %o", (prices) => {
    expect(resolveProductCommerce({ ...prices, stockStatus: "in_stock" })).toEqual({
      priceMode: "CONTACT_FOR_QUOTE",
      originalPrice: null,
      salePrice: null,
      displayPrice: null,
      availability: "IN_STOCK",
      canAddToCart: false,
    })
  })
})
