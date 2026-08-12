import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  subcategoryFindFirst: vi.fn(),
  subcategoryFindMany: vi.fn(),
  taxonFindFirst: vi.fn(),
  taxonFindMany: vi.fn(),
  assignmentCount: vi.fn(),
  assignmentGroupBy: vi.fn(),
}))

vi.mock("next/cache", () => ({
  unstable_cache: (callback: unknown) => callback,
}))

vi.mock("@/lib/prisma", () => ({
  default: {
    subcategories: {
      findFirst: mocks.subcategoryFindFirst,
      findMany: mocks.subcategoryFindMany,
    },
    catalog_taxons: {
      findFirst: mocks.taxonFindFirst,
      findMany: mocks.taxonFindMany,
    },
    product_taxon_assignments: {
      count: mocks.assignmentCount,
      groupBy: mocks.assignmentGroupBy,
    },
  },
}))

import { getPublicListingLeaf, getPublicListingLeaves } from "./public-api-products"

const legacyLeaf = (slug: string, products: number) => ({
  id: products + 1,
  name: slug,
  slug,
  description: null,
  thumbnail_url: null,
  _count: { products, secondary_product_subcategories: 0 },
})

describe("public listing leaf boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("does not resolve an empty legacy subcategory as an indexable route", async () => {
    mocks.subcategoryFindFirst.mockResolvedValueOnce(legacyLeaf("empty", 0))
    mocks.taxonFindFirst.mockResolvedValueOnce(null)

    await expect(getPublicListingLeaf("thiet-bi-bep", "empty")).resolves.toBeNull()
    expect(mocks.subcategoryFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        slug: "empty",
        categories: { slug: "thiet-bi-bep" },
      }),
    }))
  })

  it("omits empty legacy subcategories from public navigation", async () => {
    mocks.subcategoryFindMany.mockResolvedValueOnce([
      legacyLeaf("empty", 0),
      legacyLeaf("populated", 2),
    ])
    mocks.taxonFindMany.mockResolvedValueOnce([])

    const leaves = await getPublicListingLeaves("thiet-bi-bep")

    expect(leaves.map((leaf) => leaf.slug)).toEqual(["populated"])
  })
})
