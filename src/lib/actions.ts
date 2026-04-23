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

// --- Category Banners ---
export async function updateCategoryBanner(id: number, banner_url: string | null) {
    try {
        await prisma.categories.update({
            where: { id },
            data: { banner_url: banner_url || null },
        })
        revalidatePath('/admin/categories')
        revalidatePath('/thiet-bi-ve-sinh')
        revalidatePath('/thiet-bi-bep')
        revalidatePath('/vat-lieu-nuoc')
        revalidatePath('/gach-op-lat')
        return { success: true }
    } catch (error) {
        console.error("Database Error:", error)
        return { success: false, message: 'Lỗi khi cập nhật banner danh mục.' }
    }
}

// --- Quote Requests ---

// Schema for multi-product quote cart submission
const quoteCartItemSchema = z.object({
    product_id: z.number().int().positive(),
    quantity: z.number().int().min(1).default(1),
    note: z.string().max(500).optional().nullable(),
})

const quoteCartSchema = z.object({
    name: z.string().min(1, "Tên là bắt buộc"),
    phone: z.string().min(9, "Số điện thoại không hợp lệ").max(15),
    email: z.string().email("Email không hợp lệ").optional().or(z.literal('')),
    message: z.string().max(2000).optional().nullable(),
    products: z.array(quoteCartItemSchema).optional().default([]),
})

export type QuoteCartPayload = z.infer<typeof quoteCartSchema>

export async function submitQuoteRequest(payload: QuoteCartPayload) {
    const validated = quoteCartSchema.safeParse(payload)
    if (!validated.success) {
        return { success: false, errors: validated.error.flatten().fieldErrors }
    }

    const { name, phone, email, message, products } = validated.data
    const quoteNumber = `DPG-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`

    try {
        await prisma.quote_requests.create({
            data: {
                name,
                phone,
                email: email || null,
                message: message || null,
                quote_number: quoteNumber,
                // Nested write: create quote_items only if products exist
                ...(products.length > 0 && {
                    quote_items: {
                        create: products.map(p => ({
                            product_id: p.product_id,
                            quantity: p.quantity ?? 1,
                            note: p.note ?? null,
                        })),
                    },
                }),
            },
        })
    } catch (error) {
        console.error("Quote creation error:", error)
        return { success: false, message: 'Lỗi khi gửi yêu cầu. Vui lòng thử lại.' }
    }

    revalidatePath('/admin/quote-requests')
    return {
        success: true,
        quote_number: quoteNumber,
        message: `Đã gửi yêu cầu báo giá thành công! Mã đơn của bạn: ${quoteNumber}`,
    }
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

