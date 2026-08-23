'use server'

import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/get-current-user'
import { toWriteFreezeActionResult } from '@/lib/write-freeze'
import { syncProductCanonicalFields } from '@/lib/pim-canonical'
import { writePimAudit } from '@/lib/pim-audit'

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Unknown error'
}

function hasInvalidCanonicalSalePrice(listPrice: number | null | undefined, salePrice: number | null | undefined) {
    return salePrice != null && (listPrice == null || salePrice >= listPrice)
}

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
    price: z.coerce.number().nonnegative().optional().nullable(),
    original_price: z.coerce.number().positive().optional().nullable(),
    list_price: z.coerce.number().positive().optional().nullable(),
    sale_price: z.coerce.number().positive().optional().nullable(),
    online_discount_amount: z.coerce.number().min(0).optional().nullable(),
    price_display: z.string().max(50).optional().default('Liên hệ báo giá'),
    description: z.string().optional().nullable(),
    features: z.string().optional().nullable(),
    specs: z.record(z.string(), z.unknown()).optional().default({}),
    warranty_months: z.coerce.number().int().positive().optional().nullable(),
    image_main_url: z.string().url().max(1000).optional().nullable().or(z.literal('')),

    stock_status: z.enum(['in_stock', 'out_of_stock', 'discontinued', 'pre_order', 'contact']).default('in_stock'),
    is_active: z.boolean().default(true),
    is_featured: z.boolean().default(false),
    is_home_featured: z.boolean().default(false),
    is_promotion: z.boolean().default(false),
    is_combo: z.boolean().default(false),
    is_master: z.boolean().default(true),
    sort_order: z.coerce.number().int().default(0),
    product_type: z.string().max(50).optional().nullable(),
    product_sub_type: z.string().max(50).optional().nullable(),
    product_type_id: z.coerce.number().int().positive().optional().nullable(),
    product_sub_type_id: z.coerce.number().int().positive().optional().nullable(),
    taxon_assignments: z.array(z.object({
        taxon_id: z.coerce.number().int().positive(),
        is_primary: z.boolean().default(false),
        sort_order: z.coerce.number().int().default(0),
    })).max(20).optional(),
    publication_status: z.enum(['draft', 'public']).optional(),
    pdp_visibility: z.enum(['public', 'hidden']).optional(),
    listing_visibility: z.enum(['default', 'low_priority', 'hidden']).optional(),
    search_visibility: z.enum(['visible', 'hidden']).optional(),
    sellable_status: z.enum(['sellable', 'not_sellable', 'discontinued']).optional(),
    seo_indexing: z.enum(['index', 'noindex']).optional(),
    sitemap_include: z.boolean().optional(),
    source_url: z.string().url().max(1000).optional().nullable().or(z.literal('')),
    hita_product_id: z.string().max(100).optional().nullable(),
    seo_title: z.string().max(200).optional().nullable(),
    seo_description: z.string().max(500).optional().nullable(),
})

// ─── CREATE ──────────────────────────────────────────────────────────────────

