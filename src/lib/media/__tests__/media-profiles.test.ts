import { describe, expect, it } from 'vitest'
import {
    createMediaFileName,
    createResponsiveMediaUrl,
    createResponsiveSrcSet,
    getMediaProfileFromUrl,
    isMediaProfile,
} from '@/lib/media/media-profiles'

describe('media profiles', () => {
    it('accepts only supported profiles', () => {
        expect(isMediaProfile('product')).toBe(true)
        expect(isMediaProfile('editorial')).toBe(true)
        expect(isMediaProfile('hero')).toBe(true)
        expect(isMediaProfile('avatar')).toBe(false)
        expect(isMediaProfile(null)).toBe(false)
    })

    it('uses a deterministic variant file name', () => {
        expect(createMediaFileName('asset-1', 'hero', 1280)).toBe(
            'asset-1.hero.w1280.webp',
        )
    })

    it('derives responsive variants only for optimized URLs', () => {
        const url =
            'https://cdn.dongphugia.com.vn/products/item.product.w640.webp'

        expect(getMediaProfileFromUrl(url)).toBe('product')
        expect(createResponsiveMediaUrl(url, 320)).toContain(
            'item.product.w320.webp',
        )
        expect(createResponsiveSrcSet(url)).toBe(
            [
                'https://cdn.dongphugia.com.vn/products/item.product.w320.webp 320w',
                'https://cdn.dongphugia.com.vn/products/item.product.w640.webp 640w',
            ].join(', '),
        )
        expect(createResponsiveSrcSet('https://example.com/legacy.jpg')).toBe(
            undefined,
        )
    })

    it('does not mix variants from a different profile', () => {
        const url =
            'https://cdn.dongphugia.com.vn/banners/item.hero.w1600.webp'
        expect(createResponsiveSrcSet(url, 'product')).toBeUndefined()
    })
})
