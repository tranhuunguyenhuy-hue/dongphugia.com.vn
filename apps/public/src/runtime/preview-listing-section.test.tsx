import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ search: new URLSearchParams(), fetch: vi.fn() }))

vi.mock('next/navigation', () => ({ useSearchParams: () => mocks.search }))
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }))
vi.mock('@/components/ui/product-card', () => ({
  ProductCard: ({ product }: { product: { id: number; name: string; url: string } }) =>
    <a data-testid="product-card" href={product.url}>{product.id}:{product.name}</a>,
}))
vi.mock('@/components/category/listing-pagination', () => ({
  ListingPagination: ({ totalPages, currentPage }: { totalPages: number; currentPage: number }) =>
    <nav aria-label="Pagination">Trang {currentPage}/{totalPages}</nav>,
}))
vi.mock('@/components/category/category-mobile-filter', () => ({ CategoryMobileFilter: () => <button>Bộ lọc</button> }))
vi.mock('@/components/category/category-sort', () => ({ CategorySort: () => <button>Sắp xếp</button> }))
vi.mock('@/components/category/active-filters', () => ({ ActiveFilters: () => null }))

import { PreviewListingSection } from './preview-listing-section'
import type { PublicSnapshotListingProduct, PublicSnapshotListingShard } from './snapshot-listing-contract'

const checkpoint = 'a'.repeat(40)

function product(id: number): PublicSnapshotListingProduct {
  const brand = id % 2 === 0 ? 'brand-b' : 'brand-a'
  return {
    id,
    name: `Sản phẩm ${id}`,
    display_name: `Sản phẩm ${id}`,
    slug: `san-pham-${id}`,
    sku: `SKU-${id}`,
    price: null,
    price_display: 'Liên hệ báo giá',
    stock_status: 'contact',
    image_main_url: null,
    is_active: true,
    is_featured: id % 3 === 0,
    is_promotion: false,
    variant_options: [],
    categories: { name: 'Thiết Bị Bếp', slug: 'thiet-bi-bep' },
    subcategories: { name: 'Vòi rửa chén', slug: 'voi-rua-chen' },
    brands: { name: brand === 'brand-a' ? 'Brand A' : 'Brand B', slug: brand },
    canonical_category_slug: 'thiet-bi-bep',
    canonical_subcategory_slug: 'voi-rua-chen',
    url: `/thiet-bi-bep/voi-rua-chen/san-pham-${id}`,
  }
}

function shard(page: number, products: PublicSnapshotListingProduct[]): PublicSnapshotListingShard {
  return {
    contract: 'dpg:public-catalogue-listing-shard:v1',
    checkpoint,
    categorySlug: 'thiet-bi-bep',
    listingSlug: 'voi-rua-chen',
    page,
    pageSize: 48,
    totalCount: products.length,
    totalPages: 1,
    products,
  }
}

const props = {
  categorySlug: 'thiet-bi-bep',
  listingSlug: 'voi-rua-chen',
  basePath: '/thiet-bi-bep',
  pageSize: 12 as const,
  availableFilters: { brands: [], features: [], materials: [], origins: [], colors: [], subcategories: [] },
  runtimeConfig: { snapshotMode: true, profileKey: null, hideColorFilter: true, enableSpecFilters: false, enableProductTypeTabs: false,
    readyForRefactor: false, relationPriority: ['brand'] as Array<'brand'> },
  filterDict: {},
}

describe('canonical Preview listing section', () => {
  beforeEach(() => {
    mocks.search = new URLSearchParams()
    mocks.fetch.mockReset()
    vi.stubGlobal('fetch', mocks.fetch)
    mocks.fetch.mockImplementation(async (input: RequestInfo | URL) => {
      const page = Number(new URL(String(input), 'https://preview.invalid').searchParams.get('page'))
      return Response.json(shard(page, Array.from({ length: 26 }, (_, index) => product(index + 1))))
    })
  })

  it('hydrates a direct multi-brand URL, filters the authentic shard set and responds to history URL changes', async () => {
    mocks.search = new URLSearchParams('brand=brand-a,brand-b&is_featured=true&page=1')
    const view = render(<PreviewListingSection {...props} />)

    const cards = await screen.findAllByTestId('product-card')
    expect(cards.map(card => card.textContent?.split(':')[0])).toEqual(['3', '6', '9', '12', '15', '18', '21', '24'])

    // Next navigation and browser back/forward update the URL; the same loaded
    // snapshot is re-filtered without an extra API fetch or a blank result.
    mocks.search = new URLSearchParams('brand=brand-a,brand-b&page=2')
    view.rerender(<PreviewListingSection {...props} />)
    await waitFor(() => expect(screen.getAllByTestId('product-card').map(card => card.textContent?.split(':')[0]))
      .toEqual(['13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24']))
    expect(screen.getByRole('navigation', { name: 'Pagination' }).textContent).toContain('Trang 2/3')

    mocks.search = new URLSearchParams('brand=brand-a,brand-b&is_featured=true&page=1')
    view.rerender(<PreviewListingSection {...props} />)
    await waitFor(() => expect(screen.getAllByTestId('product-card')).toHaveLength(8))
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })

  it('keeps failed shard reads visible and offers a working retry', async () => {
    mocks.fetch.mockRejectedValueOnce(new Error('503'))
    render(<PreviewListingSection {...props} />)
    expect((await screen.findByRole('alert')).textContent).toContain('Chưa tải được danh sách sản phẩm')

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByText('1:Sản phẩm 1')).toBeTruthy()
  })

  it('renders a loading shell in HTML and fills products after hydration', async () => {
    const html = renderToString(<PreviewListingSection {...props} />)
    expect(html).toContain('Đang tải sản phẩm')
    expect(html).not.toContain('Sản phẩm 1')
    expect(html).not.toContain('Sắp xếp')

    render(<PreviewListingSection {...props} />)
    expect(await screen.findByText('1:Sản phẩm 1')).toBeTruthy()
    expect(screen.queryByText('Sắp xếp')).toBeNull()
  })

  it('fails closed with a way back when the URL uses unsupported sort fields', () => {
    mocks.search = new URLSearchParams('sort=price-asc')
    render(<PreviewListingSection {...props} />)
    expect(screen.getByRole('alert').textContent).toContain('Bộ lọc không hợp lệ')
    expect(screen.getByRole('link', { name: 'Xóa bộ lọc' }).getAttribute('href'))
      .toBe('/thiet-bi-bep/voi-rua-chen')
  })
})
