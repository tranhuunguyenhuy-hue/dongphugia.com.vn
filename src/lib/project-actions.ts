'use server'

import { z } from "zod"
import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

const projectSchema = z.object({
    name: z.string().min(1),
    slug: z.string().min(1),
    description: z.string().optional(),
    images: z.string().optional(), // JSON string
})

export async function createProject(data: any) {
    const validated = projectSchema.safeParse(data);
    if (!validated.success) {
        return { errors: validated.error.flatten().fieldErrors }
    }

    try {
        await prisma.project.create({
            data: {
                name: validated.data.name,
                slug: validated.data.slug,
                description: validated.data.description || null,
                images: validated.data.images || "[]",
            }
        })
    } catch (error) {
        console.error("Database Error:", error)
        return { message: 'Lỗi database khi tạo dự án.' }
    }

    revalidatePath('/admin/du-an')
    redirect('/admin/du-an')
}

export async function updateProject(id: string, data: any) {
    const validated = projectSchema.safeParse(data);
    if (!validated.success) {
        return { errors: validated.error.flatten().fieldErrors }
    }

    try {
        await prisma.project.update({
            where: { id },
            data: {
                name: validated.data.name,
                slug: validated.data.slug,
                description: validated.data.description || null,
                images: validated.data.images || "[]",
            }
        })
    } catch (error) {
        console.error("Database Error:", error)
        return { message: 'Lỗi database khi cập nhật dự án.' }
    }

    revalidatePath('/admin/du-an')
    redirect('/admin/du-an')
}

export async function deleteProject(id: string) {
    try {
        await prisma.project.delete({ where: { id } })
        revalidatePath('/admin/du-an')
        return { message: 'Đã xóa dự án.' }
    } catch (error) {
        return { message: 'Lỗi database khi xóa dự án.' }
    }
}
