'use server'

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"

// --- Products ---
const productSchema = z.object({
    sku: z.string().min(1, "SKU là bắt buộc"),
    name: z.string().min(1, "Tên sản phẩm là bắt buộc"),
    slug: z.string().min(1, "Slug là bắt buộc"),
    pattern_type_id: z.coerce.number().int().positive("Kiểu vân là bắt buộc"),
    collection_id: z.coerce.number().int().positive().optional().nullable(),
    surface_id: z.coerce.number().int().positive().optional().nullable(),
    size_id: z.coerce.number().int().positive().optional().nullable(),
    origin_id: z.coerce.number().int().positive().optional().nullable(),
    description: z.string().optional().nullable(),
    price_display: z.string().optional().default("Liên hệ báo giá"),
    image_main_url: z.string().optional().nullable(),
    image_hover_url: z.string().optional().nullable(),
    is_active: z.boolean().default(true),
    is_featured: z.boolean().default(false),
    sort_order: z.coerce.number().int().optional().default(0),
    color_ids: z.array(z.coerce.number().int()).optional().default([]),
    location_ids: z.array(z.coerce.number().int()).optional().default([]),
    additional_image_urls: z.array(z.string()).optional().default([]),
})

export async function createProduct(data: any) {
    const validated = productSchema.safeParse(data);
    if (!validated.success) {
        return { errors: validated.error.flatten().fieldErrors }
    }

    const d = validated.data;

    try {
        await prisma.products.create({
            data: {
                sku: d.sku,
                name: d.name,
                slug: d.slug,
                pattern_type_id: d.pattern_type_id,
                collection_id: d.collection_id || null,
                surface_id: d.surface_id || null,
                size_id: d.size_id || null,
                origin_id: d.origin_id || null,
                description: d.description || null,
                price_display: d.price_display || "Liên hệ báo giá",
                image_main_url: d.image_main_url || null,
                image_hover_url: d.image_hover_url || null,
                is_active: d.is_active,
                is_featured: d.is_featured,
                sort_order: d.sort_order,
                product_colors: d.color_ids.length > 0 ? {
                    create: d.color_ids.map((colorId: number) => ({ color_id: colorId })),
                } : undefined,
                product_locations: d.location_ids.length > 0 ? {
                    create: d.location_ids.map((locationId: number) => ({ location_id: locationId })),
                } : undefined,
                product_images: d.additional_image_urls.length > 0 ? {
                    create: d.additional_image_urls.map((url: string, idx: number) => ({
                        image_url: url,
                        sort_order: idx,
                    })),
                } : undefined,
            },
        });
    } catch (error: any) {
        console.error("Database Error:", error)
        if (error?.code === 'P2002') {
            const targetStr = [error?.meta?.target].flat().join(',')
            if (targetStr.includes('slug')) return { message: 'Slug đã tồn tại. Hãy nhập slug khác.' }
            if (targetStr.includes('sku')) return { message: 'SKU đã tồn tại. Hãy nhập SKU khác.' }
            return { message: 'SKU hoặc Slug đã tồn tại.' }
        }
        return { message: 'Lỗi database khi tạo sản phẩm.' }
    }

    revalidatePath('/admin/products')
    revalidatePath('/gach-op-lat')
    return { success: true }
}

