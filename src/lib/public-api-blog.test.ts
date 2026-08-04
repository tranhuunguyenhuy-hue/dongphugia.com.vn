import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    findFirst: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    default: {
        blog_posts: {
            findFirst: mocks.findFirst,
        },
    },
}))

import { getBlogPostBySlug } from './public-api-blog'

describe('getBlogPostBySlug', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('only resolves published posts whose publish time has arrived', async () => {
        await getBlogPostBySlug('published-post')

        expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                slug: 'published-post',
                status: 'published',
                published_at: expect.objectContaining({ lte: expect.any(Date) }),
            }),
        }))
    })
})
