'use server'

import prisma from '@/lib/prisma'
import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requirePermission } from '@/lib/auth/get-current-user'
import { toWriteFreezeActionResult } from '@/lib/write-freeze'
import { writePublishingAudit } from '@/lib/publishing/audit'
import { revalidatePublishingPublicSurfaces } from '@/lib/publishing/revalidation'
import { normalizeHumanBlogEditorialMedia } from '@/lib/publishing/blog-editorial-media'

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
    status: z.enum(['draft', 'published']).default('draft'),
    published_at: z.string().nullable().optional(),
    author_name: z.string().optional().default('Ban Biên Tập Đông Phú Gia'),
    author_avatar: z.string().optional().default(''),
    is_featured: z.boolean().optional().default(false),
    is_pinned: z.boolean().optional().default(false),
    tag_ids: z.array(z.coerce.number().int()).optional().default([]),
    version: z.coerce.number().int().min(1).optional(),
})

const blogTagSchema = z.object({
    name: z.string().min(1, 'Tên tag không được để trống'),
    slug: z.string().min(1, 'Slug không được để trống'),
    description: z.string().optional().default(''),
})

function isUniqueConstraintError(error: unknown): boolean {
    return Boolean(
        error
        && typeof error === 'object'
        && 'code' in error
        && error.code === 'P2002',
    )
}

function actionErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message
        ? `${fallback}: ${error.message}`
        : fallback
}

export async function createBlogPost(data: unknown) {
    await requirePermission('blog:write')

    const validated = blogPostSchema.safeParse(data)
    if (!validated.success) {
        return { errors: validated.error.flatten().fieldErrors }
    }
    const d = validated.data

    try {
        const publishedAt = d.status === 'published' && !d.published_at
            ? new Date()
            : d.published_at ? new Date(d.published_at) : null

        const post = await prisma.$transaction(async (transaction) => {
            const media = await normalizeHumanBlogEditorialMedia(transaction as unknown as Prisma.TransactionClient, {
                content: d.content,
                thumbnailUrl: d.thumbnail_url,
                coverImageUrl: d.cover_image_url,
            })
            const created = await transaction.blog_posts.create({
                data: {
                    title: d.title,
                    slug: d.slug,
                    excerpt: d.excerpt || null,
                    content: media.content,
                    category_id: d.category_id,
                    thumbnail_url: media.thumbnailUrl,
                    cover_image_url: media.coverImageUrl,
                    seo_title: d.seo_title || null,
                    seo_description: d.seo_description || null,
                    seo_keywords: d.seo_keywords || null,
                    reading_time: d.reading_time || null,
                    status: d.status,
                    published_at: publishedAt,
                    first_published_at: d.status === 'published' ? publishedAt : null,
                    author_name: d.author_name,
                    author_avatar: d.author_avatar || null,
                    is_featured: d.is_featured,
                    is_pinned: d.is_pinned,
                },
            })

            if (d.tag_ids.length > 0) {
                await transaction.blog_post_tags.createMany({
                    data: d.tag_ids.map((tagId) => ({ post_id: created.id, tag_id: tagId })),
                    skipDuplicates: true,
                })
                await transaction.$executeRawUnsafe(
                    `UPDATE blog_tags SET post_count = (SELECT COUNT(*) FROM blog_post_tags WHERE tag_id = blog_tags.id) WHERE id = ANY($1::int[])`,
                    d.tag_ids,
                )
            }
            return created
        })

        revalidatePath('/admin/blog/posts')
        revalidatePath('/blog')
        revalidateTag('blog', { expire: 0 })
        return { success: true, id: post.id }
    } catch (err: unknown) {
        const freezeResult = toWriteFreezeActionResult(err)
        if (freezeResult) return freezeResult
        if (isUniqueConstraintError(err)) return { message: 'Slug đã tồn tại, vui lòng dùng slug khác' }
        return { message: actionErrorMessage(err, 'Lỗi tạo bài viết') }
    }
}

