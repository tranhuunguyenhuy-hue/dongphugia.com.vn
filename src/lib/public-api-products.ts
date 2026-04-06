import { unstable_cache } from 'next/cache'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'

// ─── TYPES ───────────────────────────────────────────────────────────────────

export type ProductListItem = {
    id: number
    sku: string
    name: string
    slug: string
    category_id: number
    subcategory_id: number | null
    brand_id: number | null
    price: number | null
    price_display: string | null
    image_main_url: string | null
    image_hover_url: string | null
    stock_status: string
    is_active: boolean
    is_featured: boolean
    is_new: boolean
    is_bestseller: boolean
    sort_order: number
    categories: { name: string; slug: string }
    subcategories: { name: string; slug: string } | null
    brands: { name: string; slug: string } | null
}

export type ProductFilters = {
    category_slug?: string
    subcategory_slug?: string
    brand_id?: number
    is_featured?: boolean
    is_new?: boolean
    is_active?: boolean
    search?: string
    page?: number
    pageSize?: number
    sortBy?: 'sort_order' | 'created_at' | 'name' | 'price'
    sortDir?: 'asc' | 'desc'
}

// ─── PUBLIC: LIST PRODUCTS (with filters + pagination) ───────────────────────

export async function getPublicProducts(filters: ProductFilters = {}) {
    const {
        category_slug,
        subcategory_slug,
        brand_id,
        is_featured,
        is_new,
        search,
        page = 1,
        pageSize = 24,
        sortBy = 'sort_order',
        sortDir = 'asc',
    } = filters

    const where: Prisma.productsWhereInput = {
        is_active: true,
        ...(category_slug && { categories: { slug: category_slug } }),
        ...(subcategory_slug && { subcategories: { slug: subcategory_slug } }),
        ...(brand_id && { brand_id }),
        ...(is_featured !== undefined && { is_featured }),
        ...(is_new !== undefined && { is_new }),
        ...(search && {
            OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ],
        }),
    }

    const orderBy: Prisma.productsOrderByWithRelationInput =
        sortBy === 'price' ? { price: sortDir } :
        sortBy === 'name' ? { name: sortDir } :
        sortBy === 'created_at' ? { created_at: sortDir } :
        { sort_order: sortDir }

    const [products, total] = await Promise.all([
        prisma.products.findMany({
            where,
            orderBy,
            skip: (page - 1) * pageSize,
            take: pageSize,
            select: {
                id: true,
                sku: true,
                name: true,
                slug: true,
                category_id: true,
                subcategory_id: true,
                brand_id: true,
                price: true,
                price_display: true,
                image_main_url: true,
                image_hover_url: true,
                stock_status: true,
                is_active: true,
                is_featured: true,
                is_new: true,
                is_bestseller: true,
                sort_order: true,
                categories: { select: { name: true, slug: true } },
                subcategories: { select: { name: true, slug: true } },
                brands: { select: { name: true, slug: true } },
            },
        }),
        prisma.products.count({ where }),
    ])

    return {
        products: products.map(p => ({ ...p, price: p.price ? Number(p.price) : null })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
    }
}

// ─── PUBLIC: PRODUCT DETAIL ──────────────────────────────────────────────────

export async function getPublicProductBySlug(categorySlug: string, slug: string) {
    return prisma.products.findFirst({
        where: {
            slug,
            is_active: true,
            categories: { slug: categorySlug },
        },
        include: {
            categories: { select: { id: true, name: true, slug: true } },
            subcategories: { select: { id: true, name: true, slug: true } },
            brands: { select: { id: true, name: true, slug: true, logo_url: true, website_url: true } },
            origins: { select: { id: true, name: true, slug: true } },
            colors: { select: { id: true, name: true, slug: true, hex_code: true } },
            materials: { select: { id: true, name: true, slug: true } },
            product_images: {
                orderBy: [{ image_type: 'asc' }, { sort_order: 'asc' }],
            },
            product_feature_values: {
                include: { product_features: { select: { name: true, icon_name: true } } },
                orderBy: { product_features: { sort_order: 'asc' } },
            },
        },
    })
}

// ─── CACHED: FEATURED PRODUCTS (per category) ────────────────────────────────

