'use server'

import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// ─── SCHEMAS ─────────────────────────────────────────────────────────────────

const productSchema = z.object({
    sku: z.string().min(1, 'SKU là bắt buộc').max(100),
    name: z.string().min(1, 'Tên sản phẩm là bắt buộc').max(500),
    display_name: z.string().max(500).optional().nullable(),
    slug: z.string().min(1, 'Slug là bắt buộc').max(500),
    category_id: z.coerce.number().int().positive('Phải chọn danh mục'),
    subcategory_id: z.coerce.number().int().positive().optional().nullable(),
    brand_id: z.coerce.number().int().positive().optional().nullable(),
    origin_id: z.coerce.number().int().positive().optional().nullable(),
    color_id: z.coerce.number().int().positive().optional().nullable(),
    material_id: z.coerce.number().int().positive().optional().nullable(),
    price: z.coerce.number().positive().optional().nullable(),
    original_price: z.coerce.number().positive().optional().nullable(),
    price_display: z.string().max(50).optional().default('Liên hệ báo giá'),
    description: z.string().optional().nullable(),
    features: z.string().optional().nullable(),
    specs: z.record(z.string(), z.unknown()).optional().default({}),
    warranty_months: z.coerce.number().int().positive().optional().nullable(),
    image_main_url: z.string().url().max(1000).optional().nullable().or(z.literal('')),
    image_hover_url: z.string().url().max(1000).optional().nullable().or(z.literal('')),
    stock_status: z.enum(['in_stock', 'out_of_stock', 'preorder']).default('in_stock'),
    is_active: z.boolean().default(true),
    is_featured: z.boolean().default(false),
    is_new: z.boolean().default(false),
    is_bestseller: z.boolean().default(false),
    sort_order: z.coerce.number().int().default(0),
    product_type: z.string().max(50).optional().nullable(),
    product_sub_type: z.string().max(50).optional().nullable(),
    source_url: z.string().url().max(1000).optional().nullable().or(z.literal('')),
    hita_product_id: z.string().max(100).optional().nullable(),
    seo_title: z.string().max(200).optional().nullable(),
    seo_description: z.string().max(500).optional().nullable(),
})

// ─── CREATE ──────────────────────────────────────────────────────────────────

export async function createProduct(data: unknown) {
    const validated = productSchema.safeParse(data)
    if (!validated.success) {
        return { errors: validated.error.flatten().fieldErrors }
    }
    const d = validated.data

    try {
        const createData: Prisma.productsUncheckedCreateInput = {
            sku: d.sku,
            name: d.name,
            display_name: d.display_name || null,
            slug: d.slug,
            category_id: d.category_id,
            subcategory_id: d.subcategory_id || null,
            brand_id: d.brand_id || null,
            origin_id: d.origin_id || null,
            color_id: d.color_id || null,
            material_id: d.material_id || null,
            price: d.price ? d.price : null,
            original_price: d.original_price ? d.original_price : null,
            price_display: d.price_display || 'Liên hệ báo giá',
            description: d.description || null,
            features: d.features || null,
            specs: (d.specs || {}) as Prisma.InputJsonValue,
            warranty_months: d.warranty_months || null,
            image_main_url: d.image_main_url || null,
            image_hover_url: d.image_hover_url || null,
            stock_status: d.stock_status,
            is_active: d.is_active,
            is_featured: d.is_featured,
            is_new: d.is_new,
            is_bestseller: d.is_bestseller,
            sort_order: d.sort_order,
            product_type: d.product_type || null,
            product_sub_type: d.product_sub_type || null,
            source_url: d.source_url || null,
            hita_product_id: d.hita_product_id || null,
            seo_title: d.seo_title || null,
            seo_description: d.seo_description || null,
        }
        const product = await prisma.products.create({ data: createData })
        revalidatePath('/admin/products')
        revalidatePath('/')
        return { success: true, id: product.id }
    } catch (err: unknown) {
        const e = err as { code?: string; message?: string }
        if (e.code === 'P2002') return { message: 'SKU hoặc slug đã tồn tại trong cùng danh mục' }
        return { message: 'Lỗi tạo sản phẩm: ' + (e.message ?? 'Unknown error') }
    }
}

// ─── UPDATE ──────────────────────────────────────────────────────────────────

