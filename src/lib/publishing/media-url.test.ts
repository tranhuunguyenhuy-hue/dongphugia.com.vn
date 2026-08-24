import { describe, expect, it } from 'vitest'

import {
    normalizePublishingMediaHtml,
    normalizePublishingMediaUrl,
    publishingMediaUrlCandidates,
    publishingMediaUrlsMatch,
} from './media-url'

describe('Publishing Managed Media URL compatibility', () => {
    it('uses the configured non-legacy hostname as the canonical destination', () => {
        const original = process.env.PUBLISHING_BUNNY_CDN_HOSTNAME
        process.env.PUBLISHING_BUNNY_CDN_HOSTNAME = 'media.example.com'
        try {
            expect(normalizePublishingMediaUrl(
                'https://dpg-publishing-production.b-cdn.net/publishing/asset.webp',
            )).toBe('https://media.example.com/publishing/asset.webp')
        } finally {
            if (original === undefined) delete process.env.PUBLISHING_BUNNY_CDN_HOSTNAME
            else process.env.PUBLISHING_BUNNY_CDN_HOSTNAME = original
        }
    })

    it('maps retired Production and Staging Bunny hostnames to the current CDN', () => {
        expect(normalizePublishingMediaUrl(
            'https://dpg-publishing-production.b-cdn.net/publishing/identity/asset/cover.w1600.webp?width=1#hero',
        )).toBe(
            'https://media.dongphugia.vn/publishing/identity/asset/cover.w1600.webp?width=1#hero',
        )
        expect(normalizePublishingMediaUrl(
            'https://dpg-publishing-staging.b-cdn.net/publishing/identity/asset/cover.w1600.webp',
        )).toBe(
            'https://media.dongphugia.vn/publishing/identity/asset/cover.w1600.webp',
        )
    })

    it('leaves current, non-HTTPS, and malformed values unchanged', () => {
        expect(normalizePublishingMediaUrl('https://media.dongphugia.vn/publishing/asset.webp'))
            .toBe('https://media.dongphugia.vn/publishing/asset.webp')
        expect(normalizePublishingMediaUrl('http://dpg-publishing-production.b-cdn.net/publishing/asset.webp'))
            .toBe('http://dpg-publishing-production.b-cdn.net/publishing/asset.webp')
        expect(normalizePublishingMediaUrl('not a URL')).toBe('not a URL')
    })

    it('rewrites legacy URLs in sanitized article image markup', () => {
        expect(normalizePublishingMediaHtml(
            '<p>Text</p><img src="https://dpg-publishing-production.b-cdn.net/publishing/asset.webp" alt="Asset">',
        )).toContain('src="https://media.dongphugia.vn/publishing/asset.webp"')
    })

    it('returns raw and canonical candidates for legacy persisted media', () => {
        expect(publishingMediaUrlCandidates(
            'https://dpg-publishing-staging.b-cdn.net/publishing/asset.webp',
        )).toEqual([
            'https://dpg-publishing-staging.b-cdn.net/publishing/asset.webp',
            'https://media.dongphugia.vn/publishing/asset.webp',
            'https://dpg-publishing-production.b-cdn.net/publishing/asset.webp',
        ])
    })

    it('treats a legacy and canonical URL as the same managed asset', () => {
        expect(publishingMediaUrlsMatch(
            'https://dpg-publishing-staging.b-cdn.net/publishing/asset.webp',
            'https://media.dongphugia.vn/publishing/asset.webp',
        )).toBe(true)
        expect(publishingMediaUrlsMatch(
            'https://media.dongphugia.vn/publishing/asset.webp',
            'https://media.dongphugia.vn/publishing/other.webp',
        )).toBe(false)
    })

    it('includes legacy aliases when a client submits a canonical URL', () => {
        expect(publishingMediaUrlCandidates(
            'https://media.dongphugia.vn/publishing/asset.webp',
        )).toEqual([
            'https://media.dongphugia.vn/publishing/asset.webp',
            'https://dpg-publishing-production.b-cdn.net/publishing/asset.webp',
            'https://dpg-publishing-staging.b-cdn.net/publishing/asset.webp',
        ])
    })
})
