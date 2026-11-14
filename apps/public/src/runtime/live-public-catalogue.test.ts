import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ readPublicRows: vi.fn() }))
vi.mock('./public-db', () => ({ readPublicRows: mocks.readPublicRows }))

import { getLiveListing, getLiveListingLeaves, getLiveListingRouteMetadata, getLiveProduct, getLiveBrandsForListing, getLiveProductByCategory, mapLiveProduct, searchLiveProducts } from './live-public-catalogue'

const product = {
  id: 42,
  sku: 'DPG-42',
  name: 'Vòi rửa chén',
  display_name: null,
  slug: 'voi-rua-chen-42',
  description: 'Mô tả sản phẩm',
  image_main_url: 'https://dpg-products.b-cdn.net/voi-rua-chen.jpg',
  is_featured: false,
  variant_group: null,
  variant_type: null,
  variant_label: null,
  category_name: 'Thiết bị bếp',
  category_slug: 'thiet-bi-bep',
  listing_name: 'Vòi rửa chén',
  listing_slug: 'voi-rua-chen',
  brand_name: null,
  brand_slug: null,
}

describe('Live public catalogue projection', () => {
  beforeEach(() => mocks.readPublicRows.mockReset())
  it('uses only public, active, PDP-visible products and listing-visible rows for PLPs', async () => {
    mocks.readPublicRows.mockResolvedValueOnce([{ ...product, total_count: '1' }])
    const listing = await getLiveListing('thiet-bi-bep', 'voi-rua-chen', 1)
    const [statement, values] = mocks.readPublicRows.mock.calls[0]
    expect(statement).toContain("p.publication_status='public'")
    expect(statement).toContain("p.pdp_visibility='public'")
    expect(statement).toContain("p.slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'")
    expect(statement).toContain('char_length(p.name)<=240')
    expect(statement).toContain('char_length(p.sku)<=120')
    expect(statement).toContain("c.slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'")
    expect(statement).toContain("s.slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'")
    expect(statement).toContain("p.listing_visibility IN ('default','low_priority')")
    expect(values).toEqual(['thiet-bi-bep', 'voi-rua-chen', 0, 48])
    expect(listing.totalCount).toBe(1)
    expect(listing.products[0]).toMatchObject({
      id: 42,
      price: null,
      price_display: 'Liên hệ báo giá',
      stock_status: 'contact',
    })
  })

  it('resolves PLP route metadata with one parameterized listing-scoped existence query', async () => {
    mocks.readPublicRows.mockResolvedValueOnce([{ categoryName: 'Thiết bị vệ sinh', listingName: 'Bồn cầu' }])
    await expect(getLiveListingRouteMetadata('thiet-bi-ve-sinh', 'bon-cau')).resolves.toEqual({
      categoryName: 'Thiết bị vệ sinh', listingName: 'Bồn cầu',
    })
    expect(mocks.readPublicRows).toHaveBeenCalledOnce()
    const [statement, values] = mocks.readPublicRows.mock.calls[0]
    expect(statement).toContain('FROM dpg_app.categories c')
    expect(statement).toContain('JOIN dpg_app.subcategories s')
    expect(statement).toContain('EXISTS (SELECT 1 FROM dpg_app.products p')
    expect(statement).toContain("p.publication_status='public'")
    expect(statement).toContain("p.pdp_visibility='public'")
    expect(statement).toContain("p.listing_visibility IN ('default','low_priority')")
    expect(statement).toContain('c.slug=$1 AND s.slug=$2')
    expect(statement).toContain('LIMIT 1')
    expect(statement).not.toContain('GROUP BY')
    expect(statement).not.toContain('SELECT DISTINCT')
    expect(values).toEqual(['thiet-bi-ve-sinh', 'bon-cau'])
  })

  it('loads one category of visible listing leaves without brands or first product pages', async () => {
    mocks.readPublicRows.mockResolvedValueOnce([{ slug: 'bon-cau', name: 'Bồn cầu', total_count: '145' }])
    await expect(getLiveListingLeaves('thiet-bi-ve-sinh')).resolves.toEqual([
      { slug: 'bon-cau', name: 'Bồn cầu', totalCount: 145 },
    ])
    expect(mocks.readPublicRows).toHaveBeenCalledOnce()
    const [statement, values] = mocks.readPublicRows.mock.calls[0]
    expect(statement).toContain('FROM dpg_app.categories c JOIN dpg_app.subcategories s')
    expect(statement).toContain('JOIN dpg_app.products p ON p.category_id=c.id AND p.subcategory_id=s.id')
    expect(statement).toContain("p.listing_visibility IN ('default','low_priority')")
    expect(statement).toContain('GROUP BY s.id,s.slug,s.name')
    expect(statement).not.toContain('LEFT JOIN dpg_app.brands')
    expect(statement).not.toContain('ORDER BY p.listing_priority')
    expect(values).toEqual(['thiet-bi-ve-sinh'])
  })

  it('returns no route metadata for unsupported categories or missing eligible listings', async () => {
    await expect(getLiveListingRouteMetadata('admin-users', 'private')).resolves.toBeNull()
    expect(mocks.readPublicRows).not.toHaveBeenCalled()
    mocks.readPublicRows.mockResolvedValueOnce([])
    await expect(getLiveListingRouteMetadata('thiet-bi-ve-sinh', 'unpublished-listing')).resolves.toBeNull()
    expect(mocks.readPublicRows).toHaveBeenCalledOnce()
  })

  it('keeps unapproved prices and remote image hosts out of Public projections', () => {
    const projected = mapLiveProduct({
      ...product,
      price: 1000,
      image_main_url: 'https://untrusted.example/image.jpg',
    } as typeof product)
    expect(projected.price).toBeNull()
    expect(projected.price_display).toBe('Liên hệ báo giá')
    expect(projected.stock_status).toBe('contact')
    expect(projected.image_main_url).toBeNull()
  })

  it('rewrites the legacy Bunny product hostname to its documented Pull Zone alias', () => {
    const projected = mapLiveProduct({
      ...product,
      image_main_url: 'https://cdn.dongphugia.com.vn/migrated/viglacera/item.webp',
    })
    expect(projected.image_main_url).toBe('https://dpg-products.b-cdn.net/migrated/viglacera/item.webp')
    expect(projected.publicContent?.gallery).toEqual([
      'https://dpg-products.b-cdn.net/migrated/viglacera/item.webp',
    ])
  })

  it('loads bounded PDP media and sanitized content with one parameterized read', async () => {
    mocks.readPublicRows.mockResolvedValueOnce([{
      ...product,
      image_main_url: 'https://cdn.dongphugia.com.vn/migrated/viglacera/item.webp',
      gallery_images: [{ image_url: 'https://cdn.dongphugia.com.vn/migrated/viglacera/gallery.webp' }],
      description_html: '<p>Chi tiết <img src="https://cdn.dongphugia.com.vn/migrated/viglacera/detail.webp"></p><script>bad()</script>',
      specifications: { 'Kích thước': '600 mm' },
      documents: [{ name: 'Hướng dẫn', url: 'https://cdn.dongphugia.com.vn/migrated/viglacera/manual.pdf', type: 'manual', size: 400 }],
      product_feature_values: [{ product_features: { name: 'Tiết kiệm nước' } }],
    }])
    const result = await getLiveProduct('thiet-bi-bep', 'voi-rua-chen', 'voi-rua-chen-42')
    const [statement, values] = mocks.readPublicRows.mock.calls[0]
    expect(statement).toContain('dpg_app.product_descriptions')
    expect(statement).toContain('dpg_app.product_documents')
    expect(statement).toContain('dpg_app.product_spec_values')
    expect(statement).toContain('LIMIT 12')
    expect(values).toEqual(['thiet-bi-bep', 'voi-rua-chen', 'voi-rua-chen-42'])
    expect(result?.publicContent).toMatchObject({
      descriptionHtml: '<p>Chi tiết <img src="https://dpg-products.b-cdn.net/migrated/viglacera/detail.webp" loading="lazy" /></p>',
      specifications: { 'Kích thước': '600 mm' },
      gallery: [
        'https://dpg-products.b-cdn.net/migrated/viglacera/item.webp',
        'https://dpg-products.b-cdn.net/migrated/viglacera/gallery.webp',
      ],
      documents: [{ name: 'Hướng dẫn', url: 'https://dpg-products.b-cdn.net/migrated/viglacera/manual.pdf', type: 'manual', size: '400' }],
    })
    expect(result?.product_feature_values).toEqual([{ product_features: { name: 'Tiết kiệm nước' } }])
  })

  it('looks up PDP slugs within one public category without scanning its listings', async () => {
    mocks.readPublicRows.mockResolvedValueOnce([{ ...product }])
    await getLiveProductByCategory('thiet-bi-bep', 'voi-rua-chen-42')
    const [statement, values] = mocks.readPublicRows.mock.calls[0]
    expect(statement).toContain("c.slug=$1 AND p.slug=$2")
    expect(statement).not.toContain('s.slug=$2')
    expect(values).toEqual(['thiet-bi-bep', 'voi-rua-chen-42'])
  })

  it('reads available brands with a bounded SQL query instead of paging every product', async () => {
    mocks.readPublicRows.mockResolvedValueOnce([{ slug: 'acme', name: 'Acme' }])
    await expect(getLiveBrandsForListing('thiet-bi-bep', 'voi-rua-chen'))
      .resolves.toEqual([{ slug: 'acme', name: 'Acme' }])
    const [statement, values] = mocks.readPublicRows.mock.calls[0]
    expect(statement).toContain('SELECT DISTINCT b.slug,b.name')
    expect(statement).toContain('b.is_active=true')
    expect(statement).toContain('LIMIT 32')
    expect(values).toEqual(['thiet-bi-bep', 'voi-rua-chen'])
  })

  it('allows search-only visibility in SKU search while binding the search value', async () => {
    mocks.readPublicRows.mockResolvedValueOnce([{ ...product, total_count: '1' }])
    const result = await searchLiveProducts('DPG-42', 1, 24)
    const [statement, values] = mocks.readPublicRows.mock.calls[0]
    expect(statement).toContain("p.search_visibility='visible'")
    expect(statement).not.toContain('listing_visibility')
    expect(values).toEqual(['%DPG-42%', 'DPG-42', 24, 0])
    expect(result.results[0]).toMatchObject({ sku: 'DPG-42', price: null, price_display: 'Liên hệ báo giá' })
  })
})
