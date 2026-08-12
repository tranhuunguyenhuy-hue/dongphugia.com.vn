import { render, screen } from "@testing-library/react"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

const navigation = vi.hoisted(() => ({
  pathname: "/blog",
  searchParams: new URLSearchParams("sort=latest"),
}))

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => navigation.searchParams,
}))

import { ListingPagination } from "./listing-pagination"

describe("public listing pagination", () => {
  beforeEach(() => {
    navigation.pathname = "/blog"
    navigation.searchParams = new URLSearchParams("sort=latest")
  })

  it("keeps existing filters while exposing direct previous, page, and next links", () => {
    render(<ListingPagination totalPages={7} currentPage={3} />)

    expect(screen.getByRole("navigation", { name: "Phân trang" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Trang trước" })).toHaveAttribute(
      "href",
      "/blog?sort=latest&page=2",
    )
    expect(screen.getByRole("link", { name: "3" })).toHaveAttribute(
      "href",
      "/blog?sort=latest&page=3",
    )
    expect(screen.getByRole("link", { name: "Trang sau" })).toHaveAttribute(
      "href",
      "/blog?sort=latest&page=4",
    )
  })

  it("does not import admin-only UI components", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/category/listing-pagination.tsx"),
      "utf8",
    )

    expect(source).not.toContain('from "@/components/ui/')
  })
})
