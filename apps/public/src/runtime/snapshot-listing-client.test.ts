import { describe, expect, it, vi } from 'vitest'
import {
    filterPublicSnapshotListing,
    isPublicSnapshotListingShard,
    parsePublicSnapshotListingFilters,
    PUBLIC_SNAPSHOT_LISTING_CONTRACT,
    PUBLIC_SNAPSHOT_LISTING_PAGE_SIZE,
    type PublicSnapshotListingProduct,
    type PublicSnapshotListingShard,
} from './snapshot-listing-contract'
import { loadPublicSnapshotListing, selectPublicSnapshotListingPage } from './snapshot-listing-client'

const checkpoint = 'a'.repeat(40)

function product(id: number, brand: string | null, featured: boolean): PublicSnapshotListingProduct {
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
        is_featured: featured,
        is_promotion: false,
        variant_options: [],
        categories: { name: 'Thiết Bị Bếp', slug: 'thiet-bi-bep' },
        subcategories: { name: 'Vòi rửa chén', slug: 'voi-rua-chen' },
        brands: brand ? { name: brand.toUpperCase(), slug: brand } : null,
        canonical_category_slug: 'thiet-bi-bep',
        canonical_subcategory_slug: 'voi-rua-chen',
        url: `/thiet-bi-bep/voi-rua-chen/san-pham-${id}`,
    }
}

function shard(page: number, all: PublicSnapshotListingProduct[], totalCount = all.length): PublicSnapshotListingShard {
    const totalPages = Math.ceil(totalCount / PUBLIC_SNAPSHOT_LISTING_PAGE_SIZE)
    return {
        contract: PUBLIC_SNAPSHOT_LISTING_CONTRACT,
        checkpoint,
        categorySlug: 'thiet-bi-bep',
        listingSlug: 'voi-rua-chen',
        page,
        pageSize: PUBLIC_SNAPSHOT_LISTING_PAGE_SIZE,
        totalCount,
        totalPages,
        products: all.slice((page - 1) * PUBLIC_SNAPSHOT_LISTING_PAGE_SIZE, page * PUBLIC_SNAPSHOT_LISTING_PAGE_SIZE),
    }
}

describe('public snapshot listing contract', () => {
    it('parses multi-brand OR and featured AND filters from direct URL state', () => {
        const filters = parsePublicSnapshotListingFilters(new URLSearchParams('brand=brand-a,brand-b&is_featured=true&page=2'))
        expect(filters).toEqual({ brands: ['brand-a', 'brand-b'], featured: true, page: 2 })

        const products = [
            product(1, 'brand-a', false),
            product(2, 'brand-a', true),
            product(3, 'brand-b', true),
            product(4, 'brand-c', true),
        ]
        expect(filterPublicSnapshotListing(products, filters!, 12)).toMatchObject({
            products: [],
            total: 2,
            totalPages: 1,
            page: 2,
            pageInRange: false,
        })
        expect(selectPublicSnapshotListingPage(
            { checkpoint, totalCount: products.length, products },
            { ...filters!, page: 1 },
            12,
        ).products).toEqual([products[1], products[2]])
    })

    it('rejects duplicate, unsupported, or over-cap filters instead of returning false no-results', () => {
        expect(parsePublicSnapshotListingFilters(new URLSearchParams('brand=a,a'))).toBeNull()
        expect(parsePublicSnapshotListingFilters(new URLSearchParams('brand=a&brand=b'))).toBeNull()
        expect(parsePublicSnapshotListingFilters(new URLSearchParams('brand=bad/slug'))).toBeNull()
        expect(parsePublicSnapshotListingFilters(new URLSearchParams('price=100-200'))).toBeNull()
        expect(parsePublicSnapshotListingFilters(new URLSearchParams('sort=price-asc'))).toBeNull()
        expect(parsePublicSnapshotListingFilters(new URLSearchParams('is_featured=false'))).toBeNull()
        const supportedCap = Array.from({ length: 32 }, (_, index) => `brand-${index}`).join(',')
        expect(parsePublicSnapshotListingFilters(new URLSearchParams(`brand=${supportedCap}`))?.brands).toHaveLength(32)
        const overCap = Array.from({ length: 33 }, (_, index) => `brand-${index}`).join(',')
        expect(parsePublicSnapshotListingFilters(new URLSearchParams(`brand=${overCap}`))).toBeNull()
    })

    it('rejects a shard with changed checkpoint, missing items, or price leakage', () => {
        const valid = shard(1, [product(1, 'brand-a', true)], 1)
        expect(isPublicSnapshotListingShard(valid, { categorySlug: 'thiet-bi-bep', listingSlug: 'voi-rua-chen', page: 1, checkpoint })).toBe(true)
        expect(isPublicSnapshotListingShard({ ...valid, checkpoint: 'b'.repeat(40) }, { checkpoint })).toBe(false)
        expect(isPublicSnapshotListingShard({ ...valid, products: [] })).toBe(false)
        expect(isPublicSnapshotListingShard({ ...valid, internalNote: 'hidden' })).toBe(false)
        expect(isPublicSnapshotListingShard({
            ...valid,
            products: [{ ...valid.products[0], sale_price: 100 }],
        })).toBe(false)
        expect(isPublicSnapshotListingShard({
            ...valid,
            products: [{ ...valid.products[0], brands: { name: 'Brand A', slug: 'brand-a', privateId: 7 } }],
        })).toBe(false)
    })
})

