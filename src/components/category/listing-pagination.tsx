"use client"

import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"

interface ListingPaginationProps {
  totalPages: number
  currentPage: number
}

const linkClasses = (active = false) => cn(
  "inline-flex h-9 min-w-9 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors",
  active
    ? "border border-brand-500 bg-brand-500 text-white"
    : "text-neutral-600 hover:bg-brand-500/10 hover:text-brand-500",
)

export function ListingPagination({
  totalPages,
  currentPage,
}: ListingPaginationProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  if (totalPages <= 1) return null

  const createPageURL = (pageNumber: number) => {
    const params = new URLSearchParams(searchParams)
    params.set("page", pageNumber.toString())
    return `${pathname}?${params.toString()}`
  }

  const items = []
  const maxVisiblePages = 5
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
  const endPage = Math.min(totalPages, Math.max(maxVisiblePages, startPage + maxVisiblePages - 1))

  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1)
  }

  if (startPage > 1) {
    items.push(
      <li key="1">
        <Link href={createPageURL(1)} className={linkClasses()}>1</Link>
      </li>,
    )
    if (startPage > 2) {
      items.push(
        <li key="ellipsis-start" aria-hidden="true">
          <span className="flex h-9 w-9 items-center justify-center">
            <MoreHorizontal className="h-4 w-4" />
          </span>
        </li>,
      )
    }
  }

  for (let page = startPage; page <= endPage; page += 1) {
    items.push(
      <li key={page}>
        <Link
          href={createPageURL(page)}
          aria-current={currentPage === page ? "page" : undefined}
          className={linkClasses(currentPage === page)}
        >
          {page}
        </Link>
      </li>,
    )
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      items.push(
        <li key="ellipsis-end" aria-hidden="true">
          <span className="flex h-9 w-9 items-center justify-center">
            <MoreHorizontal className="h-4 w-4" />
          </span>
        </li>,
      )
    }
    items.push(
      <li key={totalPages}>
        <Link href={createPageURL(totalPages)} className={linkClasses()}>
          {totalPages}
        </Link>
      </li>,
    )
  }

  return (
    <nav aria-label="Phân trang" className="mx-auto mt-8 mb-4 flex w-full justify-center">
      <ul className="flex flex-row flex-wrap items-center justify-center gap-1">
        <li>
          {currentPage > 1 ? (
            <Link
              href={createPageURL(currentPage - 1)}
              aria-label="Trang trước"
              className={cn(linkClasses(), "gap-1 pl-2.5")}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Trang trước</span>
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className={cn(linkClasses(), "gap-1 pl-2.5 opacity-50")}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Trang trước</span>
            </span>
          )}
        </li>

        {items}

        <li>
          {currentPage < totalPages ? (
            <Link
              href={createPageURL(currentPage + 1)}
              aria-label="Trang sau"
              className={cn(linkClasses(), "gap-1 pr-2.5")}
            >
              <span className="hidden sm:inline">Trang sau</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className={cn(linkClasses(), "gap-1 pr-2.5 opacity-50")}
            >
              <span className="hidden sm:inline">Trang sau</span>
              <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </li>
      </ul>
    </nav>
  )
}