export async function updateProduct(id: number, data: any) {
    const validated = productSchema.safeParse(data);
    if (!validated.success) {
        return { errors: validated.error.flatten().fieldErrors }
    }

    const d = validated.data;

    try {
        await prisma.$transaction([
            // Delete existing junction records
            prisma.product_colors.deleteMany({ where: { product_id: id } }),
            prisma.product_locations.deleteMany({ where: { product_id: id } }),
            prisma.product_images.deleteMany({ where: { product_id: id } }),
            // Update product
            prisma.products.update({
                where: { id },
                data: {
                    sku: d.sku,
                    name: d.name,
                    slug: d.slug,
                    pattern_type_id: d.pattern_type_id,
                    collection_id: d.collection_id || null,
                    surface_id: d.surface_id || null,
                    size_id: d.size_id || null,
                    origin_id: d.origin_id || null,
                    description: d.description || null,
                    price_display: d.price_display || "Liên hệ báo giá",
                    image_main_url: d.image_main_url || null,
                    image_hover_url: d.image_hover_url || null,
                    is_active: d.is_active,
                    is_featured: d.is_featured,
                    sort_order: d.sort_order,
                    updated_at: new Date(),
                },
            }),
        ]);

        // Re-create junction records after update
        if (d.color_ids.length > 0) {
            await prisma.product_colors.createMany({
                data: d.color_ids.map((colorId: number) => ({ product_id: id, color_id: colorId })),
            });
        }
        if (d.location_ids.length > 0) {
            await prisma.product_locations.createMany({
                data: d.location_ids.map((locationId: number) => ({ product_id: id, location_id: locationId })),
            });
        }
        if (d.additional_image_urls.length > 0) {
            await prisma.product_images.createMany({
                data: d.additional_image_urls.map((url: string, idx: number) => ({
                    product_id: id,
                    image_url: url,
                    sort_order: idx,
                })),
            });
        }
    } catch (error: any) {
        console.error("Database Error:", error)
        if (error?.code === 'P2002') {
            const targetStr = [error?.meta?.target].flat().join(',')
            if (targetStr.includes('slug')) return { message: 'Slug đã tồn tại. Hãy nhập slug khác.' }
            if (targetStr.includes('sku')) return { message: 'SKU đã tồn tại. Hãy nhập SKU khác.' }
            return { message: 'SKU hoặc Slug đã tồn tại.' }
        }
        return { message: 'Lỗi database khi cập nhật sản phẩm.' }
    }

    revalidatePath('/admin/products')
    revalidatePath('/gach-op-lat')
    return { success: true }
}

export async function deleteProduct(id: number) {
    try {
        await prisma.products.delete({ where: { id } })
        revalidatePath('/admin/products')
        revalidatePath('/gach-op-lat')
        return { success: true }
    } catch (error) {
        console.error("Database Error:", error)
        return { success: false, message: 'Lỗi database khi xóa sản phẩm.' }
    }
}

// --- Collections ---
const collectionSchema = z.object({
    name: z.string().min(2, "Tên bộ sưu tập ít nhất 2 ký tự"),
    slug: z.string().min(2, "Slug ít nhất 2 ký tự"),
    pattern_type_id: z.coerce.number().int().positive("Kiểu vân là bắt buộc"),
    tagline: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    thumbnail_url: z.string().optional().nullable(),
    is_active: z.boolean().default(true),
    is_featured: z.boolean().default(false),
})

export async function createCollection(data: any) {
    const validated = collectionSchema.safeParse(data);
    if (!validated.success) {
        return { errors: validated.error.flatten().fieldErrors }
    }

    const d = validated.data;

    try {
        await prisma.collections.create({
            data: {
                name: d.name,
                slug: d.slug,
                pattern_type_id: d.pattern_type_id,
                tagline: d.tagline || null,
                description: d.description || null,
                thumbnail_url: d.thumbnail_url || null,
                is_active: d.is_active,
                is_featured: d.is_featured,
            },
        });
    } catch (error: any) {
        console.error("Database Error:", error)
        if (error?.code === 'P2002') {
            return { message: 'Slug bộ sưu tập đã tồn tại.' }
        }
        return { message: 'Lỗi database khi tạo bộ sưu tập.' }
    }

    revalidatePath('/admin/collections')
    revalidatePath('/admin/products')
    return { success: true }
}

export async function updateCollection(id: number, data: any) {
    const validated = collectionSchema.safeParse(data);
    if (!validated.success) {
        return { errors: validated.error.flatten().fieldErrors }
    }

    const d = validated.data;

    try {
        await prisma.collections.update({
            where: { id },
            data: {
                name: d.name,
                slug: d.slug,
                pattern_type_id: d.pattern_type_id,
                tagline: d.tagline || null,
                description: d.description || null,
                thumbnail_url: d.thumbnail_url || null,
                is_active: d.is_active,
                is_featured: d.is_featured,
                updated_at: new Date(),
            },
        });
    } catch (error: any) {
        console.error("Database Error:", error)
        if (error?.code === 'P2002') {
            return { message: 'Slug bộ sưu tập đã tồn tại.' }
        }
        return { message: 'Lỗi database khi cập nhật bộ sưu tập.' }
    }

    revalidatePath('/admin/collections')
    revalidatePath('/admin/products')
    return { success: true }
}

