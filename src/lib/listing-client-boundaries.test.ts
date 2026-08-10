import { describe, expect, it } from 'vitest'
import { hasActiveListingFilterParams } from './listing-client-boundaries'

describe('toilet listing client boundaries', () => {
    it('does not mount active filters for the initial unfiltered listing', () => {
        expect(hasActiveListingFilterParams({})).toBe(false)
        expect(hasActiveListingFilterParams({ page: '2', sort: 'price-asc' })).toBe(false)
    })

    it('keeps active filters available whenever a product filter is present', () => {
        expect(hasActiveListingFilterParams({ brand: 'inax' })).toBe(true)
        expect(hasActiveListingFilterParams({ sf_flush: 'dual' })).toBe(true)
        expect(hasActiveListingFilterParams({ is_featured: 'true' })).toBe(true)
    })
})
