'use server'

import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'

// ─── TYPES ───────────────────────────────────────────────────────────────────

export type BlogPostStatus = 'draft' | 'published' | 'scheduled'

export interface AdminBlogPostsParams {
  search?: string
  status?: BlogPostStatus
  categoryId?: number
  isFeatured?: boolean
  isPinned?: boolean
  page?: number
  pageSize?: number
  orderBy?: 'created_at' | 'updated_at' | 'published_at' | 'view_count'
  orderDir?: 'asc' | 'desc'
}

// ─── GET ADMIN BLOG POSTS (list + filter + paginate) ─────────────────────────

/**
 * Primary query for the /blog admin listing page.
 * Supports filter by status, category; search by title/slug.
 */
export async function getAdminBlogPosts(params: AdminBlogPostsParams = {}) {
  const {
    search,
    status,
    categoryId,
    isFeatured,
    isPinned,
    page = 1,
    pageSize = 20,
    orderBy = 'updated_at',
    orderDir = 'desc',
  } = params

  const where: Prisma.blog_postsWhereInput = {
    ...(status && { status }),
    ...(categoryId && { category_id: categoryId }),
    ...(isFeatured !== undefined && { is_featured: isFeatured }),
    ...(isPinned !== undefined && { is_pinned: isPinned }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' as const } },
        { slug: { contains: search, mode: 'insensitive' as const } },
        { excerpt: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
  }

  const [posts, total] = await Promise.all([
    prisma.blog_posts.findMany({
      where,
      orderBy: { [orderBy]: orderDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        thumbnail_url: true,
        status: true,
        is_featured: true,
        is_pinned: true,
        view_count: true,
        reading_time: true,
        author_name: true,
        published_at: true,
        created_at: true,
        updated_at: true,
        blog_categories: { select: { id: true, name: true, slug: true } },
        blog_post_tags: {
          select: {
            blog_tags: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    }),
    prisma.blog_posts.count({ where }),
  ])

  return {
    posts: posts.map(p => ({
      ...p,
      tags: p.blog_post_tags.map(pt => pt.blog_tags),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

// ─── GET ADMIN BLOG POST BY ID (edit form pre-fill) ──────────────────────────

/**
 * Full blog post detail for the /blog/[id] edit form.
 * Includes tags and category for select dropdowns.
 */
export async function getAdminBlogPostById(id: number) {
  const post = await prisma.blog_posts.findUnique({
    where: { id },
    include: {
      blog_categories: { select: { id: true, name: true, slug: true } },
      blog_post_tags: {
        include: {
          blog_tags: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  })

  if (!post) return null

  return {
    ...post,
    tags: post.blog_post_tags.map(pt => pt.blog_tags),
    tag_ids: post.blog_post_tags.map(pt => pt.blog_tags.id),
  }
}

// ─── GET BLOG CATEGORIES (for form select) ────────────────────────────────────

export async function getBlogCategories() {
  return prisma.blog_categories.findMany({
    where: { is_active: true },
    select: { id: true, name: true, slug: true },
    orderBy: { sort_order: 'asc' },
  })
}

// ─── GET ALL TAGS (for form multi-select) ─────────────────────────────────────

export async function getAdminBlogTags(params: {
  search?: string
  page?: number
  pageSize?: number
} = {}) {
  const { search, page = 1, pageSize = 50 } = params

  const where: Prisma.blog_tagsWhereInput = {
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { slug: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
  }

  const [tags, total] = await Promise.all([
    prisma.blog_tags.findMany({
      where,
      orderBy: { post_count: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        post_count: true,
        created_at: true,
      },
    }),
    prisma.blog_tags.count({ where }),
  ])

  return { tags, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}

// ─── BLOG STATS (for dashboard) ───────────────────────────────────────────────

export async function getBlogStats() {
  const [total, published, drafts, scheduled] = await Promise.all([
    prisma.blog_posts.count(),
    prisma.blog_posts.count({ where: { status: 'published' } }),
    prisma.blog_posts.count({ where: { status: 'draft' } }),
    prisma.blog_posts.count({ where: { status: 'scheduled' } }),
  ])
  return { total, published, drafts, scheduled }
}