export async function updateProduct(id: number, data: unknown) {
    const validated = productSchema.safeParse(data)
    if (!validated.success) {
        return { errors: validated.error.flatten().fieldErrors }
    }
    const d = validated.data

    try {
        const updateData: Prisma.productsUncheckedUpdateInput = {
            sku: d.sku,
            name: d.name,
            display_name: d.display_name || null,
            slug: d.slug,
            category_id: d.category_id,
            subcategory_id: d.subcategory_id || null,
            brand_id: d.brand_id || null,
            origin_id: d.origin_id || null,
            color_id: d.color_id || null,
            material_id: d.material_id || null,
            price: d.price ? d.price : null,
            original_price: d.original_price ? d.original_price : null,
            price_display: d.price_display || 'Liên hệ báo giá',
            description: d.description || null,
            features: d.features || null,
            specs: (d.specs || {}) as Prisma.InputJsonValue,
            warranty_months: d.warranty_months || null,
            image_main_url: d.image_main_url || null,
            image_hover_url: d.image_hover_url || null,
            stock_status: d.stock_status,
            is_active: d.is_active,
            is_featured: d.is_featured,
            is_new: d.is_new,
            is_bestseller: d.is_bestseller,
            sort_order: d.sort_order,
            product_type: d.product_type || null,
            product_sub_type: d.product_sub_type || null,
            source_url: d.source_url || null,
            hita_product_id: d.hita_product_id || null,
            seo_title: d.seo_title || null,
            seo_description: d.seo_description || null,
            updated_at: new Date(),
        }
        await prisma.products.update({ where: { id }, data: updateData })
        // Revalidate category listing + product detail
        revalidatePath('/admin/products')
        revalidatePath(`/admin/products/${id}`)
        revalidatePath('/')
        return { success: true }
    } catch (err: unknown) {
        const e = err as { code?: string; message?: string }
        if (e.code === 'P2002') return { message: 'SKU hoặc slug đã tồn tại trong cùng danh mục' }
        return { message: 'Lỗi cập nhật sản phẩm: ' + (e.message ?? 'Unknown error') }
    }
}

// ─── TOGGLE FIELDS ───────────────────────────────────────────────────────────

export async function toggleProductFeatured(id: number, value: boolean) {
    try {
        await prisma.products.update({ where: { id }, data: { is_featured: value, updated_at: new Date() } })
        revalidatePath('/admin/products')
        revalidatePath('/')
        return { success: true }
    } catch (err: any) {
        return { message: 'Lỗi cập nhật: ' + err.message }
    }
}

export async function toggleProductActive(id: number, value: boolean) {
    try {
        await prisma.products.update({ where: { id }, data: { is_active: value, updated_at: new Date() } })
        revalidatePath('/admin/products')
        return { success: true }
    } catch (err: any) {
        return { message: 'Lỗi cập nhật: ' + err.message }
    }
}

// ─── DELETE ──────────────────────────────────────────────────────────────────

export async function deleteProduct(id: number) {
    try {
        await prisma.products.delete({ where: { id } })
        revalidatePath('/admin/products')
        revalidatePath('/')
        return { success: true }
    } catch (err: any) {
        return { message: 'Lỗi xóa sản phẩm: ' + err.message }
    }
}

// ─── BULK OPERATIONS ─────────────────────────────────────────────────────────

export async function bulkDeleteProducts(ids: number[]) {
    try {
        const result = await prisma.products.deleteMany({ where: { id: { in: ids } } })
        revalidatePath('/admin/products')
        revalidatePath('/')
        return { success: true, count: result.count }
    } catch (err: any) {
        return { message: 'Lỗi xóa nhiều sản phẩm: ' + err.message }
    }
}

export async function bulkToggleActive(ids: number[], value: boolean) {
    try {
        const result = await prisma.products.updateMany({
            where: { id: { in: ids } },
            data: { is_active: value, updated_at: new Date() },
        })
        revalidatePath('/admin/products')
        return { success: true, count: result.count }
    } catch (err: any) {
        return { message: 'Lỗi cập nhật trạng thái: ' + err.message }
    }
}

// ─── PRODUCT IMAGES ──────────────────────────────────────────────────────────

export async function addProductImage(productId: number, imageUrl: string, altText?: string, imageType = 'gallery') {
    try {
        const imgData: Prisma.product_imagesUncheckedCreateInput = {
            product_id: productId,
            image_url: imageUrl,
            alt_text: altText || null,
            image_type: imageType,
        }
        const img = await prisma.product_images.create({ data: imgData })
        revalidatePath(`/admin/products/${productId}`)
        return { success: true, id: img.id }
    } catch (err: unknown) {
        const e = err as { message?: string }
        return { message: 'Lỗi thêm ảnh: ' + (e.message ?? 'Unknown error') }
    }
}

export async function addProductImages(productId: number, imageUrls: string[]) {
    try {
        const data = imageUrls.map((url, i) => ({
            product_id: productId,
            image_url: url,
            image_type: 'gallery' as const,
            sort_order: i,
        }))
        await prisma.product_images.createMany({ data })
        revalidatePath(`/admin/products/${productId}`)
        return { success: true, count: imageUrls.length }
    } catch (err: any) {
        return { message: 'Lỗi thêm ảnh: ' + err.message }
    }
}

export async function deleteProductImage(imageId: number, productId: number) {
    try {
        await prisma.product_images.delete({ where: { id: imageId } })
        revalidatePath(`/admin/products/${productId}`)
        return { success: true }
    } catch (err: any) {
        return { message: 'Lỗi xóa ảnh: ' + err.message }
    }
}

export async function setProductThumbnail(productId: number, imageUrl: string) {
    try {
        await prisma.products.update({
            where: { id: productId },
            data: { image_main_url: imageUrl, updated_at: new Date() },
        })
        revalidatePath(`/admin/products/${productId}`)
        revalidatePath('/admin/products')
        revalidatePath('/')
        return { success: true }
    } catch (err: any) {
        return { message: 'Lỗi đặt thumbnail: ' + err.message }
    }
}

