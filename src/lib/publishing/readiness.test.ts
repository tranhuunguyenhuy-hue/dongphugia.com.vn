import { describe, expect, it } from 'vitest'

import { validatePublicationReadiness } from './readiness'

const readyPost = {
    title: 'Hướng dẫn lựa chọn thiết bị vệ sinh phù hợp',
    excerpt:
        'Những tiêu chí thực tế giúp gia đình chọn thiết bị vệ sinh phù hợp và sử dụng bền lâu.',
    contentHtml: `<p>${'Nội dung tư vấn chuyên sâu '.repeat(16)}</p>`,
    categoryActive: true,
    tagsActive: true,
    thumbnailReady: true,
    coverReady: true,
    mediaReferencesValid: true,
}

describe('validatePublicationReadiness', () => {
    it('accepts a post that satisfies the objective publication gate', () => {
        expect(validatePublicationReadiness(readyPost)).toEqual([])
    })

    it('returns stable field errors for an incomplete post', () => {
        expect(
            validatePublicationReadiness({
                ...readyPost,
                title: 'Ngắn',
                excerpt: 'Quá ngắn',
                contentHtml: '<p>Quá ngắn</p>',
                categoryActive: false,
                thumbnailReady: false,
                coverReady: false,
            }),
        ).toEqual([
            { field: 'title', code: 'TITLE_LENGTH' },
            { field: 'excerpt', code: 'EXCERPT_LENGTH' },
            { field: 'content_html', code: 'VISIBLE_CONTENT_LENGTH' },
            { field: 'category_slug', code: 'CATEGORY_INACTIVE' },
            { field: 'thumbnail_media_id', code: 'THUMBNAIL_REQUIRED' },
            { field: 'cover_media_id', code: 'COVER_REQUIRED' },
        ])
    })
})