export async function deleteCollection(id: number) {
    try {
        // Unlink products from this collection first
        await prisma.products.updateMany({
            where: { collection_id: id },
            data: { collection_id: null },
        });
        await prisma.collections.delete({ where: { id } });
        revalidatePath('/admin/collections')
        revalidatePath('/admin/products')
        return { success: true }
    } catch (error) {
        console.error("Database Error:", error)
        return { success: false, message: 'Lỗi database khi xóa bộ sưu tập.' }
    }
}

// --- Pattern Types ---
const patternTypeSchema = z.object({
    name: z.string().min(1, "Tên kiểu vân là bắt buộc"),
    slug: z.string().min(1, "Slug là bắt buộc"),
    category_id: z.coerce.number().int().positive("Danh mục là bắt buộc"),
    description: z.string().optional().nullable(),
    thumbnail_url: z.string().optional().nullable(),
    hero_image_url: z.string().optional().nullable(),
    is_active: z.boolean().default(true),
    seo_title: z.string().optional().nullable(),
    seo_description: z.string().optional().nullable(),
})

export async function createPatternType(data: any) {
    const validated = patternTypeSchema.safeParse(data);
    if (!validated.success) {
        return { errors: validated.error.flatten().fieldErrors }
    }

    const d = validated.data;

    try {
        await prisma.pattern_types.create({
            data: {
                name: d.name,
                slug: d.slug,
                category_id: d.category_id,
                description: d.description || null,
                thumbnail_url: d.thumbnail_url || null,
                hero_image_url: d.hero_image_url || null,
                is_active: d.is_active,
                seo_title: d.seo_title || null,
                seo_description: d.seo_description || null,
            },
        });
    } catch (error: any) {
        console.error("Database Error:", error)
        if (error?.code === 'P2002') {
            return { message: 'Slug kiểu vân đã tồn tại.' }
        }
        return { message: 'Lỗi database khi tạo kiểu vân.' }
    }

    revalidatePath('/admin/pattern-types')
    return { success: true }
}

export async function updatePatternType(id: number, data: any) {
    const validated = patternTypeSchema.safeParse(data);
    if (!validated.success) {
        return { errors: validated.error.flatten().fieldErrors }
    }

    const d = validated.data;

    try {
        await prisma.pattern_types.update({
            where: { id },
            data: {
                name: d.name,
                slug: d.slug,
                category_id: d.category_id,
                description: d.description || null,
                thumbnail_url: d.thumbnail_url || null,
                hero_image_url: d.hero_image_url || null,
                is_active: d.is_active,
                seo_title: d.seo_title || null,
                seo_description: d.seo_description || null,
                updated_at: new Date(),
            },
        });
    } catch (error: any) {
        console.error("Database Error:", error)
        if (error?.code === 'P2002') {
            return { message: 'Slug kiểu vân đã tồn tại.' }
        }
        return { message: 'Lỗi database khi cập nhật kiểu vân.' }
    }

    revalidatePath('/admin/pattern-types')
    return { success: true }
}

export async function deletePatternType(id: number) {
    try {
        const productCount = await prisma.products.count({ where: { pattern_type_id: id } });
        if (productCount > 0) {
            return { message: `Không thể xóa: còn ${productCount} sản phẩm thuộc kiểu vân này.` }
        }

        await prisma.collections.deleteMany({ where: { pattern_type_id: id } });
        await prisma.pattern_types.delete({ where: { id } });
        revalidatePath('/admin/pattern-types')
        return { success: true, message: 'Đã xóa kiểu vân.' }
    } catch (error) {
        console.error("Database Error:", error)
        return { message: 'Lỗi database khi xóa kiểu vân.' }
    }
}

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