export async function updateBlogPost(id: number, data: unknown) {
    const currentUser = await requirePermission('blog:write')

    const validated = blogPostSchema.safeParse(data)
    if (!validated.success) {
        return { errors: validated.error.flatten().fieldErrors }
    }
    const d = validated.data
    if (!d.version) {
        return { message: 'Bài viết đã thay đổi. Hãy tải lại trang trước khi lưu.' }
    }

    try {
        const existing = await prisma.blog_posts.findUnique({
            where: { id },
            include: {
                blog_categories: { select: { slug: true } },
                publishing_identity: { select: { sponsor_user_id: true } },
            },
        })
        if (!existing) return { message: 'Không tìm thấy bài viết' }
        if (
            existing.publishing_identity_id
            && (existing.status === 'scheduled' || existing.status === 'schedule_blocked')
        ) {
            return {
                message: 'Bài viết của Publishing Agent đang lên lịch hoặc bị chặn lịch. Hãy dùng Publishing API với ETag hiện tại để hủy hoặc lên lịch lại.',
            }
        }
        if (
            existing.publishing_identity_id
            && (
                d.content !== existing.content
                || (d.thumbnail_url || null) !== existing.thumbnail_url
                || (d.cover_image_url || null) !== existing.cover_image_url
            )
        ) {
            return {
                message: 'Nội dung hoặc ảnh của bài viết do Publishing Agent tạo chỉ được thay đổi qua Publishing API để giữ kiểm tra HTML và Managed Media.',
            }
        }
        const wasPublished = existing?.status === 'published'
        const publishedAt = d.status === 'published'
            ? (wasPublished ? existing?.published_at : new Date())
            : d.published_at ? new Date(d.published_at) : null

        const updated = await prisma.$transaction(async (transaction) => {
            const media = await normalizeHumanBlogEditorialMedia(transaction as unknown as Prisma.TransactionClient, {
                content: d.content,
                thumbnailUrl: d.thumbnail_url,
                coverImageUrl: d.cover_image_url,
            })
            const write = await transaction.blog_posts.updateMany({
                where: { id, version: d.version },
                data: {
                    title: d.title,
                    slug: d.slug,
                    excerpt: d.excerpt || null,
                    content: media.content,
                    category_id: d.category_id,
                    thumbnail_url: media.thumbnailUrl,
                    cover_image_url: media.coverImageUrl,
                    seo_title: d.seo_title || null,
                    seo_description: d.seo_description || null,
                    seo_keywords: d.seo_keywords || null,
                    reading_time: d.reading_time || null,
                    status: d.status,
                    published_at: publishedAt,
                    first_published_at:
                        existing.first_published_at
                        ?? (d.status === 'published' ? publishedAt : null),
                    scheduled_for: null,
                    scheduled_timezone: null,
                    scheduled_version: null,
                    schedule_blocked_code: null,
                    schedule_blocked_at: null,
                    schedule_last_attempt_at: null,
                    author_name: d.author_name,
                    author_avatar: d.author_avatar || null,
                    is_featured: d.is_featured,
                    is_pinned: d.is_pinned,
                    version: { increment: 1 },
                    updated_at: new Date(),
                },
            })
            if (write.count !== 1) return null
            await transaction.blog_post_tags.deleteMany({ where: { post_id: id } })
            if (d.tag_ids.length > 0) {
                await transaction.blog_post_tags.createMany({
                    data: d.tag_ids.map((tagId) => ({ post_id: id, tag_id: tagId })),
                    skipDuplicates: true,
                })
            }
            await transaction.$executeRaw(
                Prisma.sql`UPDATE blog_tags
                    SET post_count = (
                        SELECT COUNT(*) FROM blog_post_tags
                        WHERE blog_post_tags.tag_id = blog_tags.id
                    )`,
            )
            if (existing.publishing_identity_id) {
                await writePublishingAudit(transaction, {
                    actorKind: 'admin',
                    identityId: existing.publishing_identity_id,
                    adminActorId: currentUser.id,
                    sponsorUserId: existing.publishing_identity?.sponsor_user_id,
                    action: 'post.cms_updated',
                    postId: id,
                    externalId: existing.external_id ?? undefined,
                    fromVersion: existing.version,
                    toVersion: existing.version + 1,
                    fromState: existing.status,
                    toState: d.status,
                    changedFields: ['cms_form'],
                })
            }
            return true
        })
        if (!updated) {
            return { message: 'Bài viết đã được người khác cập nhật. Hãy tải lại trang trước khi lưu.' }
        }

        revalidatePath('/admin/blog/posts')
        revalidatePath('/blog')
        revalidatePublishingPublicSurfaces({
            categorySlug: existing.blog_categories.slug,
            postSlug: existing.slug,
        })
        return { success: true }
    } catch (err: unknown) {
        const freezeResult = toWriteFreezeActionResult(err)
        if (freezeResult) return freezeResult
        if (isUniqueConstraintError(err)) return { message: 'Slug đã tồn tại, vui lòng dùng slug khác' }
        return { message: actionErrorMessage(err, 'Lỗi cập nhật bài viết') }
    }
}