export const getFeaturedProductsByCategorySlug = unstable_cache(
    async (categorySlug: string, limit = 8) => {
        const products = await prisma.products.findMany({
            where: {
                is_active: true,
                is_featured: true,
                categories: { slug: categorySlug },
            },
            orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }],
            take: limit,
            select: {
                id: true,
                name: true,
                slug: true,
                price: true,
                price_display: true,
                image_main_url: true,
                image_hover_url: true,
                is_new: true,
                is_bestseller: true,
                stock_status: true,
                categories: { select: { slug: true } },
                brands: { select: { name: true, slug: true } },
            },
        })
        return products.map(p => ({ ...p, price: p.price ? Number(p.price) : null }))
    },
    ['featured-products'],
    { revalidate: 3600, tags: ['products', 'featured-products'] }
)

// ─── CACHED: NEW ARRIVALS ─────────────────────────────────────────────────────

export const getNewArrivals = unstable_cache(
    async (limit = 12) => {
        const products = await prisma.products.findMany({
            where: { is_active: true, is_new: true },
            orderBy: { created_at: 'desc' },
            take: limit,
            select: {
                id: true,
                name: true,
                slug: true,
                price: true,
                price_display: true,
                image_main_url: true,
                is_new: true,
                is_bestseller: true,
                categories: { select: { name: true, slug: true } },
                brands: { select: { name: true, slug: true } },
            },
        })
        return products.map(p => ({ ...p, price: p.price ? Number(p.price) : null }))
    },
    ['new-arrivals'],
    { revalidate: 3600, tags: ['products', 'new-arrivals'] }
)

// ─── ADMIN: LIST ALL (with pagination + search, no RLS filter) ───────────────

export async function getAdminProducts(params: {
    search?: string
    category_id?: number
    is_active?: boolean
    page?: number
    pageSize?: number
}) {
    const { search, category_id, is_active, page = 1, pageSize = 50 } = params

    const where: Prisma.productsWhereInput = {
        ...(search && {
            OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
            ],
        }),
        ...(category_id && { category_id }),
        ...(is_active !== undefined && { is_active }),
    }

    const [products, total] = await Promise.all([
        prisma.products.findMany({
            where,
            orderBy: [{ category_id: 'asc' }, { sort_order: 'asc' }, { created_at: 'desc' }],
            skip: (page - 1) * pageSize,
            take: pageSize,
            select: {
                id: true,
                sku: true,
                name: true,
                slug: true,
                price: true,
                price_display: true,
                image_main_url: true,
                stock_status: true,
                is_active: true,
                is_featured: true,
                is_new: true,
                sort_order: true,
                created_at: true,
                categories: { select: { name: true, slug: true } },
                brands: { select: { name: true } },
            },
        }),
        prisma.products.count({ where }),
    ])

    return {
        products: products.map(p => ({ ...p, price: p.price ? Number(p.price) : null })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
    }
}

// ─── ADMIN: PRODUCT DETAIL (full data for edit form) ─────────────────────────

export async function getAdminProductById(id: number) {
    const p = await prisma.products.findUnique({
        where: { id },
        include: {
            categories: { select: { id: true, name: true, slug: true } },
            subcategories: { select: { id: true, name: true, slug: true } },
            brands: { select: { id: true, name: true, slug: true } },
            origins: { select: { id: true, name: true, slug: true } },
            colors: { select: { id: true, name: true, hex_code: true } },
            materials: { select: { id: true, name: true, slug: true } },
            product_images: { orderBy: [{ image_type: 'asc' }, { sort_order: 'asc' }] },
            product_feature_values: {
                include: { product_features: true },
            },
        },
    })
    if (!p) return null
    return { ...p, price: p.price ? Number(p.price) : null }
}

// ─── STATS ───────────────────────────────────────────────────────────────────

export async function getProductStats() {
    const [total, active, featured, outOfStock] = await Promise.all([
        prisma.products.count(),
        prisma.products.count({ where: { is_active: true } }),
        prisma.products.count({ where: { is_featured: true } }),
        prisma.products.count({ where: { stock_status: 'out_of_stock' } }),
    ])
    return { total, active, featured, outOfStock }
}
