import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CategoryListing } from '../category-listing'

describe('CategoryListing Component', () => {
    it('renders the section title correctly', () => {
        render(<CategoryListing />)
        expect(screen.getByRole('heading', { name: 'Danh mục sản phẩm' })).toBeInTheDocument()
        expect(screen.getByText('Đông Phú Gia')).toBeInTheDocument()
    })

    it('renders the Category cards', () => {
        render(<CategoryListing />)

        expect(screen.getByText('Gạch ốp lát')).toBeInTheDocument()
        expect(screen.getByText('Thiết bị vệ sinh')).toBeInTheDocument()
        expect(screen.getByText('Vật liệu nước')).toBeInTheDocument()
        expect(screen.getByText('Thiết bị bếp')).toBeInTheDocument()
    })

    it('renders a CTA for every active category', () => {
        render(<CategoryListing />)

        const xemTatCaElements = screen.getAllByText('Xem tất cả')
        expect(xemTatCaElements).toHaveLength(4)
    })
})
