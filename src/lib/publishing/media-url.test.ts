import { describe, expect, it } from 'vitest'

import {
    canonicalizePublishingMediaHtml,
    canonicalizePublishingMediaUrl,
    canonicalizePublishingMediaVariants,
    isPublishingMediaUrlAllowed,
    normalizePublishingMediaHtml,
    normalizePublishingMediaUrl,
    normalizePublishingMediaVariants,
    normalizePublicPublishingMediaHtml,
    normalizePublicPublishingMediaUrl,
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

    it('rejects unknown Managed Media hosts at the Publishing boundary', () => {
        expect(isPublishingMediaUrlAllowed('https://images.example.com/publishing/asset.webp'))
            .toBe(false)
        expect(canonicalizePublishingMediaUrl('https://images.example.com/publishing/asset.webp'))
            .toBeNull()
        expect(publishingMediaUrlCandidates('https://images.example.com/publishing/asset.webp'))
            .toEqual([])
        expect(publishingMediaUrlsMatch(
            'https://images.example.com/publishing/asset.webp',
            'https://images.example.com/publishing/asset.webp',
        )).toBe(false)
    })

    it('removes unknown hosts only when they use the reserved Managed Media path', () => {
        expect(normalizePublicPublishingMediaUrl('https://images.example.com/publishing/asset.webp'))
            .toBeNull()
        expect(normalizePublicPublishingMediaUrl('https://images.example.com/editorial/asset.webp'))
            .toBe('https://images.example.com/editorial/asset.webp')
        expect(normalizePublicPublishingMediaHtml(
            '<img src="https://images.example.com/publishing/asset.webp"><img src="https://images.example.com/editorial/asset.webp">',
        )).toBe('<img src="https://images.example.com/editorial/asset.webp">')
    })

    it('rewrites legacy URLs in sanitized article image markup', () => {
        expect(normalizePublishingMediaHtml(
            '<p>Text</p><img src="https://dpg-publishing-production.b-cdn.net/publishing/asset.webp" alt="Asset">',
        )).toContain('src="https://media.dongphugia.vn/publishing/asset.webp"')
    })

    it('removes unknown image hosts from API response HTML', () => {
        expect(() => canonicalizePublishingMediaHtml(
            '<img src="https://images.example.com/publishing/asset.webp">',
        )).toThrow('Stored Blog Post contains an unallowlisted image URL')
        expect(canonicalizePublishingMediaHtml(
            '<img src="https://dpg-publishing-production.b-cdn.net/publishing/asset.webp">',
        )).toBe('<img src="https://media.dongphugia.vn/publishing/asset.webp">')
    })

    it('canonicalizes legacy URLs in Managed Media variant responses', () => {
        expect(normalizePublishingMediaVariants([
            {
                url: 'https://dpg-publishing-production.b-cdn.net/publishing/asset.webp',
                width: 960,
            },
            { width: 320 },
        ])).toEqual([
            {
                url: 'https://media.dongphugia.vn/publishing/asset.webp',
                width: 960,
            },
            { width: 320 },
        ])
    })

    it('fails closed for unknown Managed Media variant hosts', () => {
        expect(canonicalizePublishingMediaVariants([
            { url: 'https://images.example.com/publishing/asset.webp' },
        ])).toBeNull()
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
