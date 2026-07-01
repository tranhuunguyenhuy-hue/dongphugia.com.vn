import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Footer } from '../footer'

describe('Footer Component', () => {
    it('renders the brand description and logo alt text', () => {
        render(<Footer />)
        expect(screen.getByAltText('Đông Phú Gia')).toBeInTheDocument()
        expect(screen.getByText(/Nhà phân phối vật liệu xây dựng và nội thất cao cấp tại Lâm Đồng/i)).toBeInTheDocument()
    })

    it('renders all footer column headings', () => {
        render(<Footer />)
        expect(screen.getByText('Danh mục')).toBeInTheDocument()
        expect(screen.getByText('Chính sách')).toBeInTheDocument()
        expect(screen.getByText('Liên hệ')).toBeInTheDocument()
    })

    it('renders the contact information', () => {
        render(<Footer />)
        expect(screen.getByText(/273–275 Phan Đình Phùng/i)).toBeInTheDocument()
        expect(screen.getByText('094 9349 949 - 094 5343 494')).toBeInTheDocument()
        expect(screen.getByText('0855 528 688')).toBeInTheDocument()
        expect(screen.getByText('www.dongphugia.com.vn')).toBeInTheDocument()
    })

    it('renders the copyright text', () => {
        render(<Footer />)
        expect(screen.getByText(/Công ty TNHH Đông Phú Gia. All rights reserved./i)).toBeInTheDocument()
    })
})
