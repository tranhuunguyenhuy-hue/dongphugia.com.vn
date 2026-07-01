import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Footer } from '../footer'

describe('Footer Component', () => {
    it('renders the brand description and logo alt text', () => {
        render(<Footer />)
        expect(screen.getByAltText('Đông Phú Gia - Đồng hành, Phát triển')).toBeInTheDocument()
        expect(screen.getByText(/Đăng ký nhận bản tin ưu đãi/i)).toBeInTheDocument()
    })

    it('renders all footer column headings', () => {
        render(<Footer />)
        expect(screen.getByText('Sản phẩm chính')).toBeInTheDocument()
        expect(screen.getByText('Về chúng tôi')).toBeInTheDocument()
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
        expect(screen.getByText(/Đông Phú Gia. All rights reserved./i)).toBeInTheDocument()
    })
})
