import { describe, expect, it } from 'vitest'

import {
    extractBlogEditorialImageReferences,
    normalizeHumanBlogEditorialMedia,
    replaceBlogEditorialMediaReferences,
} from './blog-editorial-media'

describe('blog editorial media boundaries', () => {
    it('collects cover, thumbnail, inline and srcset references without duplicates', () => {
        expect(extractBlogEditorialImageReferences({
            content: '<img src="https://example.test/a.jpg" srcset="https://example.test/a.jpg 1x, https://example.test/b.jpg 2x">',
            thumbnailUrl: 'https://example.test/a.jpg',
            coverImageUrl: 'https://example.test/c.jpg',
        })).toEqual([
            'https://example.test/a.jpg',
            'https://example.test/c.jpg',
            'https://example.test/b.jpg',
        ])
    })

    it('rewrites only image references and preserves surrounding HTML', () => {
        const result = replaceBlogEditorialMediaReferences({
            content: '<p><a href="https://source.test">source</a></p><img src="https://example.test/a.jpg" srcset="https://example.test/a.jpg 1x, https://example.test/b.jpg 2x">',
            thumbnailUrl: 'https://example.test/a.jpg',
            coverImageUrl: null,
        }, new Map([
            ['https://example.test/a.jpg', 'https://media.dongphugia.vn/publishing/a.webp'],
            ['https://example.test/b.jpg', 'https://media.dongphugia.vn/publishing/b.webp'],
        ]))

        expect(result.content).toContain('href="https://source.test"')
        expect(result.content).toContain('src="https://media.dongphugia.vn/publishing/a.webp"')
        expect(result.content).toContain('srcset="https://media.dongphugia.vn/publishing/a.webp 1x, https://media.dongphugia.vn/publishing/b.webp 2x"')
        expect(result.thumbnailUrl).toBe('https://media.dongphugia.vn/publishing/a.webp')
    })

    it('canonicalizes ready legacy Managed Media while rejecting unknown images', async () => {
        const transaction = {
            product_images: { findMany: async () => [] },
            products: { findMany: async () => [] },
            publishing_managed_media: {
                findMany: async () => [{
                    id: '00000000-0000-4000-8000-000000000001',
                    purpose: 'inline',
                    primary_url: 'https://dpg-publishing-staging.b-cdn.net/publishing/a.webp',
                    status: 'ready',
                }],
            },
        }
        const normalized = await normalizeHumanBlogEditorialMedia(transaction as never, {
            content: '<img src="https://dpg-publishing-staging.b-cdn.net/publishing/a.webp">',
            thumbnailUrl: null,
            coverImageUrl: null,
        })
        expect(normalized.content).toContain('https://media.dongphugia.vn/publishing/a.webp')

        await expect(normalizeHumanBlogEditorialMedia(transaction as never, {
            content: '<img src="https://untrusted.example/a.webp">',
            thumbnailUrl: null,
            coverImageUrl: null,
        })).rejects.toThrow('ready Managed Media')
    })
})
