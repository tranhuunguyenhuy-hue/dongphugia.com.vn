import { unstable_cache } from 'next/cache'
import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'

const POSTS_PER_PAGE = 9

const getBlogCategoriesCached = unstable_cache(async () => {
    return prisma.blog_categories.findMany({
        where: { is_active: true },
        orderBy: { sort_order: 'asc' },
    })
}, ['public-blog-categories'], { revalidate: 300, tags: ['blog'] })

export async function getBlogCategories() {
    return getBlogCategoriesCached()
}

type BlogPostOptions = {
    categorySlug?: string
    tagSlug?: string
    page?: number
    limit?: number
    featuredOnly?: boolean
}

const getBlogPostsCached = unstable_cache(async (options: BlogPostOptions = {}) => {
    const { categorySlug, tagSlug, page = 1, limit = POSTS_PER_PAGE, featuredOnly } = options

    const where: Prisma.blog_postsWhereInput = {
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
}, ['public-blog-posts'], { revalidate: 300, tags: ['blog'] })

export async function getBlogPosts(options: BlogPostOptions = {}) {
    return getBlogPostsCached(options)
}

const getFeaturedBlogPostsCached = unstable_cache(async (limit = 1) => {
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
}, ['public-featured-blog-posts'], { revalidate: 300, tags: ['blog'] })

export async function getFeaturedBlogPosts(limit = 1) {
    return getFeaturedBlogPostsCached(limit)
}

const getBlogPostBySlugCached = unstable_cache(async (slug: string) => {
    return prisma.blog_posts.findFirst({
        where: {
            slug,
            status: 'published',
            published_at: { lte: new Date() },
        },
        include: {
            blog_categories: { select: { id: true, name: true, slug: true } },
            blog_post_tags: {
                include: { blog_tags: { select: { name: true, slug: true } } },
            },
        },
    })
}, ['public-blog-post-by-slug'], { revalidate: 300, tags: ['blog'] })

async function getBlogPostBySlugDirect(slug: string) {
    return prisma.blog_posts.findFirst({
        where: {
            slug,
            status: 'published',
            published_at: { lte: new Date() },
        },
        include: {
            blog_categories: { select: { id: true, name: true, slug: true } },
            blog_post_tags: {
                include: { blog_tags: { select: { name: true, slug: true } } },
            },
        },
    })
}

export async function getBlogPostBySlug(slug: string) {
    // Vitest does not install Next's incremental cache. Keep the database seam
    // directly testable while production always uses the tagged ISR cache.
    if (process.env.NODE_ENV === 'test') return getBlogPostBySlugDirect(slug)
    return getBlogPostBySlugCached(slug)
}

const getRelatedBlogPostsCached = unstable_cache(async (postId: number, categoryId: number, limit = 3) => {
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
}, ['public-related-blog-posts'], { revalidate: 300, tags: ['blog'] })

export async function getRelatedBlogPosts(postId: number, categoryId: number, limit = 3) {
    return getRelatedBlogPostsCached(postId, categoryId, limit)
}

const getPopularTagsCached = unstable_cache(async (limit = 10) => {
    return prisma.blog_tags.findMany({
        where: { is_active: true, post_count: { gt: 0 } },
        orderBy: { post_count: 'desc' },
        take: limit,
    })
}, ['public-popular-blog-tags'], { revalidate: 300, tags: ['blog'] })

export async function getPopularTags(limit = 10) {
    return getPopularTagsCached(limit)
}

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
