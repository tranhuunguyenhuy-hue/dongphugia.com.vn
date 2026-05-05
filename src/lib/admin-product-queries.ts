'use server'

import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// ─── TYPES ───────────────────────────────────────────────────────────────────

export type StockStatus = 'in_stock' | 'out_of_stock' | 'preorder'

export interface AdminProductsParams {
  search?: string
  categoryId?: number
  subcategoryId?: number
  productType?: string
  stockStatus?: StockStatus
  isActive?: boolean
  brandId?: number
  page?: number
  pageSize?: number
  orderBy?: 'created_at' | 'updated_at' | 'name' | 'sort_order'
  orderDir?: 'asc' | 'desc'
}

// ─── GET ADMIN PRODUCTS (list + filter + search + paginate) ───────────────────

/**
 * Primary query for the /products admin listing page.
 * Supports cascade filters: category → subcategory → product_type → stock_status
 * Also handles search by name and SKU.
 */
export async function getAdminProducts(params: AdminProductsParams = {}) {
  const {
    search,
    categoryId,
    subcategoryId,
    productType,
    stockStatus,
    isActive,
    brandId,
    page = 1,
    pageSize = 25,
    orderBy = 'updated_at',
    orderDir = 'desc',
  } = params

  const where: Prisma.productsWhereInput = {
    ...(categoryId && { category_id: categoryId }),
    ...(subcategoryId && { subcategory_id: subcategoryId }),
    ...(productType && { product_type: productType }),
    ...(stockStatus && { stock_status: stockStatus }),
    ...(isActive !== undefined && { is_active: isActive }),
    ...(brandId && { brand_id: brandId }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { sku: { contains: search, mode: 'insensitive' as const } },
        { display_name: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
  }

  const [products, total] = await Promise.all([
    prisma.products.findMany({
      where,
      orderBy: { [orderBy]: orderDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        sku: true,
        name: true,
        display_name: true,
        slug: true,
        image_main_url: true,
        price: true,
        price_display: true,
        stock_status: true,
        is_active: true,
        is_featured: true,
        is_promotion: true,
        
        product_type: true,
        product_sub_type: true,
        sort_order: true,
        created_at: true,
        updated_at: true,
        categories: { select: { id: true, name: true, slug: true } },
        subcategories: { select: { id: true, name: true, slug: true } },
        brands: { select: { id: true, name: true, logo_url: true } },
        _count: { select: { product_images: true } },
      },
    }),
    prisma.products.count({ where }),
  ])

  return {
    products: products.map(p => ({
      ...p,
      price: p.price ? Number(p.price) : null,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

// ─── GET ADMIN PRODUCT BY ID (form pre-fill) ─────────────────────────────────

/**
 * Full product detail for the edit form — includes all relations and images.
 */
export async function getAdminProductById(id: number) {
  const product = await prisma.products.findUnique({
    where: { id },
    include: {
      categories: { select: { id: true, name: true, slug: true } },
      subcategories: { select: { id: true, name: true, slug: true } },
      brands: { select: { id: true, name: true } },
      origins: { select: { id: true, name: true } },
      colors: { select: { id: true, name: true, hex_code: true } },
      materials: { select: { id: true, name: true } },
      product_images: {
        orderBy: { sort_order: 'asc' },
        select: {
          id: true,
          image_url: true,
          alt_text: true,
          image_type: true,
          sort_order: true,
        },
      },
      product_feature_values: {
        include: {
          product_features: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  })

  if (!product) return null

  return {
    ...product,
    price: product.price ? Number(product.price) : null,
    original_price: product.original_price ? Number(product.original_price) : null,
    specs: product.specs as Record<string, unknown>,
  }
}

// ─── BULK UPDATE STOCK STATUS ─────────────────────────────────────────────────

/**
 * Bulk action: update stock_status for multiple selected products.
 * Used by the BulkActionBar in the products DataTable.
 */
export async function bulkUpdateStockStatus(ids: number[], status: StockStatus) {
  const validStatuses: StockStatus[] = ['in_stock', 'out_of_stock', 'preorder']
  if (!validStatuses.includes(status)) {
    return { message: 'Trạng thái kho không hợp lệ' }
  }
  try {
    const result = await prisma.products.updateMany({
      where: { id: { in: ids } },
      data: { stock_status: status, updated_at: new Date() },
    })
    revalidatePath('/products')
    return { success: true, count: result.count }
  } catch (err: unknown) {
    const e = err as { message?: string }
    return { message: 'Lỗi cập nhật trạng thái kho: ' + (e.message ?? 'Unknown error') }
  }
}

// ─── GET PRODUCT FILTER OPTIONS (for cascade filter dropdowns) ────────────────

/**
 * Returns distinct product_type values for a given category/subcategory.
 * Populates the "Loại sản phẩm" filter dropdown.
 */
export async function getProductTypeOptions(params: {
  categoryId?: number
  subcategoryId?: number
}) {
  const { categoryId, subcategoryId } = params

  const products = await prisma.products.findMany({
    where: {
      ...(categoryId && { category_id: categoryId }),
      ...(subcategoryId && { subcategory_id: subcategoryId }),
      product_type: { not: null },
      is_active: true,
    },
    select: { product_type: true },
    distinct: ['product_type'],
    orderBy: { product_type: 'asc' },
  })

  return products
    .map(p => p.product_type)
    .filter((t): t is string => t !== null)
}

/**
 * Returns subcategories for a given category.
 * Populates the "Danh mục con" filter dropdown.
 */
export async function getSubcategoriesByCategory(categoryId: number) {
  return prisma.subcategories.findMany({
    where: { category_id: categoryId, is_active: true },
    select: { id: true, name: true, slug: true },
    orderBy: { sort_order: 'asc' },
  })
}

// ─── BRAND MANAGEMENT (inline in category page) ───────────────────────────────

const brandSchema = z.object({
  name: z.string().min(1, 'Tên thương hiệu là bắt buộc').max(200),
  slug: z.string().min(1, 'Slug là bắt buộc').max(200),
  logo_url: z.string().url().max(1000).optional().nullable().or(z.literal('')),
  description: z.string().optional().nullable(),
  origin_country: z.string().max(100).optional().nullable(),
  website_url: z.string().url().max(500).optional().nullable().or(z.literal('')),
  is_active: z.boolean().default(true),
  is_featured: z.boolean().default(false),
  sort_order: z.coerce.number().int().default(0),
})

/**
 * Returns brands that have at least one product in the given category.
 * Used by BrandChips section on /products?category=X page.
 */
export async function getBrandsByCategory(categoryId: number) {
  const brands = await prisma.brands.findMany({
    where: {
      products: {
        some: { category_id: categoryId },
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      logo_url: true,
      is_active: true,
      is_featured: true,
      sort_order: true,
      origin_country: true,
      _count: {
        select: {
          products: {
            where: { category_id: categoryId },
          },
        },
      },
    },
    orderBy: [{ is_featured: 'desc' }, { sort_order: 'asc' }, { name: 'asc' }],
  })

  return brands
}

/**
 * Get all brands (for global brand selector in product form).
 */
export async function getAllBrands() {
  return prisma.brands.findMany({
    where: { is_active: true },
    select: { id: true, name: true, slug: true, logo_url: true, origin_country: true },
    orderBy: { name: 'asc' },
  })
}

/**
 * Toggle brand visibility (is_active flag).
 * Used by the brand chip toggle button in the category page brand section.
 */
export async function toggleBrandVisibility(brandId: number, isActive: boolean) {
  try {
    await prisma.brands.update({
      where: { id: brandId },
      data: { is_active: isActive, updated_at: new Date() },
    })
    revalidatePath('/products')
    return { success: true }
  } catch (err: unknown) {
    const e = err as { message?: string }
    return { message: 'Lỗi cập nhật thương hiệu: ' + (e.message ?? 'Unknown error') }
  }
}

/**
 * Create a new brand.
 * Used by the "Thêm thương hiệu" dialog in the category page brand section.
 */
export async function createBrand(data: unknown) {
  const validated = brandSchema.safeParse(data)
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }
  const d = validated.data

  try {
    const brand = await prisma.brands.create({
      data: {
        name: d.name,
        slug: d.slug,
        logo_url: d.logo_url || null,
        description: d.description || null,
        origin_country: d.origin_country || null,
        website_url: d.website_url || null,
        is_active: d.is_active,
        is_featured: d.is_featured,
        sort_order: d.sort_order,
      },
    })
    revalidatePath('/products')
    return { success: true, id: brand.id }
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string }
    if (e.code === 'P2002') return { message: 'Slug thương hiệu đã tồn tại' }
    return { message: 'Lỗi tạo thương hiệu: ' + (e.message ?? 'Unknown error') }
  }
}

/**
 * Update an existing brand.
 */
export async function updateBrand(id: number, data: unknown) {
  const validated = brandSchema.safeParse(data)
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }
  const d = validated.data

  try {
    await prisma.brands.update({
      where: { id },
      data: {
        name: d.name,
        slug: d.slug,
        logo_url: d.logo_url || null,
        description: d.description || null,
        origin_country: d.origin_country || null,
        website_url: d.website_url || null,
        is_active: d.is_active,
        is_featured: d.is_featured,
        sort_order: d.sort_order,
        updated_at: new Date(),
      },
    })
    revalidatePath('/products')
    return { success: true }
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string }
    if (e.code === 'P2002') return { message: 'Slug thương hiệu đã tồn tại' }
    return { message: 'Lỗi cập nhật thương hiệu: ' + (e.message ?? 'Unknown error') }
  }
}
