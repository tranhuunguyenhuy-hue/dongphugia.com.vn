import { describe, expect, it } from 'vitest'
import { calculateOrderUnitPrice, getInstallationFee } from './order-pricing'

describe('order pricing', () => {
    it('uses sale price before list price and applies the database discount', () => {
        expect(calculateOrderUnitPrice({
            price: 1_000_000,
            salePrice: 900_000,
            onlineDiscountAmount: 50_000,
            installOption: 'none',
        })).toBe(850_000)
    })

    it('uses the shared installation fee table', () => {
        expect(getInstallationFee('install')).toBe(200_000)
        expect(getInstallationFee('replace')).toBe(350_000)
        expect(calculateOrderUnitPrice({
            price: 1_000_000,
            salePrice: null,
            onlineDiscountAmount: 50_000,
            installOption: 'install',
        })).toBe(1_150_000)
    })

    it('rejects missing prices and invalid discounts', () => {
        expect(calculateOrderUnitPrice({
            price: null,
            salePrice: null,
            onlineDiscountAmount: 0,
            installOption: 'none',
        })).toBeNull()
        expect(calculateOrderUnitPrice({
            price: 100_000,
            salePrice: null,
            onlineDiscountAmount: 150_000,
            installOption: 'none',
        })).toBeNull()
    })
})
