import { describe, expect, it } from 'vitest'

import {
    PublishingHtmlValidationError,
    sanitizePublishingHtml,
} from './html'

describe('sanitizePublishingHtml', () => {
    it('normalizes an allowlisted external HTTPS link with safe attributes', () => {
        const result = sanitizePublishingHtml(
            '<p>Xem <a href="https://example.com/source">nguồn</a>.</p>',
            {
                externalLinkHostnames: new Set(['example.com']),
                internalLinkHostnames: new Set(['www.dongphugia.vn']),
                managedImageUrls: new Set(),
            },
        )

        expect(result).toBe(
            '<p>Xem <a href="https://example.com/source" target="_blank" rel="noopener noreferrer nofollow">nguồn</a>.</p>',
        )
    })

    it('rejects a subdomain when only the parent hostname is allowlisted', () => {
        expect(() =>
            sanitizePublishingHtml(
                '<p><a href="https://news.example.com/source">nguồn</a></p>',
                {
                    externalLinkHostnames: new Set(['example.com']),
                    internalLinkHostnames: new Set(['www.dongphugia.vn']),
                    managedImageUrls: new Set(),
                },
            ),
        ).toThrowError(
            new PublishingHtmlValidationError(
                'EXTERNAL_LINK_HOST_NOT_ALLOWED',
                'External link hostname is not allowed',
            ),
        )
    })

    it('rejects unsupported markup instead of silently dropping it', () => {
        expect(() =>
            sanitizePublishingHtml('<p>Nội dung</p><script>alert(1)</script>', {
                externalLinkHostnames: new Set(),
                internalLinkHostnames: new Set(['www.dongphugia.vn']),
                managedImageUrls: new Set(),
            }),
        ).toThrowError(
            new PublishingHtmlValidationError(
                'HTML_TAG_NOT_ALLOWED',
                'HTML tag is not allowed: script',
            ),
        )
    })

    it('rejects unsupported attributes instead of silently dropping them', () => {
        expect(() =>
            sanitizePublishingHtml('<p onclick="alert(1)">Nội dung</p>', {
                externalLinkHostnames: new Set(),
                internalLinkHostnames: new Set(['www.dongphugia.vn']),
                managedImageUrls: new Set(),
            }),
        ).toThrowError(
            new PublishingHtmlValidationError(
                'HTML_ATTRIBUTE_NOT_ALLOWED',
                'HTML attribute is not allowed: p.onclick',
            ),
        )
    })

    it('keeps semantic editorial markup and normalizes managed images', () => {
        const mediaUrl =
            'https://media.dongphugia.vn/publishing/agent/asset/inline.editorial.w960.webp'

        expect(
            sanitizePublishingHtml(
                `<h2>Tiêu đề</h2><ul><li><strong>Nội dung</strong></li></ul><figure><img src="${mediaUrl}" alt="Mô tả"><figcaption>Chú thích</figcaption></figure>`,
                {
                    externalLinkHostnames: new Set(),
                    internalLinkHostnames: new Set(['www.dongphugia.vn']),
                    managedImageUrls: new Set([mediaUrl]),
                },
            ),
        ).toBe(
            `<h2>Tiêu đề</h2><ul><li><strong>Nội dung</strong></li></ul><figure><img src="${mediaUrl}" alt="Mô tả" loading="lazy" decoding="async" /><figcaption>Chú thích</figcaption></figure>`,
        )
    })

    it('rejects an image that is not managed by the calling integration', () => {
        expect(() =>
            sanitizePublishingHtml(
                '<p><img src="https://cdn.dongphugia.com.vn/other.jpg" alt="Ảnh"></p>',
                {
                    externalLinkHostnames: new Set(),
                    internalLinkHostnames: new Set(['www.dongphugia.vn']),
                    managedImageUrls: new Set(),
                },
            ),
        ).toThrowError(
            new PublishingHtmlValidationError(
                'MEDIA_REFERENCE_NOT_MANAGED',
                'Image must reference integration-owned Managed Media',
            ),
        )
    })

    it('does not treat a backslash-based external URL as an internal path', () => {
        expect(() =>
            sanitizePublishingHtml('<p><a href="/\\\\evil.example/path">x</a></p>', {
                externalLinkHostnames: new Set(),
                internalLinkHostnames: new Set(['www.dongphugia.vn']),
                managedImageUrls: new Set(),
            }),
        ).toThrowError(
            new PublishingHtmlValidationError(
                'LINK_URL_INVALID',
                'Internal link URL is invalid',
            ),
        )
    })
})
