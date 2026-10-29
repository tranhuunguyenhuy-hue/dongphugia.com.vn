import { beforeEach, describe, expect, it, vi } from 'vitest'

const checkpoint = 'a'.repeat(40)
const mocks = vi.hoisted(() => ({ readManifest: vi.fn(), getProducts: vi.fn(), getCheckpoint: vi.fn() }))

vi.mock('./public-snapshot-mode', () => ({ publicSnapshotCheckpoint: mocks.getCheckpoint }))
vi.mock('./public-snapshot-catalogue', () => ({
    readSnapshotManifest: mocks.readManifest,
    getSnapshotProducts: mocks.getProducts,
}))

import { getPublicSnapshotListingShard } from './public-snapshot-listing'

function product(id: number) {
    return {
        id,
        name: `Vòi rửa chén ${id}`,
        display_name: `Vòi rửa chén ${id}`,
        slug: `voi-rua-chen-${id}`,
        sku: `SKU-${id}`,
        price: null,
        price_display: 'Liên hệ báo giá',
        stock_status: 'contact',
        image_main_url: 'https://dpg-products.b-cdn.net/products/image.webp',
        is_active: true,
        is_featured: id % 2 === 0,
        is_promotion: false,
        variant_options: [],
        categories: { name: 'Thiết Bị Bếp', slug: 'thiet-bi-bep' },
        subcategories: { name: 'Vòi rửa chén', slug: 'voi-rua-chen' },
        brands: { name: 'Brand A', slug: 'brand-a' },
        canonical_category_slug: 'thiet-bi-bep',
        canonical_subcategory_slug: 'voi-rua-chen',
        url: `/thiet-bi-bep/voi-rua-chen/voi-rua-chen-${id}`,
    }
}

describe('public snapshot listing shard projection', () => {
    beforeEach(() => {
        mocks.readManifest.mockReset()
        mocks.getProducts.mockReset()
        mocks.getCheckpoint.mockReset().mockReturnValue(checkpoint)
        mocks.readManifest.mockResolvedValue({
            categories: [{
                slug: 'thiet-bi-bep',
                listings: [{ slug: 'voi-rua-chen', name: 'Vòi rửa chén', totalCount: 49 }],
            }],
        })
    })

    it('serves the typed public shard and keeps prices and promotions withheld', async () => {
        mocks.getProducts.mockResolvedValue({ products: [product(49)], totalCount: 49, page: 2 })
        const shard = await getPublicSnapshotListingShard('thiet-bi-bep', 'voi-rua-chen', 2)
        expect(shard).toMatchObject({
            contract: 'dpg:public-catalogue-listing-shard:v1',
            checkpoint,
            categorySlug: 'thiet-bi-bep',
            listingSlug: 'voi-rua-chen',
            page: 2,
            pageSize: 48,
            totalCount: 49,
            totalPages: 2,
            products: [{ id: 49, price: null, price_display: 'Liên hệ báo giá', stock_status: 'contact', is_promotion: false }],
        })
        expect(Object.keys(shard!.products[0])).not.toContain('publicContent')
        expect(Object.keys(shard!.products[0])).not.toContain('sale_price')
    })

    it('returns not-found for absent category/listing and out-of-range shard pages', async () => {
        mocks.getProducts.mockResolvedValue({ products: [], totalCount: 49, page: 3 })
        expect(await getPublicSnapshotListingShard('thiet-bi-bep', 'voi-rua-chen', 3)).toBeNull()
        expect(await getPublicSnapshotListingShard('unknown-category', 'voi-rua-chen', 1)).toBeNull()
        expect(mocks.getProducts).not.toHaveBeenCalled()
    })

    it.each([
        ['wrong total count', { products: [product(49)], totalCount: 48, page: 2 }],
        ['wrong page', { products: [product(49)], totalCount: 49, page: 1 }],
        ['wrong shard size', { products: [], totalCount: 49, page: 2 }],
        ['unexpected snapshot fields', { products: [{ ...product(49), publicContent: { summary: 'unexpected' } }], totalCount: 49, page: 2 }],
        ['unexpected nested taxonomy fields', { products: [{ ...product(49), categories: { ...product(49).categories, privateId: 7 } }], totalCount: 49, page: 2 }],
    ])('fails closed on %s', async (_label, source) => {
        mocks.getProducts.mockResolvedValue(source)
        await expect(getPublicSnapshotListingShard('thiet-bi-bep', 'voi-rua-chen', 2)).rejects.toThrow('PUBLIC_CATALOGUE_UNAVAILABLE')
    })

    it('fails closed when listing metadata exceeds the bounded shard contract', async () => {
        mocks.readManifest.mockResolvedValue({
            categories: [{ slug: 'thiet-bi-bep', listings: [{ slug: 'voi-rua-chen', totalCount: 48 * 65 }] }],
        })
        await expect(getPublicSnapshotListingShard('thiet-bi-bep', 'voi-rua-chen', 1)).rejects.toThrow('PUBLIC_CATALOGUE_UNAVAILABLE')
        expect(mocks.getProducts).not.toHaveBeenCalled()
    })
})
