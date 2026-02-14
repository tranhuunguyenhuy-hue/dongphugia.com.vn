'use server'

import { z } from "zod"
import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

const postSchema = z.object({
    title: z.string().min(1),
    slug: z.string().min(1),
    content: z.string().min(1),
    thumbnail: z.string().optional(),
    isPublished: z.boolean().default(true),
})

export async function createPost(data: any) {
    const validated = postSchema.safeParse(data);
    if (!validated.success) {
        return { errors: validated.error.flatten().fieldErrors }
    }

    try {
        await prisma.post.create({
            data: {
                title: validated.data.title,
                slug: validated.data.slug,
                content: validated.data.content,
                thumbnail: validated.data.thumbnail || null,
                isPublished: validated.data.isPublished,
            }
        })
    } catch (error) {
        console.error("Database Error:", error)
        return { message: 'Lỗi database khi tạo bài viết.' }
    }

    revalidatePath('/admin/bai-viet')
    redirect('/admin/bai-viet')
}

export async function updatePost(id: string, data: any) {
    const validated = postSchema.safeParse(data);
    if (!validated.success) {
        return { errors: validated.error.flatten().fieldErrors }
    }

    try {
        await prisma.post.update({
            where: { id },
            data: {
                title: validated.data.title,
                slug: validated.data.slug,
                content: validated.data.content,
                thumbnail: validated.data.thumbnail || null,
                isPublished: validated.data.isPublished,
            }
        })
    } catch (error) {
        console.error("Database Error:", error)
        return { message: 'Lỗi database khi cập nhật bài viết.' }
    }

    revalidatePath('/admin/bai-viet')
    redirect('/admin/bai-viet')
}

export async function deletePost(id: string) {
    try {
        await prisma.post.delete({ where: { id } })
        revalidatePath('/admin/bai-viet')
        return { message: 'Đã xóa bài viết.' }
    } catch (error) {
        return { message: 'Lỗi database khi xóa bài viết.' }
    }
}
