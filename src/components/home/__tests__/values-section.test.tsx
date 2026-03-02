import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ValuesSection } from '../values-section'

describe('ValuesSection Component', () => {
    it('renders all 4 value points', () => {
        render(<ValuesSection />)

        // Assert headings exist
        expect(screen.getByText('Giao hàng nhanh chóng')).toBeInTheDocument()
        expect(screen.getByText('Cam kết chính hãng 100%')).toBeInTheDocument()
        expect(screen.getByText('Lắp đặt chuyên nghiệp')).toBeInTheDocument()
        expect(screen.getByText('Giá tốt - báo giá minh bạch')).toBeInTheDocument()
    })

    it('renders the section title', () => {
        render(<ValuesSection />)
        expect(screen.getByText('Đồng Hành - Phát Triển')).toBeInTheDocument()
        expect(screen.getByText('Đông Phú Gia')).toBeInTheDocument()
    })
})
