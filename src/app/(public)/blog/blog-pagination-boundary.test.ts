import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  connection: vi.fn(),
  getBlogPosts: vi.fn(),
  getBlogCategories: vi.fn(),
  getPopularTags: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND")
  }),
}))

vi.mock("next/server", () => ({ connection: mocks.connection }))
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }))
vi.mock("@/lib/public-api-blog", () => ({
  getBlogPosts: mocks.getBlogPosts,
  getBlogCategories: mocks.getBlogCategories,
  getPopularTags: mocks.getPopularTags,
}))

import BlogPage from "./page"
import BlogCategoryPage from "./[categorySlug]/page"
import { generateMetadata as generateBlogMetadata } from "./page"
import { generateMetadata as generateCategoryMetadata } from "./[categorySlug]/page"

describe("public blog pagination boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.connection.mockResolvedValue(undefined)
    mocks.getBlogCategories.mockResolvedValue([
      { slug: "kien-thuc", name: "Kiến thức", description: null },
    ])
    mocks.getPopularTags.mockResolvedValue([])
    mocks.getBlogPosts.mockResolvedValue({ posts: [], total: 0, totalPages: 0, page: 1 })
  })

  it("rejects malformed pagination on the blog index", async () => {
    await expect(BlogPage({
      searchParams: Promise.resolve({ page: "abc" }),
    })).rejects.toThrow("NEXT_NOT_FOUND")

    expect(mocks.getBlogPosts).not.toHaveBeenCalled()
  })

  it("rejects an out-of-range blog index instead of rendering an empty 200", async () => {
    mocks.getBlogPosts.mockResolvedValueOnce({ posts: [], total: 18, totalPages: 2, page: 3 })

    await expect(BlogPage({
      searchParams: Promise.resolve({ page: "3" }),
    })).rejects.toThrow("NEXT_NOT_FOUND")

    expect(mocks.getBlogPosts).toHaveBeenCalledWith({ limit: 9, page: 3 })
  })

  it("passes canonical pagination into a category query and rejects overflow", async () => {
    mocks.getBlogPosts.mockResolvedValueOnce({ posts: [], total: 24, totalPages: 2, page: 3 })

    await expect(BlogCategoryPage({
      params: Promise.resolve({ categorySlug: "kien-thuc" }),
      searchParams: Promise.resolve({ page: "3" }),
    })).rejects.toThrow("NEXT_NOT_FOUND")

    expect(mocks.getBlogPosts).toHaveBeenCalledWith({
      categorySlug: "kien-thuc",
      limit: 12,
      page: 3,
    })
  })

  it("self-canonicalizes valid paginated blog URLs", async () => {
    const blogMetadata = await generateBlogMetadata({
      searchParams: Promise.resolve({ page: "2" }),
    })
    const categoryMetadata = await generateCategoryMetadata({
      params: Promise.resolve({ categorySlug: "kien-thuc" }),
      searchParams: Promise.resolve({ page: "2" }),
    })

    expect(blogMetadata.alternates?.canonical).toMatch(/\/blog\?page=2$/)
    expect(categoryMetadata.alternates?.canonical).toMatch(/\/blog\/kien-thuc\?page=2$/)
  })
})