export async function createProduct(data: unknown) {
    const actor = await requirePermission('products:write')

    const validated = productSchema.safeParse(data)
    if (!validated.success) {
        return { errors: validated.error.flatten().fieldErrors }
    }
    const d = validated.data
    if (hasInvalidCanonicalSalePrice(d.list_price, d.sale_price)) {
        return { success: false, error: 'Sale price phải nhỏ hơn list price' }
    }

    // Validation: không cho is_active=true nếu thiếu price hoặc ảnh chính
    if (d.is_active === true) {
        if (d.stock_status !== 'contact' && !d.price && !d.list_price && !d.sale_price)
            return { success: false, error: 'Sản phẩm cần có giá trước khi kích hoạt' }
        if (!d.image_main_url || d.image_main_url.trim() === '')
            return { success: false, error: 'Sản phẩm cần có ảnh chính trước khi kích hoạt' }
    }

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
            list_price: d.list_price ? d.list_price : null,
            sale_price: d.sale_price ? d.sale_price : null,
            online_discount_amount: d.online_discount_amount ? d.online_discount_amount : null,
            price_display: d.price_display || 'Liên hệ báo giá',
            description: d.description || null,
            features: d.features || null,
            specs: (d.specs || {}) as Prisma.InputJsonValue,
            warranty_months: d.warranty_months || null,
            image_main_url: d.image_main_url || null,

            stock_status: d.stock_status,
            is_active: d.is_active,
            is_featured: d.is_featured,
            is_home_featured: d.is_home_featured,
            is_promotion: d.is_promotion,
            is_combo: d.is_combo,
            is_master: d.is_master,
            sort_order: d.sort_order,
            product_type: d.product_type || null,
            product_sub_type: d.product_sub_type || null,
            source_url: d.source_url || null,
            hita_product_id: d.hita_product_id || null,
            seo_title: d.seo_title || null,
            seo_description: d.seo_description || null,
            ...(d.publication_status !== undefined ? { publication_status: d.publication_status } : {}),
            ...(d.pdp_visibility !== undefined ? { pdp_visibility: d.pdp_visibility } : {}),
            ...(d.listing_visibility !== undefined ? { listing_visibility: d.listing_visibility } : {}),
            ...(d.search_visibility !== undefined ? { search_visibility: d.search_visibility } : {}),
            ...(d.sellable_status !== undefined ? { sellable_status: d.sellable_status } : {}),
            ...(d.seo_indexing !== undefined ? { seo_indexing: d.seo_indexing } : {}),
            ...(d.sitemap_include !== undefined ? { sitemap_include: d.sitemap_include } : {}),
        }
        const product = await prisma.$transaction(async (tx) => {
            const created = await tx.products.create({ data: createData })
            await syncProductCanonicalFields(tx, actor.id, created.id, {
                brand_id: d.brand_id,
                product_type_id: d.product_type_id,
                product_sub_type_id: d.product_sub_type_id,
                ...(d.taxon_assignments !== undefined ? { taxon_assignments: d.taxon_assignments } : {}),
            })
            await writePimAudit(tx, { userId: actor.id, action: 'pim.product_editor.created', entityType: 'product', entityId: created.id, changedFields: Object.keys(createData) })
            return created
        })
        revalidatePath('/admin/products')
        revalidatePath('/')
        return { success: true, id: product.id }
    } catch (err: unknown) {
        const freezeResult = toWriteFreezeActionResult(err)
        if (freezeResult) return freezeResult
        const e = err as { code?: string; message?: string }
        if (e.code === 'P2002') return { message: 'SKU hoặc slug đã tồn tại trong cùng danh mục' }
        return { message: 'Lỗi tạo sản phẩm: ' + (e.message ?? 'Unknown error') }
    }
}

// ─── UPDATE ──────────────────────────────────────────────────────────────────

export async function updateProduct(id: number, data: unknown) {
    const actor = await requirePermission('products:write')

    const validated = productSchema.safeParse(data)
    if (!validated.success) {
        return { errors: validated.error.flatten().fieldErrors }
    }
    const d = validated.data
    if (hasInvalidCanonicalSalePrice(d.list_price, d.sale_price)) {
        return { success: false, error: 'Sale price phải nhỏ hơn list price' }
    }

    // Validation: không cho is_active=true nếu thiếu price hoặc ảnh chính
    if (d.is_active === true) {
        if (d.stock_status !== 'contact' && !d.price && !d.list_price && !d.sale_price)
            return { success: false, error: 'Sản phẩm cần có giá trước khi kích hoạt' }
        if (!d.image_main_url || d.image_main_url.trim() === '')
            return { success: false, error: 'Sản phẩm cần có ảnh chính trước khi kích hoạt' }
    }

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
            list_price: d.list_price ? d.list_price : null,
            sale_price: d.sale_price ? d.sale_price : null,
            online_discount_amount: d.online_discount_amount ? d.online_discount_amount : null,
            price_display: d.price_display || 'Liên hệ báo giá',
            description: d.description || null,
            features: d.features || null,
            specs: (d.specs || {}) as Prisma.InputJsonValue,
            warranty_months: d.warranty_months || null,
            image_main_url: d.image_main_url || null,

            stock_status: d.stock_status,
            is_active: d.is_active,
            is_featured: d.is_featured,
            is_home_featured: d.is_home_featured,
            is_promotion: d.is_promotion,
            is_combo: d.is_combo,
            is_master: d.is_master,
            sort_order: d.sort_order,
            product_type: d.product_type || null,
            product_sub_type: d.product_sub_type || null,
            source_url: d.source_url || null,
            hita_product_id: d.hita_product_id || null,
            seo_title: d.seo_title || null,
            seo_description: d.seo_description || null,
            ...(d.publication_status !== undefined ? { publication_status: d.publication_status } : {}),
            ...(d.pdp_visibility !== undefined ? { pdp_visibility: d.pdp_visibility } : {}),
            ...(d.listing_visibility !== undefined ? { listing_visibility: d.listing_visibility } : {}),
            ...(d.search_visibility !== undefined ? { search_visibility: d.search_visibility } : {}),
            ...(d.sellable_status !== undefined ? { sellable_status: d.sellable_status } : {}),
            ...(d.seo_indexing !== undefined ? { seo_indexing: d.seo_indexing } : {}),
            ...(d.sitemap_include !== undefined ? { sitemap_include: d.sitemap_include } : {}),
            updated_at: new Date(),
        }
        await prisma.$transaction(async (tx) => {
            await tx.products.update({ where: { id }, data: updateData })
            await syncProductCanonicalFields(tx, actor.id, id, {
                brand_id: d.brand_id,
                product_type_id: d.product_type_id,
                product_sub_type_id: d.product_sub_type_id,
                ...(d.taxon_assignments !== undefined ? { taxon_assignments: d.taxon_assignments } : {}),
            })
            await writePimAudit(tx, { userId: actor.id, action: 'pim.product_editor.updated', entityType: 'product', entityId: id, changedFields: Object.keys(updateData) })
        })
        // Revalidate category listing + product detail
        revalidatePath('/admin/products')
        revalidatePath(`/admin/products/${id}`)
        revalidatePath('/')
        return { success: true }
    } catch (err: unknown) {
        const freezeResult = toWriteFreezeActionResult(err)
        if (freezeResult) return freezeResult
        const e = err as { code?: string; message?: string }
        if (e.code === 'P2002') return { message: 'SKU hoặc slug đã tồn tại trong cùng danh mục' }
        return { message: 'Lỗi cập nhật sản phẩm: ' + (e.message ?? 'Unknown error') }
    }
}

