import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const navigation = vi.hoisted(() => ({ search: '' }))
vi.mock('next/navigation', () => ({
    useSearchParams: () => new URLSearchParams(navigation.search),
}))
vi.mock('@/components/ui/product-card', () => ({
    ProductCard: ({ product }: { product: { slug: string } }) => <div data-testid="product-card">{product.slug}</div>,
}))

import { CategoryRootFeaturedProducts } from './category-root-featured-products'
import type { ProductCardProps } from '@/components/ui/product-card'

const product = (id: number, slug: string, brandSlug: string): ProductCardProps['product'] => ({
    id,
    slug,
    brands: { slug: brandSlug },
    subcategories: { slug: 'voi-rua-chen' },
    url: `/thiet-bi-bep/voi-rua-chen/${slug}`,
} as ProductCardProps['product'])

describe('CategoryRootFeaturedProducts snapshot filtering', () => {
    it('shows the top eight products from the union of selected brands', () => {
        navigation.search = 'brands=brand-a%2Cbrand-b'
        const filtered = [
            ...Array.from({ length: 5 }, (_, index) => product(index + 1, `brand-a-${index + 1}`, 'brand-a')),
            ...Array.from({ length: 5 }, (_, index) => product(index + 6, `brand-b-${index + 1}`, 'brand-b')),
            product(11, 'brand-c-only', 'brand-c'),
        ]
        render(<CategoryRootFeaturedProducts
            basePath="/thiet-bi-bep"
            featuredProducts={[product(99, 'default-first', 'brand-c')]}
            filterableFeaturedProducts={filtered}
            featuredGridClassName="grid"
        />)

        expect(screen.getByText('8 sản phẩm')).toBeVisible()
        expect(screen.getAllByTestId('product-card')).toHaveLength(8)
        expect(screen.getByText('brand-a-1')).toBeVisible()
        expect(screen.getByText('brand-b-1')).toBeVisible()
        expect(screen.queryByText('brand-c-only')).toBeNull()
    })
})
