import { describe, expect, it } from 'vitest'

import {
    normalizePublishingMediaHtml,
    normalizePublishingMediaUrl,
} from './media-url'

describe('Publishing Managed Media URL compatibility', () => {
    it('maps the retired Production Bunny hostname to the current CDN', () => {
        expect(normalizePublishingMediaUrl(
            'https://dpg-publishing-production.b-cdn.net/publishing/identity/asset/cover.w1600.webp?width=1#hero',
        )).toBe(
            'https://cdn.dongphugia.com.vn/publishing/identity/asset/cover.w1600.webp?width=1#hero',
        )
    })

    it('leaves current, non-HTTPS, and malformed values unchanged', () => {
        expect(normalizePublishingMediaUrl('https://cdn.dongphugia.com.vn/publishing/asset.webp'))
            .toBe('https://cdn.dongphugia.com.vn/publishing/asset.webp')
        expect(normalizePublishingMediaUrl('http://dpg-publishing-production.b-cdn.net/publishing/asset.webp'))
            .toBe('http://dpg-publishing-production.b-cdn.net/publishing/asset.webp')
        expect(normalizePublishingMediaUrl('not a URL')).toBe('not a URL')
    })

    it('rewrites legacy URLs in sanitized article image markup', () => {
        expect(normalizePublishingMediaHtml(
            '<p>Text</p><img src="https://dpg-publishing-production.b-cdn.net/publishing/asset.webp" alt="Asset">',
        )).toContain('src="https://cdn.dongphugia.com.vn/publishing/asset.webp"')
    })
})
