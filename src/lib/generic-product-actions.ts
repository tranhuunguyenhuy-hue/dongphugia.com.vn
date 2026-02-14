'use server'

import { revalidatePath } from "next/cache"
import prisma from "@/lib/prisma"
import { z } from "zod"

// Schema for generic products (TBVS, Kitchen, Water, Flooring)
const genericProductSchema = z.object({
    name: z.string().min(1, "Tên sản phẩm là bắt buộc"),
    slug: z.string().min(1, "Slug là bắt buộc"),
    sku: z.string().optional(),
    price: z.coerce.number().optional(),
    originalPrice: z.coerce.number().optional(),
    showPrice: z.boolean().default(false),
    thumbnail: z.string().optional(),
    images: z.string().default("[]"), // JSON string
    description: z.string().optional(),
    shortDescription: z.string().optional(),
    isPublished: z.boolean().default(true),
    isFeatured: z.boolean().default(false),

    categoryId: z.string().min(1),
    brandId: z.string().min(1, "Thương hiệu là bắt buộc"),
    productTypeId: z.string().min(1, "Loại sản phẩm là bắt buộc"),
    productGroupId: z.string().optional(), // Optional filter group
})

export async function createGenericProduct(data: any) {
    try {
        const validated = genericProductSchema.parse(data)
        await prisma.product.create({
            data: validated
        })
        revalidatePath('/admin')
        return { success: true }
    } catch (error) {
        console.error("Create generic product error:", error)
        return { success: false, error: "Failed to create product" }
    }
}

export async function updateGenericProduct(id: string, data: any) {
    try {
        const validated = genericProductSchema.parse(data)
        await prisma.product.update({
            where: { id },
            data: validated
        })
        revalidatePath('/admin')
        return { success: true }
    } catch (error) {
        console.error("Update generic product error:", error)
        return { success: false, error: "Failed to update product" }
    }
}

export async function deleteGenericProduct(id: string) {
    try {
        await prisma.product.delete({
            where: { id }
        })
        revalidatePath('/admin')
        return { success: true }
    } catch (error) {
        console.error("Delete generic product error:", error)
        return { success: false, error: "Failed to delete product" }
    }
}
