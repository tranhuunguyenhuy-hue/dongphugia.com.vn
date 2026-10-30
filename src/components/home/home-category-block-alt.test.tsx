import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
    default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
        <a href={href} {...props}>{children}</a>
    ),
}))
vi.mock('@/components/media/brand-logo', () => ({ BrandLogo: () => <span aria-hidden="true" /> }))
vi.mock('@/components/ui/product-card', () => ({ ProductCard: () => null }))

import { HomeCategoryBlockAlt } from './home-category-block-alt'

describe('HomeCategoryBlockAlt brand links', () => {
    it('links with the canonical brand slug rather than the display name', () => {
        render(<HomeCategoryBlockAlt categoryData={{
            id: 'bathroom',
            label: 'thiết bị vệ sinh',
            basePath: '/thiet-bi-ve-sinh',
            products: [],
            availableBrands: [{ name: 'TOTO', slug: 'toto' }],
        }} />)

        expect(screen.getByRole('link', { name: 'Xem thiết bị vệ sinh thương hiệu TOTO' }))
            .toHaveAttribute('href', '/thiet-bi-ve-sinh?brands=toto')
    })
})
