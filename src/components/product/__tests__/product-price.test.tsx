import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProductPrice } from '../product-price'

describe('ProductPrice', () => {
    it('shows only the online discount amount, not the calculated final price', () => {
        render(
            <ProductPrice
                price={10_000_000}
                originalPrice={12_000_000}
                priceDisplay={null}
                onlineDiscountAmount={500_000}
            />
        )

        expect(screen.getByText('Giảm thêm')).toBeInTheDocument()
        expect(screen.getByText('500.000đ')).toBeInTheDocument()
        expect(screen.getByText('khi đặt Online')).toBeInTheDocument()
        expect(screen.queryByText('Giá chỉ còn:')).not.toBeInTheDocument()
        expect(screen.queryByText('9.500.000đ')).not.toBeInTheDocument()
    })

    it('does not show the online discount card without a valid discount', () => {
        render(
            <ProductPrice
                price={10_000_000}
                originalPrice={null}
                priceDisplay={null}
                onlineDiscountAmount={0}
            />
        )

        expect(screen.queryByText('Độc quyền đặt Online')).not.toBeInTheDocument()
    })
})
