'use server'

import { z } from "zod"
import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

const partnerSchema = z.object({
    name: z.string().min(1),
    logo: z.string().min(1),
    websiteUrl: z.string().optional(),
})

export async function createPartner(data: any) {
    const validated = partnerSchema.safeParse(data);
    if (!validated.success) {
        return { errors: validated.error.flatten().fieldErrors }
    }

    try {
        await prisma.partner.create({
            data: {
                name: validated.data.name,
                logo: validated.data.logo,
                websiteUrl: validated.data.websiteUrl || null,
            }
        })
    } catch (error) {
        console.error("Database Error:", error)
        return { message: 'Lỗi database khi tạo đối tác.' }
    }

    revalidatePath('/admin/doi-tac')
    redirect('/admin/doi-tac')
}

export async function updatePartner(id: string, data: any) {
    const validated = partnerSchema.safeParse(data);
    if (!validated.success) {
        return { errors: validated.error.flatten().fieldErrors }
    }

    try {
        await prisma.partner.update({
            where: { id },
            data: {
                name: validated.data.name,
                logo: validated.data.logo,
                websiteUrl: validated.data.websiteUrl || null,
            }
        })
    } catch (error) {
        console.error("Database Error:", error)
        return { message: 'Lỗi database khi cập nhật đối tác.' }
    }

    revalidatePath('/admin/doi-tac')
    redirect('/admin/doi-tac')
}

export async function deletePartner(id: string) {
    try {
        await prisma.partner.delete({ where: { id } })
        revalidatePath('/admin/doi-tac')
        return { message: 'Đã xóa đối tác.' }
    } catch (error) {
        return { message: 'Lỗi database khi xóa đối tác.' }
    }
}
