'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { slugify } from '@/lib/utils'

const ProjectSchema = z.object({
    title: z.string().min(1, 'Tiêu đề không được để trống'),
    location: z.string().optional(),
    thumbnail_url: z.string().optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    is_featured: z.boolean().optional(),
    is_active: z.boolean().optional(),
    sort_order: z.number().optional(),
})

export async function createProject(data: z.infer<typeof ProjectSchema>) {
    const parsed = ProjectSchema.safeParse(data)
    if (!parsed.success) {
        return { errors: parsed.error.flatten().fieldErrors, message: 'Dữ liệu không hợp lệ' }
    }
    const slug = slugify(parsed.data.title) + '-' + Date.now()
    await prisma.projects.create({
        data: {
            title: parsed.data.title,
            slug,
            location: parsed.data.location ?? null,
            thumbnail_url: parsed.data.thumbnail_url ?? null,
            description: parsed.data.description ?? null,
            category: parsed.data.category ?? null,
            tags: parsed.data.tags ?? [],
            is_featured: parsed.data.is_featured ?? false,
            is_active: parsed.data.is_active ?? true,
            sort_order: parsed.data.sort_order ?? 0,
        },
    })
    revalidatePath('/admin/du-an')
    revalidatePath('/du-an')
    revalidatePath('/')
    return { success: true }
}

export async function updateProject(id: number, data: z.infer<typeof ProjectSchema>) {
    const parsed = ProjectSchema.safeParse(data)
    if (!parsed.success) {
        return { errors: parsed.error.flatten().fieldErrors, message: 'Dữ liệu không hợp lệ' }
    }
    await prisma.projects.update({
        where: { id },
        data: {
            title: parsed.data.title,
            location: parsed.data.location ?? null,
            thumbnail_url: parsed.data.thumbnail_url ?? null,
            description: parsed.data.description ?? null,
            category: parsed.data.category ?? null,
            tags: parsed.data.tags ?? [],
            is_featured: parsed.data.is_featured ?? false,
            is_active: parsed.data.is_active ?? true,
            sort_order: parsed.data.sort_order ?? 0,
            updated_at: new Date(),
        },
    })
    revalidatePath('/admin/du-an')
    revalidatePath('/du-an')
    revalidatePath('/')
    return { success: true }
}

export async function deleteProject(id: number) {
    await prisma.projects.delete({ where: { id } })
    revalidatePath('/admin/du-an')
    revalidatePath('/du-an')
    revalidatePath('/')
    return { success: true }
}