// ─── TOGGLE FIELDS ───────────────────────────────────────────────────────────

export async function toggleProductFeatured(id: number, value: boolean) {
    await requirePermission('products:write')

    try {
        await prisma.products.update({ where: { id }, data: { is_featured: value, updated_at: new Date() } })
        revalidatePath('/admin/products')
        revalidatePath('/')
        return { success: true }
    } catch (err: unknown) {
        const freezeResult = toWriteFreezeActionResult(err)
        if (freezeResult) return freezeResult
        return { message: 'Lỗi cập nhật: ' + errorMessage(err) }
    }
}

export async function toggleProductActive(id: number, value: boolean) {
    await requirePermission('products:write')

    // Guard: cannot activate stub products missing price or image
    if (value === true) {
        const product = await prisma.products.findUnique({
            where: { id },
            select: { price: true, image_main_url: true },
        })
        if (!product) return { message: 'Không tìm thấy sản phẩm' }
        if (!product.price || Number(product.price) === 0)
            return { success: false, error: 'Sản phẩm cần có giá trước khi kích hoạt' }
        if (!product.image_main_url || product.image_main_url.trim() === '')
            return { success: false, error: 'Sản phẩm cần có ảnh chính trước khi kích hoạt' }
    }
    try {
        await prisma.products.update({ where: { id }, data: { is_active: value, updated_at: new Date() } })
        revalidatePath('/admin/products')
        return { success: true }
    } catch (err: unknown) {
        const freezeResult = toWriteFreezeActionResult(err)
        if (freezeResult) return freezeResult
        return { message: 'Lỗi cập nhật: ' + errorMessage(err) }
    }
}

// ─── DELETE ──────────────────────────────────────────────────────────────────

export async function deleteProduct(id: number) {
    await requirePermission('products:delete')

    try {
        await prisma.products.delete({ where: { id } })
        revalidatePath('/admin/products')
        revalidatePath('/')
        return { success: true }
    } catch (err: unknown) {
        const freezeResult = toWriteFreezeActionResult(err)
        if (freezeResult) return freezeResult
        return { message: 'Lỗi xóa sản phẩm: ' + errorMessage(err) }
    }
}

// ─── BULK OPERATIONS ─────────────────────────────────────────────────────────

export async function bulkDeleteProducts(ids: number[]) {
    await requirePermission('products:delete')

    try {
        const result = await prisma.products.deleteMany({ where: { id: { in: ids } } })
        revalidatePath('/admin/products')
        revalidatePath('/')
        return { success: true, count: result.count }
    } catch (err: unknown) {
        const freezeResult = toWriteFreezeActionResult(err)
        if (freezeResult) return freezeResult
        return { message: 'Lỗi xóa nhiều sản phẩm: ' + errorMessage(err) }
    }
}

export async function bulkToggleActive(ids: number[], value: boolean) {
    await requirePermission('products:write')

    try {
        const result = await prisma.products.updateMany({
            where: { id: { in: ids } },
            data: { is_active: value, updated_at: new Date() },
        })
        revalidatePath('/admin/products')
        return { success: true, count: result.count }
    } catch (err: unknown) {
        const freezeResult = toWriteFreezeActionResult(err)
        if (freezeResult) return freezeResult
        return { message: 'Lỗi cập nhật trạng thái: ' + errorMessage(err) }
    }
}

