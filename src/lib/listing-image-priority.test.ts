import { describe, expect, it } from 'vitest'
import {
    getAboveFoldListingImageSources,
    LISTING_PRODUCT_IMAGE_SIZES,
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

    it('preloads only the two above-fold card resources without duplicates', () => {
        expect(getAboveFoldListingImageSources([
            { image_main_url: 'https://cdn.example.com/one.jpg' },
            { images: JSON.stringify(['https://cdn.example.com/two.jpg']) },
            { thumbnail: 'https://cdn.example.com/three.jpg' },
        ])).toEqual([
            'https://cdn.example.com/one.jpg',
            'https://cdn.example.com/two.jpg',
        ])

        expect(getAboveFoldListingImageSources([
            { image_main_url: 'https://cdn.example.com/one.jpg' },
            { thumbnail: 'https://cdn.example.com/one.jpg' },
            { thumbnail: 'https://cdn.example.com/three.jpg' },
        ])).toEqual(['https://cdn.example.com/one.jpg'])
        expect(LISTING_PRODUCT_IMAGE_SIZES).toBe(
            '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw',
        )
    })
})
