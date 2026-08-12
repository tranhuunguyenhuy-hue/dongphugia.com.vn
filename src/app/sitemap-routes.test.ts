import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  productCount: vi.fn(),
  productFindMany: vi.fn(),
  subcategoryFindMany: vi.fn(),
  blogPostFindMany: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  default: {
    products: {
      count: mocks.productCount,
      findMany: mocks.productFindMany,
    },
    subcategories: { findMany: mocks.subcategoryFindMany },
    blog_posts: { findMany: mocks.blogPostFindMany },
  },
}))

import { GET as getSitemapIndex } from "@/app/sitemap.xml/route"
import { GET as getStaticSitemap } from "@/app/sitemap_static.xml/route"
import { GET as getProductSitemap } from "@/app/api/sitemap/[id]/route"

const expectRetryableFailure = async (response: Response) => {
  expect(response.status).toBe(503)
  expect(response.headers.get("cache-control")).toBe("no-store")
  expect(response.headers.get("retry-after")).toBe("300")
  const body = await response.text()
  expect(body).not.toContain("<urlset")
  expect(body).not.toContain("<sitemapindex")
}

describe("public sitemap route boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fails the sitemap index closed when its product count is unavailable", async () => {
    mocks.productCount.mockRejectedValueOnce(new Error("database unavailable"))

    await expectRetryableFailure(await getSitemapIndex())
  })

  it("publishes the complete sitemap index only after the product count succeeds", async () => {
    mocks.productCount.mockResolvedValueOnce(4_001)

    const response = await getSitemapIndex()
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body.match(/<loc>/g)).toHaveLength(4)
    expect(body).toContain("/sitemap_static.xml")
    expect(body).toContain("/sitemap_product_3.xml")
  })

  it("does not return a partial static sitemap when a required query fails", async () => {
    mocks.subcategoryFindMany.mockRejectedValueOnce(new Error("database unavailable"))
    mocks.blogPostFindMany.mockResolvedValueOnce([])

    await expectRetryableFailure(await getStaticSitemap())
  })

  it("queries only active subcategories that contain a public sitemap product", async () => {
    mocks.subcategoryFindMany.mockResolvedValueOnce([])
    mocks.blogPostFindMany.mockResolvedValueOnce([])

    const response = await getStaticSitemap()

    expect(response.status).toBe(200)
    expect(mocks.subcategoryFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        categories: { is_active: true },
        is_active: true,
        products: { some: expect.objectContaining({
          is_active: true,
          publication_status: "public",
          pdp_visibility: "public",
          sitemap_include: true,
        }) },
      }),
    }))
  })

  it("fails a product sitemap batch closed when the batch cannot be completed", async () => {
    mocks.productFindMany.mockRejectedValueOnce(new Error("database unavailable"))

    await expectRetryableFailure(
      await getProductSitemap(new Request("https://example.test/api/sitemap/1"), {
        params: Promise.resolve({ id: "1" }),
      }),
    )
  })
})