export async function deleteBlogPost(id: number, expectedVersion: number) {
    const currentUser = await requirePermission('blog:write')

    try {
        const existing = await prisma.blog_posts.findUnique({
            where: { id },
            include: {
                blog_categories: { select: { slug: true } },
                publishing_identity: { select: { sponsor_user_id: true } },
            },
        })
        if (!existing) return { message: 'Không tìm thấy bài viết' }
        if (existing.version !== expectedVersion) {
            return { message: 'Bài viết đã được người khác cập nhật. Hãy tải lại trang.' }
        }
        if (existing.publishing_identity_id) {
            const unpublished = await prisma.$transaction(async (transaction) => {
                const write = await transaction.blog_posts.updateMany({
                    where: { id, version: expectedVersion },
                    data: {
                        status: 'draft',
                        published_at: null,
                        scheduled_for: null,
                        scheduled_timezone: null,
                        scheduled_version: null,
                        schedule_blocked_code: null,
                        schedule_blocked_at: null,
                        schedule_last_attempt_at: null,
                        version: { increment: 1 },
                        updated_at: new Date(),
                    },
                })
                if (write.count !== 1) return false
                await writePublishingAudit(transaction, {
                    actorKind: 'admin',
                    identityId: existing.publishing_identity_id!,
                    adminActorId: currentUser.id,
                    sponsorUserId: existing.publishing_identity?.sponsor_user_id,
                    action: 'post.unpublished_by_admin',
                    postId: id,
                    externalId: existing.external_id ?? undefined,
                    fromVersion: expectedVersion,
                    toVersion: expectedVersion + 1,
                    fromState: existing.status,
                    toState: 'draft',
                    changedFields: ['status'],
                })
                return true
            })
            if (!unpublished) {
                return { message: 'Bài viết đã được người khác cập nhật. Hãy tải lại trang.' }
            }
            revalidatePublishingPublicSurfaces({
                categorySlug: existing.blog_categories.slug,
                postSlug: existing.slug,
            })
            revalidatePath('/admin/blog/posts')
            return { success: true, unpublished: true }
        }

        const removed = await prisma.blog_posts.deleteMany({
            where: { id, version: expectedVersion },
        })
        if (removed.count !== 1) {
            return { message: 'Bài viết đã được người khác cập nhật. Hãy tải lại trang.' }
        }
        // Refresh tag counts
        await prisma.$executeRaw(
            Prisma.sql`UPDATE blog_tags SET post_count = (
                SELECT COUNT(*) FROM blog_post_tags WHERE tag_id = blog_tags.id
            )`,
        )
        revalidatePath('/admin/blog/posts')
        revalidatePath('/blog')
        revalidatePublishingPublicSurfaces({
            categorySlug: existing.blog_categories.slug,
            postSlug: existing.slug,
        })
        return { success: true }
    } catch (err: unknown) {
        const freezeResult = toWriteFreezeActionResult(err)
        if (freezeResult) return freezeResult
        return { message: actionErrorMessage(err, 'Lỗi xóa bài viết') }
    }
}

export async function createBlogTag(data: unknown) {
    await requirePermission('blog:write')

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
        revalidateTag('blog', { expire: 0 })
        return { success: true, id: tag.id }
    } catch (err: unknown) {
        const freezeResult = toWriteFreezeActionResult(err)
        if (freezeResult) return freezeResult
        if (isUniqueConstraintError(err)) return { message: 'Slug tag đã tồn tại' }
        return { message: actionErrorMessage(err, 'Lỗi tạo tag') }
    }
}

export async function deleteBlogTag(id: number) {
    await requirePermission('blog:write')

    try {
        await prisma.blog_tags.update({
            where: { id },
            data: { is_active: false, updated_at: new Date() },
        })
        revalidatePath('/admin/blog/tags')
        revalidateTag('blog', { expire: 0 })
        return { success: true }
    } catch (err: unknown) {
        const freezeResult = toWriteFreezeActionResult(err)
        if (freezeResult) return freezeResult
        return { message: actionErrorMessage(err, 'Lỗi ngừng dùng tag') }
    }
}

export async function incrementViewCount(postId: number) {
    await prisma.$executeRawUnsafe(
        `UPDATE blog_posts SET view_count = view_count + 1 WHERE id = $1`,
        postId
    )
}
