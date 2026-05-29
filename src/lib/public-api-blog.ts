import { cache } from 'react'
import prisma from '@/lib/prisma'

const POSTS_PER_PAGE = 9

export const getBlogCategories = cache(async () => {
    return prisma.blog_categories.findMany({
        where: { is_active: true },
        orderBy: { sort_order: 'asc' },
    })
})

export const getBlogPosts = cache(async (options: {
    categorySlug?: string
    tagSlug?: string
    page?: number
    limit?: number
    featuredOnly?: boolean
} = {}) => {
    const { categorySlug, tagSlug, page = 1, limit = POSTS_PER_PAGE, featuredOnly } = options

    const where: any = {
        status: 'published',
        published_at: { lte: new Date() },
    }

    if (categorySlug) {
        where.blog_categories = { slug: categorySlug }
    }

    if (tagSlug) {
        where.blog_post_tags = {
            some: { blog_tags: { slug: tagSlug } }
        }
    }

    if (featuredOnly) {
        where.is_featured = true
    }

    const [posts, total] = await Promise.all([
        prisma.blog_posts.findMany({
            where,
            include: {
                blog_categories: { select: { name: true, slug: true } },
                blog_post_tags: {
                    include: { blog_tags: { select: { name: true, slug: true } } },
                },
            },
            orderBy: [
                { is_pinned: 'desc' },
                { published_at: 'desc' },
            ],
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.blog_posts.count({ where }),
    ])

    return {
        posts,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
    }
})

export const getFeaturedBlogPosts = cache(async (limit = 1) => {
    return prisma.blog_posts.findMany({
        where: {
            status: 'published',
            published_at: { lte: new Date() },
            is_featured: true,
        },
        include: {
            blog_categories: { select: { name: true, slug: true } },
        },
        orderBy: { published_at: 'desc' },
        take: limit,
    })
})

export const getBlogPostBySlug = cache(async (slug: string) => {
    return prisma.blog_posts.findUnique({
        where: { slug },
        include: {
            blog_categories: { select: { id: true, name: true, slug: true } },
            blog_post_tags: {
                include: { blog_tags: { select: { name: true, slug: true } } },
            },
        },
    })
})

export const getRelatedBlogPosts = cache(async (postId: number, categoryId: number, limit = 3) => {
    return prisma.blog_posts.findMany({
        where: {
            id: { not: postId },
            category_id: categoryId,
            status: 'published',
            published_at: { lte: new Date() },
        },
        include: {
            blog_categories: { select: { name: true, slug: true } },
        },
        orderBy: { published_at: 'desc' },
        take: limit,
    })
})

export const getPopularTags = cache(async (limit = 10) => {
    return prisma.blog_tags.findMany({
        where: { post_count: { gt: 0 } },
        orderBy: { post_count: 'desc' },
        take: limit,
    })
})

export async function incrementViewCount(slug: string) {
    try {
        await prisma.blog_posts.update({
            where: { slug },
            data: {
                view_count: { increment: 1 }
            }
        })
    } catch (error) {
        console.error('Failed to increment view count:', error)
    }
}
