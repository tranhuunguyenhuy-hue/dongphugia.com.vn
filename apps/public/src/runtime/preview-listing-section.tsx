'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { ProductCard } from '@/components/ui/product-card'
import { ListingPagination } from '@/components/category/listing-pagination'
import { CategoryMobileFilter } from '@/components/category/category-mobile-filter'
import { CategorySort } from '@/components/category/category-sort'
import { ActiveFilters } from '@/components/category/active-filters'
import type { PreviewListingSectionProps } from '@/components/category/preview-listing-section.types'
import { shouldPrioritizeListingCard } from '@/lib/listing-image-priority'
import {
  loadPublicSnapshotListing,
  selectPublicSnapshotListingPage,
  type LoadedPublicSnapshotListing,
} from './snapshot-listing-client'
import { parsePublicSnapshotListingFilters } from './snapshot-listing-contract'

export function PreviewListingSection({
  categorySlug, listingSlug, basePath, pageSize, availableFilters, runtimeConfig, filterDict,
}: PreviewListingSectionProps) {
  const searchParams = useSearchParams()
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{
    key: string
    listing?: LoadedPublicSnapshotListing
    failed?: boolean
  }>({ key: '' })
  const key = `${categorySlug}/${listingSlug}/${attempt}`

  useEffect(() => {
    const controller = new AbortController()
    loadPublicSnapshotListing(categorySlug, listingSlug, { signal: controller.signal })
      .then((listing) => { if (!controller.signal.aborted) setState({ key, listing }) })
      .catch(() => { if (!controller.signal.aborted) setState({ key, failed: true }) })
    return () => controller.abort()
  }, [categorySlug, listingSlug, attempt, key])

  const filters = useMemo(
    () => parsePublicSnapshotListingFilters(new URLSearchParams(searchParams.toString())),
    [searchParams],
  )
  const current = state.key === key ? state : { key }
  const result = current.listing && filters
    ? selectPublicSnapshotListingPage(current.listing, filters, pageSize)
    : null
  const count = result ? result.total.toLocaleString('vi-VN') : '…'

  return <>
    <div className="mb-6 flex flex-col gap-3">
      <div className="flex justify-between items-center gap-2 py-2 lg:py-0">
        <span className="text-sm font-medium text-neutral-500">
          <strong className="text-neutral-900" aria-live="polite">{count}</strong> sản phẩm
        </span>
        <div className="flex items-center gap-2">
          <CategoryMobileFilter availableFilters={availableFilters} runtimeConfig={runtimeConfig}
            hideColorFilter={runtimeConfig.hideColorFilter} />
          {/* Snapshot products have no public price value or trustworthy sort key. */}
          {!runtimeConfig.snapshotMode && <CategorySort />}
        </div>
      </div>
      <ActiveFilters filterDict={filterDict} excludeKeys={['sub']} />
    </div>

    {!filters ? (
      <div role="alert" className="py-12 text-center text-neutral-600">
        <p>Bộ lọc không hợp lệ.</p>
        <Link href={`${basePath}/${listingSlug}`} className="mt-4 inline-block text-brand-500">Xóa bộ lọc</Link>
      </div>
    ) : current.failed ? (
      <div role="alert" className="py-16 text-center text-neutral-700">
        <p>Chưa tải được danh sách sản phẩm. Vui lòng thử lại.</p>
        <button type="button" onClick={() => setAttempt(value => value + 1)}
          className="mt-4 rounded-md border border-neutral-300 px-4 py-2">Thử lại</button>
      </div>
    ) : !result ? (
      <div role="status" aria-busy="true" className="py-24 text-center text-neutral-500">Đang tải sản phẩm…</div>
    ) : !result.pageInRange ? (
      <div role="alert" className="py-16 text-center text-neutral-700">
        <p>Trang sản phẩm này không tồn tại với bộ lọc hiện tại.</p>
        <Link href={`${basePath}/${listingSlug}?page=1`} className="mt-4 inline-block text-brand-500">Về trang đầu</Link>
      </div>
    ) : result.products.length > 0 ? (
      <>
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          {result.products.map((product, index) => <ProductCard key={product.id} product={product}
            basePath={basePath} patternSlug={product.subcategories.slug}
            priority={categorySlug === 'thiet-bi-ve-sinh' ? shouldPrioritizeListingCard(index) : index === 0}
            href={product.url} />)}
        </div>
        <div className="mt-12"><ListingPagination totalPages={result.totalPages} currentPage={result.page} /></div>
      </>
    ) : (
      <div className="py-24 text-center bg-neutral-50 rounded-lg border border-neutral-200 border-dashed">
        <p className="text-lg font-medium text-neutral-900 mb-1">Không tìm thấy sản phẩm nào</p>
        <p className="text-sm text-neutral-500 mb-6">Vui lòng thử xóa bớt bộ lọc.</p>
        <Link href={`${basePath}/${listingSlug}`} className="inline-flex h-9 items-center justify-center rounded-md bg-white border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50">Xóa tất cả bộ lọc</Link>
      </div>
    )}
  </>
}
