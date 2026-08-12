import { describe, expect, it } from 'vitest'
import { calculateOrderUnitPrice, getInstallationFee } from './order-pricing'

describe('order pricing', () => {
    it('uses sale price before list price and applies the database discount', () => {
        expect(calculateOrderUnitPrice({
            originalPrice: 1_000_000,
            salePrice: 900_000,
            compatibilityPrice: null,
            stockStatus: 'in_stock',
            onlineDiscountAmount: 50_000,
            installOption: 'none',
        })).toBe(850_000)
    })

    it('uses the shared installation fee table', () => {
        expect(getInstallationFee('install')).toBe(200_000)
        expect(getInstallationFee('replace')).toBe(350_000)
        expect(calculateOrderUnitPrice({
            originalPrice: 1_000_000,
            salePrice: null,
            compatibilityPrice: null,
            stockStatus: 'in_stock',
            onlineDiscountAmount: 50_000,
            installOption: 'install',
        })).toBe(1_150_000)
    })

    it('rejects missing prices and invalid discounts', () => {
        expect(calculateOrderUnitPrice({
            originalPrice: null,
            salePrice: null,
            compatibilityPrice: null,
            stockStatus: 'in_stock',
            onlineDiscountAmount: 0,
            installOption: 'none',
        })).toBeNull()
        expect(calculateOrderUnitPrice({
            originalPrice: 100_000,
            salePrice: null,
            compatibilityPrice: null,
            stockStatus: 'in_stock',
            onlineDiscountAmount: 150_000,
            installOption: 'none',
        })).toBeNull()
    })

    it('rejects an out-of-stock product even when it has a public price', () => {
        expect(calculateOrderUnitPrice({
            originalPrice: 1_000_000,
            salePrice: null,
            compatibilityPrice: null,
            stockStatus: 'out_of_stock',
            onlineDiscountAmount: 0,
            installOption: 'none',
        })).toBeNull()
    })
})