// ─── PRODUCT IMAGES ──────────────────────────────────────────────────────────

export async function addProductImage(productId: number, imageUrl: string, altText?: string, imageType = 'gallery') {
    await requirePermission('products:write')

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
        const freezeResult = toWriteFreezeActionResult(err)
        if (freezeResult) return freezeResult
        const e = err as { message?: string }
        return { message: 'Lỗi thêm ảnh: ' + (e.message ?? 'Unknown error') }
    }
}

export async function addProductImages(productId: number, imageUrls: string[]) {
    await requirePermission('products:write')

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
    } catch (err: unknown) {
        const freezeResult = toWriteFreezeActionResult(err)
        if (freezeResult) return freezeResult
        return { message: 'Lỗi thêm ảnh: ' + errorMessage(err) }
    }
}

export async function deleteProductImage(imageId: number, productId: number) {
    await requirePermission('products:write')

    try {
        await prisma.product_images.delete({ where: { id: imageId } })
        revalidatePath(`/admin/products/${productId}`)
        return { success: true }
    } catch (err: unknown) {
        const freezeResult = toWriteFreezeActionResult(err)
        if (freezeResult) return freezeResult
        return { message: 'Lỗi xóa ảnh: ' + errorMessage(err) }
    }
}

export async function setProductThumbnail(productId: number, imageUrl: string) {
    await requirePermission('products:write')

    try {
        await prisma.products.update({
            where: { id: productId },
            data: { image_main_url: imageUrl, updated_at: new Date() },
        })
        revalidatePath(`/admin/products/${productId}`)
        revalidatePath('/admin/products')
        revalidatePath('/')
        return { success: true }
    } catch (err: unknown) {
        const freezeResult = toWriteFreezeActionResult(err)
        if (freezeResult) return freezeResult
        return { message: 'Lỗi đặt thumbnail: ' + errorMessage(err) }
    }
}

export async function updateProductImageSortOrder(productId: number, imageIds: number[]) {
    await requirePermission('products:write')

    try {
        // Bulk update is tricky in Prisma, so we do a transaction
        const updates = imageIds.map((id, index) => 
            prisma.product_images.update({
                where: { id },
                data: { sort_order: index }
            })
        )
        await prisma.$transaction(updates)
        revalidatePath(`/admin/products/${productId}`)
        return { success: true }
    } catch (err: unknown) {
        const freezeResult = toWriteFreezeActionResult(err)
        if (freezeResult) return freezeResult
        return { message: 'Lỗi cập nhật thứ tự: ' + errorMessage(err) }
    }
}

// ─── SEARCH PRODUCTS (For Combo & Relationships) ─────────────────────────────
export async function searchProducts(query: string, excludeId?: number) {
    await requirePermission('products:read')

    try {
        const whereClause: Prisma.productsWhereInput = {
            ...(excludeId ? { id: { not: excludeId } } : {})
        };

        if (query && query.length > 0) {
            whereClause.OR = [
                { name: { contains: query, mode: 'insensitive' } },
                { sku: { contains: query, mode: 'insensitive' } },
            ];
        }

        const results = await prisma.products.findMany({
            where: whereClause,
            orderBy: query ? { created_at: 'desc' } : { created_at: 'desc' }, // always recent
            select: {
                id: true,
                sku: true,
                name: true,
                price: true,
                image_main_url: true,
                stock_status: true
            },
            take: 10
        });
        return results.map(r => ({
            ...r,
            price: r.price ? Number(r.price) : null
        }));
    } catch (err: unknown) {
        console.error("searchProducts error:", err);
        return [];
    }
}

// ─── RELATIONSHIPS (COMBO/RELATED) ───────────────────────────────────────────
export async function addProductRelationship(parentId: number, childId: number, childSku: string, relationshipType: string = 'component') {
    await requirePermission('products:write')

    try {
        const existingCount = await prisma.product_relationships.count({
            where: { parent_id: parentId, relationship_type: relationshipType }
        });
        
        await prisma.product_relationships.create({
            data: {
                parent_id: parentId,
                child_id: childId,
                child_sku: childSku,
                relationship_type: relationshipType,
                sort_order: existingCount
            }
        });
        revalidatePath(`/admin/products/${parentId}`);
        return { success: true };
    } catch (err: unknown) {
        const freezeResult = toWriteFreezeActionResult(err)
        if (freezeResult) return freezeResult
        return { message: 'Lỗi thêm sản phẩm liên kết: ' + errorMessage(err) };
    }
}

