import { describe, expect, it } from 'vitest'
import { calculateOrderUnitPrice, getInstallationFee } from './order-pricing'

describe('order pricing', () => {
    it('uses canonical selling price and ignores online discount metadata', () => {
        expect(calculateOrderUnitPrice({
            listPrice: 1_000_000,
            originalPrice: null,
            salePrice: 900_000,
            compatibilityPrice: null,
            stockStatus: 'in_stock',
            installOption: 'none',
        })).toBe(900_000)
    })

    it('uses the shared installation fee table', () => {
        expect(getInstallationFee('install')).toBe(200_000)
        expect(getInstallationFee('replace')).toBe(350_000)
        expect(calculateOrderUnitPrice({
            listPrice: 1_000_000,
            originalPrice: null,
            salePrice: null,
            compatibilityPrice: null,
            stockStatus: 'in_stock',
            installOption: 'install',
        })).toBe(1_200_000)
    })

    it('rejects missing prices and invalid legacy-only price facts', () => {
        expect(calculateOrderUnitPrice({
            listPrice: null,
            originalPrice: null,
            salePrice: null,
            compatibilityPrice: null,
            stockStatus: 'in_stock',
            installOption: 'none',
        })).toBeNull()
        expect(calculateOrderUnitPrice({
            listPrice: null,
            originalPrice: 100_000,
            salePrice: null,
            compatibilityPrice: null,
            stockStatus: 'in_stock',
            installOption: 'none',
        })).toBeNull()
    })

    it('rejects an unmapped legacy availability even when it has a canonical price', () => {
        expect(calculateOrderUnitPrice({
            listPrice: 1_000_000,
            originalPrice: null,
            salePrice: null,
            compatibilityPrice: null,
            stockStatus: 'out_of_stock',
            installOption: 'none',
        })).toBeNull()
    })
})
