'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const blogPostSchema = z.object({
    title: z.string().min(1, 'Tiêu đề không được để trống'),
    slug: z.string().min(1, 'Slug không được để trống'),
    excerpt: z.string().optional().default(''),
    content: z.string().optional().default(''),
    category_id: z.coerce.number().int().min(1, 'Phải chọn chuyên mục'),
    thumbnail_url: z.string().optional().default(''),
    cover_image_url: z.string().optional().default(''),
    seo_title: z.string().optional().default(''),
    seo_description: z.string().optional().default(''),
    seo_keywords: z.string().optional().default(''),
    reading_time: z.coerce.number().int().nullable().optional(),
    status: z.enum(['draft', 'published', 'scheduled']).default('draft'),
    published_at: z.string().nullable().optional(),
    author_name: z.string().optional().default('Đông Phú Gia'),
    author_avatar: z.string().optional().default(''),
    is_featured: z.boolean().optional().default(false),
    is_pinned: z.boolean().optional().default(false),
    tag_ids: z.array(z.coerce.number().int()).optional().default([]),
})

const blogTagSchema = z.object({
    name: z.string().min(1, 'Tên tag không được để trống'),
    slug: z.string().min(1, 'Slug không được để trống'),
    description: z.string().optional().default(''),
})

export async function createBlogPost(data: any) {
    const validated = blogPostSchema.safeParse(data)
    if (!validated.success) {
        return { errors: validated.error.flatten().fieldErrors }
    }
    const d = validated.data

    try {
        const publishedAt = d.status === 'published' && !d.published_at
            ? new Date()
            : d.published_at ? new Date(d.published_at) : null

        const post = await prisma.blog_posts.create({
            data: {
                title: d.title,
                slug: d.slug,
                excerpt: d.excerpt || null,
                content: d.content,
                category_id: d.category_id,
                thumbnail_url: d.thumbnail_url || null,
                cover_image_url: d.cover_image_url || null,
                seo_title: d.seo_title || null,
                seo_description: d.seo_description || null,
                seo_keywords: d.seo_keywords || null,
                reading_time: d.reading_time || null,
                status: d.status,
                published_at: publishedAt,
                author_name: d.author_name,
                author_avatar: d.author_avatar || null,
                is_featured: d.is_featured,
                is_pinned: d.is_pinned,
            },
        })

        if (d.tag_ids.length > 0) {
            await prisma.blog_post_tags.createMany({
                data: d.tag_ids.map((tagId) => ({ post_id: post.id, tag_id: tagId })),
                skipDuplicates: true,
            })
            // Update tag post counts
            await prisma.$executeRawUnsafe(
                `UPDATE blog_tags SET post_count = (SELECT COUNT(*) FROM blog_post_tags WHERE tag_id = blog_tags.id) WHERE id = ANY($1::int[])`,
                d.tag_ids
            )
        }

        revalidatePath('/admin/blog/posts')
        revalidatePath('/blog')
        return { success: true, id: post.id }
    } catch (err: any) {
        if (err.code === 'P2002') return { message: 'Slug đã tồn tại, vui lòng dùng slug khác' }
        return { message: 'Lỗi tạo bài viết: ' + err.message }
    }
}

export async function updateBlogPost(id: number, data: any) {
    const validated = blogPostSchema.safeParse(data)
    if (!validated.success) {
        return { errors: validated.error.flatten().fieldErrors }
    }
    const d = validated.data

    try {
        const existing = await prisma.blog_posts.findUnique({ where: { id }, select: { status: true, published_at: true } })
        const wasPublished = existing?.status === 'published'
        const publishedAt = d.status === 'published'
            ? (wasPublished ? existing?.published_at : new Date())
            : d.published_at ? new Date(d.published_at) : null

        await prisma.$transaction([
            prisma.blog_posts.update({
                where: { id },
                data: {
                    title: d.title,
                    slug: d.slug,
                    excerpt: d.excerpt || null,
                    content: d.content,
                    category_id: d.category_id,
                    thumbnail_url: d.thumbnail_url || null,
                    cover_image_url: d.cover_image_url || null,
                    seo_title: d.seo_title || null,
                    seo_description: d.seo_description || null,
                    seo_keywords: d.seo_keywords || null,
                    reading_time: d.reading_time || null,
                    status: d.status,
                    published_at: publishedAt,
                    author_name: d.author_name,
                    author_avatar: d.author_avatar || null,
                    is_featured: d.is_featured,
                    is_pinned: d.is_pinned,
                    updated_at: new Date(),
                },
            }),
            prisma.blog_post_tags.deleteMany({ where: { post_id: id } }),
        ])

        if (d.tag_ids.length > 0) {
            await prisma.blog_post_tags.createMany({
                data: d.tag_ids.map((tagId) => ({ post_id: id, tag_id: tagId })),
                skipDuplicates: true,
            })
        }

        // Refresh all tag counts affected
        await prisma.$executeRawUnsafe(
            `UPDATE blog_tags SET post_count = (SELECT COUNT(*) FROM blog_post_tags WHERE tag_id = blog_tags.id)`
        )

        revalidatePath('/admin/blog/posts')
        revalidatePath('/blog')
        return { success: true }
    } catch (err: any) {
        if (err.code === 'P2002') return { message: 'Slug đã tồn tại, vui lòng dùng slug khác' }
        return { message: 'Lỗi cập nhật bài viết: ' + err.message }
    }
}

export async function deleteBlogPost(id: number) {
    try {
        await prisma.blog_posts.delete({ where: { id } })
        // Refresh tag counts
        await prisma.$executeRawUnsafe(
            `UPDATE blog_tags SET post_count = (SELECT COUNT(*) FROM blog_post_tags WHERE tag_id = blog_tags.id)`
        )
        revalidatePath('/admin/blog/posts')
        revalidatePath('/blog')
        return { success: true }
    } catch (err: any) {
        return { message: 'Lỗi xóa bài viết: ' + err.message }
    }
}

export async function createBlogTag(data: any) {
    const validated = blogTagSchema.safeParse(data)
    if (!validated.success) {
        return { errors: validated.error.flatten().fieldErrors }
    }
    try {
        const tag = await prisma.blog_tags.create({
            data: {
                name: validated.data.name,
                slug: validated.data.slug,
                description: validated.data.description || null,
            },
        })
        revalidatePath('/admin/blog/tags')
        return { success: true, id: tag.id }
    } catch (err: any) {
        if (err.code === 'P2002') return { message: 'Slug tag đã tồn tại' }
        return { message: 'Lỗi tạo tag: ' + err.message }
    }
}

export async function deleteBlogTag(id: number) {
    try {
        await prisma.blog_tags.delete({ where: { id } })
        revalidatePath('/admin/blog/tags')
        return { success: true }
    } catch (err: any) {
        return { message: 'Lỗi xóa tag: ' + err.message }
    }
}

export async function incrementViewCount(postId: number) {
    await prisma.$executeRawUnsafe(
        `UPDATE blog_posts SET view_count = view_count + 1 WHERE id = $1`,
        postId
    )
}
