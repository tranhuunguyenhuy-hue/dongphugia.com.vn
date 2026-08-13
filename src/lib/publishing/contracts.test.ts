import { describe, expect, it } from 'vitest'

import {
    parseExternalPostId,
    parsePostMutation,
    normalizePostSlug,
} from './contracts'

describe('Publishing API post contract', () => {
    it('parses a scheduled mutation without accepting server-owned fields', () => {
        expect(
            parsePostMutation({
                title: 'Hướng dẫn chọn thiết bị vệ sinh',
                excerpt: 'Bản nháp nội dung',
                content_html: '<p>Nội dung</p>',
                category_slug: 'kien-thuc',
                tag_slugs: ['phong-tam'],
                publication: {
                    mode: 'scheduled',
                    publish_at: '2026-08-20T08:00:00+07:00',
                    publication_timezone: 'Asia/Ho_Chi_Minh',
                },
            }).publication,
        ).toEqual({
            mode: 'scheduled',
            publish_at: '2026-08-20T08:00:00+07:00',
            publication_timezone: 'Asia/Ho_Chi_Minh',
        })

        expect(() =>
            parsePostMutation({
                title: 'Hướng dẫn chọn thiết bị vệ sinh',
                content_html: '',
                category_slug: 'kien-thuc',
                author_name: 'Agent',
                publication: { mode: 'draft' },
            }),
        ).toThrowError(expect.objectContaining({ code: 'PAYLOAD_INVALID' }))
    })

    it('normalizes a proposed Vietnamese slug without adding a collision suffix', () => {
        expect(normalizePostSlug('  Thiết bị vệ sinh 2026! ')).toBe(
            'thiet-bi-ve-sinh-2026',
        )
    })

    it('accepts only bounded URL-safe External Post IDs', () => {
        expect(parseExternalPostId('agent-post_2026.08')).toBe(
            'agent-post_2026.08',
        )
        expect(() => parseExternalPostId('post/one')).toThrowError(
            expect.objectContaining({ code: 'EXTERNAL_ID_INVALID' }),
        )
    })
})