describe('public snapshot listing shard loader', () => {
    it('loads a bounded number of 48-item shards, checks one checkpoint, and preserves source order', async () => {
        const all = Array.from({ length: 433 }, (_, index) => product(index + 1, index % 2 ? 'brand-a' : 'brand-b', index % 3 === 0))
        let active = 0
        let maxActive = 0
        const requested: number[] = []
        const fetcher: typeof fetch = async (input) => {
            const url = new URL(String(input), 'https://preview.invalid')
            const page = Number(url.searchParams.get('page'))
            requested.push(page)
            active++
            maxActive = Math.max(maxActive, active)
            await new Promise((resolve) => setTimeout(resolve, 0))
            active--
            return Response.json(shard(page, all, all.length))
        }

        const loaded = await loadPublicSnapshotListing('thiet-bi-bep', 'voi-rua-chen', { fetcher })
        expect(loaded.checkpoint).toBe(checkpoint)
        expect(loaded.totalCount).toBe(433)
        expect(loaded.products.map((item) => item.id)).toEqual(all.map((item) => item.id))
        expect(requested[0]).toBe(1)
        expect(new Set(requested)).toEqual(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))
        expect(maxActive).toBeLessThanOrEqual(4)
        expect(maxActive).toBeGreaterThan(1)
    })

    it('fails closed when a later shard belongs to a different checkpoint', async () => {
        const all = Array.from({ length: 49 }, (_, index) => product(index + 1, 'brand-a', true))
        const fetcher = vi.fn(async (input: RequestInfo | URL) => {
            const page = Number(new URL(String(input), 'https://preview.invalid').searchParams.get('page'))
            const value = shard(page, all, all.length)
            if (page === 2) value.checkpoint = 'b'.repeat(40)
            return Response.json(value)
        })
        await expect(loadPublicSnapshotListing('thiet-bi-bep', 'voi-rua-chen', { fetcher })).rejects.toThrow('PUBLIC_LISTING_SHARD_INVALID')
    })

    it('fails closed on an incomplete later shard instead of returning a false empty page', async () => {
        const all = Array.from({ length: 49 }, (_, index) => product(index + 1, 'brand-a', true))
        const fetcher = vi.fn(async (input: RequestInfo | URL) => {
            const page = Number(new URL(String(input), 'https://preview.invalid').searchParams.get('page'))
            const value = shard(page, all)
            if (page === 2) value.products = []
            return Response.json(value)
        })
        await expect(loadPublicSnapshotListing('thiet-bi-bep', 'voi-rua-chen', { fetcher })).rejects.toThrow('PUBLIC_LISTING_SHARD_INVALID')
    })
})
