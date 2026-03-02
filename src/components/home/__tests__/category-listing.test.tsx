import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { CategoryListing } from '../category-listing'

// Mock CATEGORIES since we only need to test the rendering
vi.mock('../category-listing', async () => {
    const actual = await vi.importActual('../category-listing')
    return {
        ...actual,
        // We don't necessarily need to mock the constant if it's exported, but rendering the component is the main goal.
        // The component uses an internal CATEGORIES constant.
    }
})

describe('CategoryListing Component', () => {
    it('renders the section title correctly', () => {
        render(<CategoryListing />)
        expect(screen.getByText(/Danh mục sản phẩm tại/i)).toBeInTheDocument()
        expect(screen.getByText('Đông Phú Gia')).toBeInTheDocument()
    })

    it('renders the Category cards', () => {
        render(<CategoryListing />)

        // Check for specific category titles based on the hardcoded data
        expect(screen.getByText('Gạch ốp lát')).toBeInTheDocument()
        expect(screen.getByText('Thiết bị vệ sinh')).toBeInTheDocument()
        expect(screen.getByText('Vật liệu nước')).toBeInTheDocument()
        expect(screen.getByText('Thiết bị bếp')).toBeInTheDocument()
        expect(screen.getByText('Sàn gỗ')).toBeInTheDocument()
    })

    it('renders CTA text correctly based on availability', () => {
        render(<CategoryListing />)

        // At least one 'Xem tất cả' and some 'Sắp có' should be present
        const xemTatCaElements = screen.getAllByText('Xem tất cả')
        expect(xemTatCaElements.length).toBeGreaterThan(0)

        const sapCoElements = screen.getAllByText('Sắp có')
        expect(sapCoElements.length).toBeGreaterThan(0)
    })
})
