import { describe, expect, it } from "vitest"
import { buildQuoteItemSnapshot } from "./quote-snapshot"

const capturedAt = new Date("2026-08-23T12:00:00.000Z")

describe("buildQuoteItemSnapshot", () => {
  it("captures canonical public-price facts without discount metadata", () => {
    expect(buildQuoteItemSnapshot({
      id: 10,
      sku: "SKU-10",
      name: "Sản phẩm 10",
      listPrice: 1_250_000,
      salePrice: 1_100_000,
      stockStatus: "in_stock",
    }, capturedAt)).toEqual({
      product_sku_snapshot: "SKU-10",
      product_name_snapshot: "Sản phẩm 10",
      commerce_mode_snapshot: "PUBLIC_PRICE",
      availability_snapshot: "InStock",
      list_price_snapshot: 1_250_000,
      sale_price_snapshot: 1_100_000,
      snapshot_at: capturedAt,
    })
  })

  it("captures quote-only facts with nullable prices", () => {
    expect(buildQuoteItemSnapshot({
      id: 11,
      sku: "SKU-11",
      name: "Sản phẩm báo giá",
      originalPrice: 900_000,
      stockStatus: "contact",
    }, capturedAt)).toMatchObject({
      commerce_mode_snapshot: "CONTACT_FOR_QUOTE",
      availability_snapshot: "QuoteOnly",
      list_price_snapshot: 900_000,
      sale_price_snapshot: null,
      snapshot_at: capturedAt,
    })
  })

  it("withholds discontinued and unmapped legacy availability", () => {
    expect(buildQuoteItemSnapshot({
      id: 12,
      sku: "SKU-12",
      name: "Ngừng kinh doanh",
      listPrice: 1_000_000,
      stockStatus: "discontinued",
    }, capturedAt)).toBeNull()
    expect(buildQuoteItemSnapshot({
      id: 13,
      sku: "SKU-13",
      name: "Chưa phân loại",
      listPrice: 1_000_000,
      stockStatus: "out_of_stock",
    }, capturedAt)).toBeNull()
  })
})
