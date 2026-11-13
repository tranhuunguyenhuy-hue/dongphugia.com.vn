import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"
import { proxy } from "./proxy"
import productRedirects from "@/data/product-redirect-map.json"
import taxonomyRedirects from "@/data/catalog-taxonomy-v2-redirect-map.json"

const request = (url: string) => proxy(new NextRequest(url))

describe("public redirect boundary", () => {
  it("does not treat the unavailable .com.vn site as a migration source", () => {
    const response = request("https://dongphugia.com.vn/gach-op-lat.html")

    expect(response.headers.get("location")).toBeNull()
    expect(response.headers.get("x-middleware-next")).toBe("1")
  })

  it("canonicalizes only the current apex .vn host", () => {
    const response = request("https://dongphugia.vn/gach-op-lat?sort=asc")

    expect(response.status).toBe(308)
    expect(response.headers.get("location")).toBe(
      "https://www.dongphugia.vn/gach-op-lat?sort=asc",
    )
  })

  it("does not redirect an old URL without a verified equivalent replacement", () => {
    const response = request("https://www.dongphugia.vn/gach-1000-x-1000-mm.html")

    expect(response.headers.get("location")).toBeNull()
    expect(response.headers.get("x-middleware-next")).toBe("1")
  })

  it("ships no generated product redirect without manual verification", () => {
    expect(Object.keys(productRedirects)).toEqual([])
  })

  it("keeps a verified per-URL redirect direct and canonical", () => {
    const response = request(
      "https://www.dongphugia.vn/thiet-bi-ve-sinh/may-nuoc-nong/may-nuoc-nong-gian-tiep-kieu-dung-atmor",
    )

    expect(response.status).toBe(301)
    expect(response.headers.get("location")).toBe(
      "https://www.dongphugia.vn/vat-lieu-nuoc/may-nuoc-nong/may-nuoc-nong-gian-tiep-kieu-dung-atmor",
    )
  })

  it("keeps every reviewed redirect direct, non-looping, and inside a real route namespace", () => {
    const redirects = {
      ...productRedirects,
      ...taxonomyRedirects,
    } as Record<string, string>
    const sources = new Set(Object.keys(redirects))

    for (const [source, destination] of Object.entries(redirects)) {
      expect(destination, source).not.toBe(source)
      expect(sources.has(destination), `${source} chains through ${destination}`).toBe(false)
      expect(destination, source).toMatch(/^\/(?:thiet-bi-ve-sinh|thiet-bi-bep|vat-lieu-nuoc|gach-op-lat)\//)
      expect(destination, source).not.toContain("/san-pham/")
      expect(destination.split("/").at(-1), source).toBe(source.split("/").at(-1))

      const terminal = request(`https://www.dongphugia.vn${destination}`)
      expect(terminal.headers.get("location"), destination).toBeNull()
      expect(terminal.headers.get("x-middleware-next"), destination).toBe("1")
    }
  })
})

describe("legacy Admin launch boundary", () => {
  it("sends the Admin home to the Product list and allows only login, Products, and Blog posts", () => {
    const home = request("http://127.0.0.1/admin")
    expect(home.status).toBe(307)
    expect(new URL(home.headers.get("location") ?? "http://localhost").pathname).toBe("/admin/products")

    for (const path of [
      "/admin/login",
      "/admin/products",
      "/admin/products/123",
      "/admin/blog/posts",
      "/admin/blog/posts/123",
      "/admin/blog/posts/new",
    ]) {
      const response = request(`http://127.0.0.1${path}`)
      expect(response.headers.get("x-middleware-next"), path).toBe("1")
    }
  })

  it("returns 404 for deferred Admin modules", () => {
    for (const path of [
      "/admin/orders",
      "/admin/customers",
      "/admin/quote-requests",
      "/admin/categories",
      "/admin/pim",
      "/admin/content/banners",
      "/admin/banners",
      "/admin/doi-tac",
      "/admin/du-an",
      "/admin/users",
      "/admin/blog/tags",
    ]) {
      const response = request(`http://127.0.0.1${path}`)
      expect(response.status, path).toBe(404)
    }
  })
})
