import { render, screen } from "@testing-library/react"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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
    window.history.replaceState({}, "", "/blog?sort=latest")
  })

  afterEach(() => {
    window.history.replaceState({}, "", "/")
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

  it("keeps direct multi-brand URL filters in pagination links when Next params are stale", () => {
    navigation.pathname = "/thiet-bi-bep/voi-rua-chen"
    navigation.searchParams = new URLSearchParams()
    window.history.replaceState({}, "", "/thiet-bi-bep/voi-rua-chen?brands=toto%2Cinax&page=2")

    render(<ListingPagination totalPages={3} currentPage={2} />)

    expect(screen.getByRole("link", { name: "Trang trước" })).toHaveAttribute(
      "href",
      "/thiet-bi-bep/voi-rua-chen?brands=toto%2Cinax&page=1",
    )
    expect(screen.getByRole("link", { name: "Trang sau" })).toHaveAttribute(
      "href",
      "/thiet-bi-bep/voi-rua-chen?brands=toto%2Cinax&page=3",
    )
  })
})
