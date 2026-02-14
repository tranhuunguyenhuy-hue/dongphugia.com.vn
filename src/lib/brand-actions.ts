'use server'

import { revalidatePath } from "next/cache"
import prisma from "@/lib/prisma"
import { z } from "zod"

const brandSchema = z.object({
    name: z.string().min(1, "Tên thương hiệu là bắt buộc"),
    slug: z.string().min(1, "Slug là bắt buộc"),
    logo: z.string().optional(),
    categoryId: z.string().min(1, "Danh mục là bắt buộc"),
})

export async function createBrand(data: any) {
    try {
        const validated = brandSchema.parse(data)
        await prisma.brand.create({
            data: validated
        })
        revalidatePath('/admin')
        return { success: true }
    } catch (error) {
        console.error("Create brand error:", error)
        return { success: false, error: "Failed to create brand" }
    }
}

export async function updateBrand(id: string, data: any) {
    try {
        const validated = brandSchema.parse(data)
        await prisma.brand.update({
            where: { id },
            data: validated
        })
        revalidatePath('/admin')
        return { success: true }
    } catch (error) {
        console.error("Update brand error:", error)
        return { success: false, error: "Failed to update brand" }
    }
}

export async function deleteBrand(id: string) {
    try {
        await prisma.brand.delete({
            where: { id }
        })
        revalidatePath('/admin')
        return { success: true }
    } catch (error) {
        console.error("Delete brand error:", error)
        return { success: false, error: "Failed to delete brand" }
    }
}
