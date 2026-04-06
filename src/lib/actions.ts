'use server'

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"

// NOTE: Legacy product/collection/pattern-type actions removed in LEO-366.
// Will be rebuilt as unified product actions in Phase 3.

// --- Banners ---
const bannerSchema = z.object({
    title: z.string().optional().nullable(),
    image_url: z.string().min(1, "URL ảnh là bắt buộc"),
    link_url: z.string().optional().nullable(),
    is_active: z.boolean().default(true),
    sort_order: z.coerce.number().int().optional().default(0),
})

export async function createBanner(data: any) {
    const validated = bannerSchema.safeParse(data)
    if (!validated.success) {
        return { errors: validated.error.flatten().fieldErrors }
    }
    const d = validated.data
    try {
        await prisma.banners.create({
            data: {
                title: d.title || null,
                image_url: d.image_url,
                link_url: d.link_url || null,
                is_active: d.is_active,
                sort_order: d.sort_order,
            },
        })
    } catch (error) {
        console.error("Database Error:", error)
        return { message: 'Lỗi database khi tạo banner.' }
    }
    revalidatePath('/admin/banners')
    revalidatePath('/')
    return { success: true }
}

export async function updateBanner(id: number, data: any) {
    const validated = bannerSchema.safeParse(data)
    if (!validated.success) {
        return { errors: validated.error.flatten().fieldErrors }
    }
    const d = validated.data
    try {
        await prisma.banners.update({
            where: { id },
            data: {
                title: d.title || null,
                image_url: d.image_url,
                link_url: d.link_url || null,
                is_active: d.is_active,
                sort_order: d.sort_order,
                updated_at: new Date(),
            },
        })
    } catch (error) {
        console.error("Database Error:", error)
        return { message: 'Lỗi database khi cập nhật banner.' }
    }
    revalidatePath('/admin/banners')
    revalidatePath('/')
    return { success: true }
}

export async function deleteBanner(id: number) {
    try {
        await prisma.banners.delete({ where: { id } })
        revalidatePath('/admin/banners')
        revalidatePath('/')
        return { success: true }
    } catch (error) {
        console.error("Database Error:", error)
        return { success: false, message: 'Lỗi database khi xóa banner.' }
    }
}

// --- Quote Requests ---
const quoteRequestSchema = z.object({
    name: z.string().min(1, "Tên là bắt buộc"),
    phone: z.string().min(9, "Số điện thoại không hợp lệ"),
    email: z.string().email("Email không hợp lệ").optional().or(z.literal('')),
    message: z.string().optional().nullable(),
    product_id: z.coerce.number().int().positive().optional().nullable(),
})

export async function submitQuoteRequest(prevState: any, formData: FormData) {
    const data = {
        name: formData.get('name'),
        phone: formData.get('phone'),
        email: formData.get('email') || undefined,
        message: formData.get('message') || null,
        product_id: formData.get('product_id') ? Number(formData.get('product_id')) : null,
    }

    const validated = quoteRequestSchema.safeParse(data)
    if (!validated.success) {
        return { success: false, errors: validated.error.flatten().fieldErrors }
    }

    const d = validated.data

    try {
        await prisma.quote_requests.create({
            data: {
                name: d.name,
                phone: d.phone,
                email: d.email || null,
                message: d.message || null,
                product_id: d.product_id || null,
            },
        })
    } catch (error) {
        console.error("Database Error:", error)
        return { success: false, message: 'Lỗi khi gửi yêu cầu. Vui lòng thử lại.' }
    }

    revalidatePath('/admin/quote-requests')
    return { success: true, message: 'Đã gửi yêu cầu báo giá thành công! Chúng tôi sẽ liên hệ bạn sớm nhất.' }
}

export async function updateQuoteRequestStatus(id: number, status: string) {
    try {
        await prisma.quote_requests.update({
            where: { id },
            data: { status, updated_at: new Date() },
        })
        revalidatePath('/admin/quote-requests')
        revalidatePath('/admin')
        return { success: true }
    } catch (error) {
        console.error("Database Error:", error)
        return { success: false, message: 'Lỗi khi cập nhật trạng thái.' }
    }
}
