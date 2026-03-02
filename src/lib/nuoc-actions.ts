'use server'

import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const nuocProductSchema = z.object({
    sku: z.string().min(1, 'SKU không được để trống'),
    name: z.string().min(1, 'Tên sản phẩm không được để trống'),
    slug: z.string().min(1, 'Slug không được để trống'),
    product_type_id: z.coerce.number().int().min(1, 'Phải chọn loại sản phẩm'),
    subtype_id: z.coerce.number().int().nullable().optional(),
    brand_id: z.coerce.number().int().nullable().optional(),
    material_id: z.coerce.number().int().nullable().optional(),
    color_id: z.coerce.number().int().nullable().optional(),
    origin_id: z.coerce.number().int().nullable().optional(),
    capacity_liters: z.coerce.number().int().nullable().optional(),
    power_watts: z.coerce.number().int().nullable().optional(),
    description: z.string().optional().default(''),
    features: z.string().optional().default(''),
    specifications: z.record(z.string(), z.string()).optional().default({}),
    warranty_months: z.coerce.number().int().optional().default(24),
    price_display: z.string().optional().default('Liên hệ báo giá'),
    image_main_url: z.string().optional().default(''),
    image_hover_url: z.string().optional().default(''),
    is_active: z.boolean().optional().default(true),
    is_featured: z.boolean().optional().default(false),
    is_new: z.boolean().optional().default(false),
    is_bestseller: z.boolean().optional().default(false),
    sort_order: z.coerce.number().int().optional().default(0),
    additional_image_urls: z.array(z.string()).optional().default([]),
})

export async function createNuocProduct(data: any) {
    const validated = nuocProductSchema.safeParse(data)
    if (!validated.success) {
        return { errors: validated.error.flatten().fieldErrors }
    }
    const d = validated.data
    const hasSpecs = Object.keys(d.specifications ?? {}).length > 0

    try {
        await prisma.nuoc_products.create({
            data: {
                sku: d.sku,
                name: d.name,
                slug: d.slug,
                product_type_id: d.product_type_id,
                subtype_id: d.subtype_id || null,
                brand_id: d.brand_id || null,
                material_id: d.material_id || null,
                color_id: d.color_id || null,
                origin_id: d.origin_id || null,
                capacity_liters: d.capacity_liters || null,
                power_watts: d.power_watts || null,
                description: d.description || null,
                features: d.features || null,
                specifications: hasSpecs ? d.specifications : undefined,
                warranty_months: d.warranty_months,
                price_display: d.price_display,
                image_main_url: d.image_main_url || null,
                image_hover_url: d.image_hover_url || null,
                is_active: d.is_active,
                is_featured: d.is_featured,
                is_new: d.is_new,
                is_bestseller: d.is_bestseller,
                sort_order: d.sort_order,
                nuoc_product_images: d.additional_image_urls.length > 0 ? {
                    create: d.additional_image_urls.map((url: string, idx: number) => ({
                        image_url: url,
                        sort_order: idx,
                    })),
                } : undefined,
            },
        })
        revalidatePath('/admin/nuoc')
        return { success: true }
    } catch (error: any) {
        if (error?.code === 'P2002') {
            const target = [error?.meta?.target].flat().join(',')
            if (target.includes('sku')) return { message: 'SKU đã tồn tại' }
            if (target.includes('slug')) return { message: 'Slug đã tồn tại' }
            return { message: 'Dữ liệu đã tồn tại' }
        }
        return { message: 'Đã xảy ra lỗi, vui lòng thử lại' }
    }
}

export async function updateNuocProduct(id: number, data: any) {
    const validated = nuocProductSchema.safeParse(data)
    if (!validated.success) {
        return { errors: validated.error.flatten().fieldErrors }
    }
    const d = validated.data
    const hasSpecs = Object.keys(d.specifications ?? {}).length > 0

    try {
        await prisma.$transaction([
            prisma.nuoc_product_images.deleteMany({ where: { product_id: id } }),
            prisma.nuoc_products.update({
                where: { id },
                data: {
                    sku: d.sku,
                    name: d.name,
                    slug: d.slug,
                    product_type_id: d.product_type_id,
                    subtype_id: d.subtype_id || null,
                    brand_id: d.brand_id || null,
                    material_id: d.material_id || null,
                    color_id: d.color_id || null,
                    origin_id: d.origin_id || null,
                    capacity_liters: d.capacity_liters || null,
                    power_watts: d.power_watts || null,
                    description: d.description || null,
                    features: d.features || null,
                    specifications: hasSpecs ? d.specifications : Prisma.JsonNull,
                    warranty_months: d.warranty_months,
                    price_display: d.price_display,
                    image_main_url: d.image_main_url || null,
                    image_hover_url: d.image_hover_url || null,
                    is_active: d.is_active,
                    is_featured: d.is_featured,
                    is_new: d.is_new,
                    is_bestseller: d.is_bestseller,
                    sort_order: d.sort_order,
                    updated_at: new Date(),
                },
            }),
        ])

        if (d.additional_image_urls.length > 0) {
            await prisma.nuoc_product_images.createMany({
                data: d.additional_image_urls.map((url: string, idx: number) => ({
                    product_id: id,
                    image_url: url,
                    sort_order: idx,
                })),
            })
        }

        revalidatePath('/admin/nuoc')
        return { success: true }
    } catch (error: any) {
        if (error?.code === 'P2002') {
            const target = [error?.meta?.target].flat().join(',')
            if (target.includes('sku')) return { message: 'SKU đã tồn tại' }
            if (target.includes('slug')) return { message: 'Slug đã tồn tại' }
            return { message: 'Dữ liệu đã tồn tại' }
        }
        return { message: 'Đã xảy ra lỗi, vui lòng thử lại' }
    }
}

export async function deleteNuocProduct(id: number) {
    try {
        await prisma.nuoc_products.delete({ where: { id } })
        revalidatePath('/admin/nuoc')
        return { success: true }
    } catch {
        return { message: 'Không thể xóa sản phẩm' }
    }
}
