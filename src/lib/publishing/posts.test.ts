import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    findMany: vi.fn(),
}))

vi.mock('./database', () => ({
    default: {
        blog_posts: {
            findMany: mocks.findMany,
        },
    },
}))

import { decodePostListCursor } from './contracts'
import { listPublishingPosts, mapPublishingPost } from './posts'

function storedSummary(id: number, updatedAt: string) {
    return {
        id,
        external_id: `post-${id}`,
        status: 'draft',
        version: 1,
        updated_at: new Date(updatedAt),
        published_at: null,
        scheduled_for: null,
        scheduled_timezone: null,
        schedule_blocked_code: null,
    }
}

describe('Publishing post listing', () => {
    beforeEach(() => {
        mocks.findMany.mockReset()
    })

    it('uses the last returned post as the next cursor', async () => {
        mocks.findMany.mockResolvedValue([
            storedSummary(3, '2026-08-13T12:00:00.000Z'),
            storedSummary(2, '2026-08-13T11:00:00.000Z'),
            storedSummary(1, '2026-08-13T10:00:00.000Z'),
        ])

        const result = await listPublishingPosts({
            identityId: 'identity-id',
            limit: 2,
        })

        expect(result.items.map(({ external_id }) => external_id)).toEqual([
            'post-3',
            'post-2',
        ])
        expect(decodePostListCursor(result.next_cursor!)).toEqual({
            updatedAt: new Date('2026-08-13T11:00:00.000Z'),
            id: 2,
        })
    })

    it('returns taxonomy descriptions on an owned post', () => {
        const post = mapPublishingPost({
            external_id: 'post-1',
            status: 'draft',
            version: 1,
            updated_at: new Date('2026-08-13T12:00:00.000Z'),
            published_at: null,
            scheduled_for: null,
            scheduled_timezone: null,
            schedule_blocked_code: null,
            title: 'A post title',
            slug: 'a-post-title',
            excerpt: 'An excerpt',
            content: '<p>Content</p><img src="https://dpg-publishing-staging.b-cdn.net/publishing/asset.webp">',
            blog_categories: {
                name: 'Knowledge',
                slug: 'knowledge',
                description: 'Approved category',
            },
            blog_post_tags: [
                {
                    blog_tags: {
                        name: 'Guides',
                        slug: 'guides',
                        description: 'Approved tag',
                    },
                },
            ],
            thumbnail_url: 'https://dpg-publishing-staging.b-cdn.net/publishing/thumbnail.webp',
            cover_image_url: 'https://dpg-publishing-staging.b-cdn.net/publishing/cover.webp',
            seo_title: null,
            seo_description: null,
            reading_time: null,
        } as Parameters<typeof mapPublishingPost>[0])

        expect(post.category).toEqual({
            name: 'Knowledge',
            slug: 'knowledge',
            description: 'Approved category',
        })
        expect(post.tags).toEqual([{
            name: 'Guides',
            slug: 'guides',
            description: 'Approved tag',
        }])
        expect(post.content_html).toContain(
            'https://media.dongphugia.vn/publishing/asset.webp',
        )
        expect(post.thumbnail_url).toBe(
            'https://media.dongphugia.vn/publishing/thumbnail.webp',
        )
        expect(post.cover_image_url).toBe(
            'https://media.dongphugia.vn/publishing/cover.webp',
        )
        expect(post.content_html).not.toContain('dpg-publishing-staging.b-cdn.net')
    })
})