export async function removeProductRelationship(id: number, parentId: number) {
    await requirePermission('products:write')

    try {
        await prisma.product_relationships.delete({
            where: { id }
        });
        revalidatePath(`/admin/products/${parentId}`);
        return { success: true };
    } catch (err: unknown) {
        const freezeResult = toWriteFreezeActionResult(err)
        if (freezeResult) return freezeResult
        return { message: 'Lỗi xóa sản phẩm liên kết: ' + errorMessage(err) };
    }
}

// ─── VARIANTS MANAGEMENT ───────────────────────────────────────────────────

export async function getProductVariants(variantGroup: string | null) {
    await requirePermission('products:read')

    if (!variantGroup) return [];
    try {
        const variants = await prisma.products.findMany({
            where: { variant_group: variantGroup },
            select: {
                id: true,
                sku: true,
                name: true,
                price: true,
                image_main_url: true,
                variant_group: true,
                colors: { select: { name: true, hex_code: true } }
            },
            orderBy: { id: 'asc' }
        });
        
        // Serialize price Decimal to Number
        return variants.map(v => ({
            ...v,
            price: v.price ? Number(v.price) : null
        }));
    } catch (err: unknown) {
        console.error('Error fetching variants:', err);
        return [];
    }
}

export async function linkVariant(currentProductId: number, targetProductId: number) {
    await requirePermission('products:write')

    try {
        const currentProduct = await prisma.products.findUnique({
            where: { id: currentProductId },
            select: { variant_group: true }
        });

        if (!currentProduct) {
            return { message: 'Không tìm thấy sản phẩm hiện tại.' };
        }

        // Lấy hoặc tạo variant_group mới (VD: VG-<timestamp>)
        const variantGroup = currentProduct.variant_group || `VG-${Date.now()}`;

        // Nếu sản phẩm hiện tại chưa có variant_group thì cập nhật nó trước
        if (!currentProduct.variant_group) {
            await prisma.products.update({
                where: { id: currentProductId },
                data: { variant_group: variantGroup }
            });
        }

        // Cập nhật sản phẩm mục tiêu (target) vào chung variant_group
        await prisma.products.update({
            where: { id: targetProductId },
            data: { variant_group: variantGroup }
        });

        revalidatePath(`/admin/products/${currentProductId}`);
        return { success: true };
    } catch (err: unknown) {
        const freezeResult = toWriteFreezeActionResult(err)
        if (freezeResult) return freezeResult
        console.error('Error linking variant:', err);
        return { message: 'Lỗi khi liên kết biến thể: ' + errorMessage(err) };
    }
}

export async function unlinkVariant(productId: number, currentProductId: number) {
    await requirePermission('products:write')

    try {
        await prisma.products.update({
            where: { id: productId },
            data: { variant_group: null }
        });

        revalidatePath(`/admin/products/${currentProductId}`);
        return { success: true };
    } catch (err: unknown) {
        const freezeResult = toWriteFreezeActionResult(err)
        if (freezeResult) return freezeResult
        console.error('Error unlinking variant:', err);
        return { message: 'Lỗi khi hủy liên kết biến thể: ' + errorMessage(err) };
    }
}

export async function bulkToggleFeatured(ids: number[], value: boolean) {
    await requirePermission('products:write')

    try {
        const result = await prisma.products.updateMany({
            where: { id: { in: ids } },
            data: { is_featured: value, updated_at: new Date() },
        })
        revalidatePath('/admin/products')
        revalidatePath('/')
        return { success: true, count: result.count }
    } catch (error) {
        const freezeResult = toWriteFreezeActionResult(error)
        if (freezeResult) return freezeResult
        console.error('Lỗi bulkToggleFeatured:', error)
        return { success: false, message: 'Lỗi server' }
    }
}

// ─── REORDER ─────────────────────────────────────────────────────────────────

export async function updateProductSortOrders(updates: { id: number; sort_order: number }[]) {
    await requirePermission('products:write')

    try {
        await prisma.$transaction(
            updates.map((u) =>
                prisma.products.update({
                    where: { id: u.id },
                    data: { sort_order: u.sort_order }
                })
            )
        )
        revalidatePath('/admin/products')
        revalidatePath('/')
        return { success: true }
    } catch (err: unknown) {
        const freezeResult = toWriteFreezeActionResult(err)
        if (freezeResult) return freezeResult
        console.error('Error updating sort orders:', err)
        return { success: false, message: 'Lỗi cập nhật vị trí' }
    }
}
