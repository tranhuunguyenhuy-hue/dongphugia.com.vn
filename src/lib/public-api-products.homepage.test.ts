import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }))

vi.mock('next/cache', () => ({
    unstable_cache: <T>(fn: T) => fn,
}))

vi.mock('@/lib/prisma', () => ({
    default: {
        products: { findMany },
    },
}))

import { getHomepageSanitaryProducts } from './public-api-products'

const rankingProduct = (overrides: Record<string, unknown>) => ({
    id: 1,
    is_featured: false,
    sort_order: 0,
    created_at: new Date('2026-08-01T00:00:00.000Z'),
    variant_group: null,
    product_type: null,
    product_sub_type: null,
    subcategories: { slug: 'bon-cau' },
    secondary_subcategories: [],
    product_types: null,
    product_sub_types: null,
    product_taxon_assignments: [],
    ...overrides,
})

const card = (id: number, slug: string) => ({
    id,
    name: slug,
    display_name: null,
    sku: `SKU-${id}`,
    slug,
    price: null,
    original_price: null,
    online_discount_amount: null,
    price_display: null,
    image_main_url: null,
    is_featured: false,
    is_promotion: false,
    stock_status: 'in_stock',
    categories: { slug: 'thiet-bi-ve-sinh' },
    subcategories: { name: 'Bồn cầu', slug: 'bon-cau' },
    brands: null,
    colors: null,
    product_taxon_assignments: [],
    product_feature_values: [],
})

describe('getHomepageSanitaryProducts', () => {
    beforeEach(() => findMany.mockReset())

    it('uses a minimal ranking query then a bounded card-payload query in ranked order', async () => {
        findMany
            .mockResolvedValueOnce([
                rankingProduct({ id: 10, variant_group: 'small', sort_order: 1 }),
                rankingProduct({ id: 11, variant_group: 'large', sort_order: 1 }),
                rankingProduct({ id: 12, variant_group: 'large', sort_order: 2 }),
            ])
            .mockResolvedValueOnce([card(10, 'small-representative'), card(12, 'large-representative')])

        const result = await getHomepageSanitaryProducts(2)

        expect(findMany).toHaveBeenCalledTimes(2)
        const rankingQuery = findMany.mock.calls[0][0]
        const cardQuery = findMany.mock.calls[1][0]
        expect(rankingQuery.select).toMatchObject({
            id: true,
            variant_group: true,
            subcategories: { select: { slug: true } },
            secondary_subcategories: expect.any(Object),
            product_taxon_assignments: expect.any(Object),
        })
        expect(rankingQuery.select).not.toHaveProperty('image_main_url')
        expect(rankingQuery.select).not.toHaveProperty('product_feature_values')
        expect(cardQuery).toMatchObject({
            where: { id: { in: [12, 10] } },
            take: 2,
            select: { image_main_url: true, product_feature_values: expect.any(Object) },
        })
        expect(result.products.map((product) => product.id)).toEqual([12, 10])
        expect(result.total).toBe(3)
    })
})
