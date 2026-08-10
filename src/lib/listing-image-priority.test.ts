import { describe, expect, it } from 'vitest'
import {
    MOBILE_LISTING_PRIORITY_CARD_COUNT,
    shouldPrioritizeListingCard,
} from './listing-image-priority'

describe('shouldPrioritizeListingCard', () => {
    it('eagerly loads the two cards visible in the first mobile listing row', () => {
        expect(MOBILE_LISTING_PRIORITY_CARD_COUNT).toBe(2)
        expect(shouldPrioritizeListingCard(0)).toBe(true)
        expect(shouldPrioritizeListingCard(1)).toBe(true)
        expect(shouldPrioritizeListingCard(2)).toBe(false)
    })

    it('does not prioritize invalid card indexes', () => {
        expect(shouldPrioritizeListingCard(-1)).toBe(false)
        expect(shouldPrioritizeListingCard(0.5)).toBe(false)
    })
})
