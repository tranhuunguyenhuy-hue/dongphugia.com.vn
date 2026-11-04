import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Footer } from '../footer'

describe('Footer Component', () => {
    it('renders the brand and real contact actions without a newsletter signup', () => {
        render(<Footer />)
        expect(screen.getByAltText('Đông Phú Gia - Đồng hành, Phát triển')).toBeInTheDocument()
        expect(screen.getByText('Liên hệ tư vấn')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Gọi tư vấn' })).toHaveAttribute('href', 'tel:0949349949')
        expect(screen.getByRole('link', { name: 'Nhắn Zalo' })).toHaveAttribute('href', 'https://zalo.me/0855528688')
        expect(screen.queryByRole('textbox', { name: 'Nhập email của bạn' })).not.toBeInTheDocument()
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
        expect(screen.getByText('www.dongphugia.vn')).toBeInTheDocument()
    })

    it('renders the copyright text', () => {
        render(<Footer />)
        expect(screen.getByText(/Đông Phú Gia. All rights reserved./i)).toBeInTheDocument()
    })
})
