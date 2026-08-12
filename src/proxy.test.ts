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
      "https://www.dongphugia.vn/thiet-bi-ve-sinh/chau-rua-chen/gio-dat-len-chau-rua-chen-moen-23701-10158",
    )

    expect(response.status).toBe(301)
    expect(response.headers.get("location")).toBe(
      "https://www.dongphugia.vn/thiet-bi-bep/chau-rua-chen/gio-dat-len-chau-rua-chen-moen-23701-10158",
    )
  })

  it("keeps every redirect direct, non-looping, and inside a real route namespace", () => {
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
