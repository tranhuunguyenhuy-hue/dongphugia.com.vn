import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    findFirst: vi.fn(),
    categoryFindMany: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    default: {
        blog_posts: {
            findFirst: mocks.findFirst,
        },
        blog_categories: {
            findMany: mocks.categoryFindMany,
        },
    },
}))

import { getBlogCategories, getBlogPostBySlug } from './public-api-blog'

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

    it('only exposes blog categories that contain a published post', async () => {
        mocks.categoryFindMany.mockResolvedValueOnce([])

        await getBlogCategories()

        expect(mocks.categoryFindMany).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                is_active: true,
                blog_posts: {
                    some: expect.objectContaining({
                        status: 'published',
                        published_at: expect.objectContaining({ lte: expect.any(Date) }),
                    }),
                },
            },
        }))
    })
})
