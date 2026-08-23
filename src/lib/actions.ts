'use server'

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requirePermission } from '@/lib/auth/get-current-user'
import { toWriteFreezeActionResult } from '@/lib/write-freeze'
import { buildQuoteItemSnapshot } from '@/lib/quote-snapshot'

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

export async function createBanner(data: unknown) {
    await requirePermission('blog:write')
    
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
        const freezeResult = toWriteFreezeActionResult(error)
        if (freezeResult) return freezeResult
        console.error("Database Error:", error)
        return { message: 'Lỗi database khi tạo banner.' }
    }
    revalidatePath('/admin/banners')
    revalidatePath('/')
    return { success: true }
}

export async function updateBanner(id: number, data: unknown) {
    await requirePermission('blog:write')

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
        const freezeResult = toWriteFreezeActionResult(error)
        if (freezeResult) return freezeResult
        console.error("Database Error:", error)
        return { message: 'Lỗi database khi cập nhật banner.' }
    }
    revalidatePath('/admin/banners')
    revalidatePath('/')
    return { success: true }
}

export async function deleteBanner(id: number) {
    await requirePermission('blog:write')

    try {
        await prisma.banners.delete({ where: { id } })
        revalidatePath('/admin/banners')
        revalidatePath('/')
        return { success: true }
    } catch (error) {
        const freezeResult = toWriteFreezeActionResult(error)
        if (freezeResult) return freezeResult
        console.error("Database Error:", error)
        return { success: false, message: 'Lỗi database khi xóa banner.' }
    }
}

// --- Category Banners ---
export async function updateCategoryBanner(id: number, banner_url: string | null) {
    await requirePermission('categories:write')

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
        const freezeResult = toWriteFreezeActionResult(error)
        if (freezeResult) return freezeResult
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
        await prisma.$transaction(async transaction => {
            const sourceProducts = products.length > 0
                ? await transaction.products.findMany({
                    where: { id: { in: products.map(product => product.product_id) } },
                    select: {
                        id: true,
                        sku: true,
                        name: true,
                        price: true,
                        original_price: true,
                        list_price: true,
                        sale_price: true,
                        stock_status: true,
                        is_active: true,
                        publication_status: true,
                        pdp_visibility: true,
                        sellable_status: true,
                    },
                })
                : []

            const productsById = new Map(sourceProducts.map(product => [product.id, product]))
            const snapshotAt = new Date()
            const quoteItems = products.map(item => {
                const product = productsById.get(item.product_id)
                if (
                    !product
                    || !product.is_active
                    || product.publication_status !== 'public'
                    || product.pdp_visibility !== 'public'
                    || product.sellable_status !== 'sellable'
                ) {
                    throw new Error('QUOTE_PRODUCT_UNAVAILABLE')
                }

                const snapshot = buildQuoteItemSnapshot({
                    id: product.id,
                    sku: product.sku,
                    name: product.name,
                    compatibilityPrice: product.price,
                    originalPrice: product.original_price,
                    listPrice: product.list_price,
                    salePrice: product.sale_price,
                    stockStatus: product.stock_status,
                }, snapshotAt)

                if (!snapshot) throw new Error('QUOTE_PRODUCT_NOT_QUOTEABLE')

                return {
                    product_id: product.id,
                    quantity: item.quantity ?? 1,
                    note: item.note ?? null,
                    ...snapshot,
                }
            })

            await transaction.quote_requests.create({
                data: {
                    name,
                    phone,
                    email: email || null,
                    message: message || null,
                    quote_number: quoteNumber,
                    ...(quoteItems.length > 0 && { quote_items: { create: quoteItems } }),
                },
            })
        })
    } catch (error) {
        const freezeResult = toWriteFreezeActionResult(error)
        if (freezeResult) return freezeResult
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
    await requirePermission('quotes:update')

    try {
        await prisma.quote_requests.update({
            where: { id },
            data: { status, updated_at: new Date() },
        })
        revalidatePath('/admin/quote-requests')
        revalidatePath('/admin')
        return { success: true }
    } catch (error) {
        const freezeResult = toWriteFreezeActionResult(error)
        if (freezeResult) return freezeResult
        console.error("Database Error:", error)
        return { success: false, message: 'Lỗi khi cập nhật trạng thái.' }
    }
}

export async function submitContactForm(data: { name: string, phone: string, email?: string, message: string }) {
    try {
        await prisma.customers.upsert({
            where: { phone: data.phone },
            create: {
                full_name: data.name,
                phone: data.phone,
                email: data.email || null,
                notes: `Khách hàng từ Form Liên Hệ:\n${data.message}`,
                source: 'CONTACT_FORM'
            },
            update: {
                last_interacted_at: new Date(),
                notes: `[Cập nhật mới]: Khách hàng gửi form liên hệ với nội dung:\n${data.message}`
            }
        })
        revalidatePath('/admin/customers')
        return { success: true }
    } catch (error) {
        const freezeResult = toWriteFreezeActionResult(error)
        if (freezeResult) return freezeResult
        console.error("Lỗi khi lưu form liên hệ:", error)
        return { success: false, error: 'Có lỗi xảy ra, vui lòng thử lại sau.' }
    }
}
