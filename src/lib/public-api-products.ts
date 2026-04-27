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
    product_feature_values?: { product_features: { name: string; icon_name: string | null } }[]
}

export type ProductFilters = {
    category_slug?: string
    subcategory_slug?: string // Legacy
    subcategory_slugs?: string | string[]
    product_type?: string | string[] // e.g. 'bon-cau-1-khoi', 'bon-cau-2-khoi'
    brand_id?: number // Legacy
    brand_slug?: string | string[]
    color_id?: number // Legacy
    color_slug?: string | string[]
    material_id?: number // Legacy
    material_slug?: string | string[]
    origin_id?: number // Legacy
    origin_slug?: string | string[]
    feature_slugs?: string | string[]
    // Spec-based filters (from filter_definitions with source='specs')
    // Format: { "Kiểu thoát": "Thoát sàn", "Loại nắp": "Nắp đóng êm" }
    spec_filters?: Record<string, string | string[]>
    is_featured?: boolean
    is_new?: boolean
    is_bestseller?: boolean
    is_active?: boolean
    price_min?: number
    price_max?: number
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
        subcategory_slugs,
        product_type,
        brand_id,
        brand_slug,
        color_id,
        color_slug,
        material_id,
        material_slug,
        origin_id,
        origin_slug,
        feature_slugs,
        spec_filters,
        is_featured,
        is_new,
        is_bestseller,
        price_min,
        price_max,
        search,
        page = 1,
        pageSize = 24,
        sortBy = 'created_at',
        sortDir = 'desc',
    } = filters

    const toArray = (val: string | string[] | undefined) => val ? (Array.isArray(val) ? val : val.split(',')) : undefined

    // Build subcategory filter: include products from both primary and secondary subcategories
    const subcatSlugs = subcategory_slugs ? toArray(subcategory_slugs) : (subcategory_slug ? [subcategory_slug] : undefined)
    const subcatFilter: Prisma.productsWhereInput | undefined = subcatSlugs ? {
        OR: [
            { subcategories: { slug: { in: subcatSlugs } } },
            { secondary_subcategories: { some: { subcategories: { slug: { in: subcatSlugs } } } } },
        ]
    } : undefined

    const where: Prisma.productsWhereInput = {
        is_active: true,
        ...(category_slug && { categories: { slug: category_slug } }),
        ...subcatFilter,
        ...(product_type && { product_type: { in: toArray(product_type) } }),
        ...(brand_id && { brand_id }),
        ...(brand_slug && { brands: { slug: { in: toArray(brand_slug) } } }),
        ...(color_id && { color_id }),
        ...(color_slug && { colors: { slug: { in: toArray(color_slug) } } }),
        ...(material_id && { material_id }),
        ...(material_slug && { materials: { slug: { in: toArray(material_slug) } } }),
        ...(origin_id && { origin_id }),
        ...(origin_slug && { origins: { slug: { in: toArray(origin_slug) } } }),
        ...(feature_slugs && {
            product_feature_values: {
                some: {
                    product_features: {
                        slug: { in: toArray(feature_slugs) }
                    }
                }
            }
        }),
        ...(is_featured !== undefined && { is_featured }),
        ...(is_new !== undefined && { is_new }),
        ...(is_bestseller !== undefined && { is_bestseller }),
        ...((price_min !== undefined || price_max !== undefined) && {
            price: {
                ...(price_min !== undefined && { gte: price_min }),
                ...(price_max !== undefined && { lte: price_max }),
            },
        }),
        ...(search && {
            OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ],
        }),
        // Spec-based filters: filter by JSON field values in specs column
        // Uses Prisma JsonFilter: path + string_contains for JSONB key matching
        ...(spec_filters && Object.keys(spec_filters).length > 0 && {
            AND: Object.entries(spec_filters).map(([key, value]) => {
                const values = String(value).split(',').map(v => v.trim()).filter(Boolean)
                if (values.length === 1) {
                    return { specs: { path: [key], string_contains: values[0] } } as Prisma.productsWhereInput
                }
                // Multiple values → OR between them
                return {
                    OR: values.map(v => ({ specs: { path: [key], string_contains: v } }))
                } as Prisma.productsWhereInput
            })
        }),
    }

    const orderBy: Prisma.productsOrderByWithRelationInput[] = []

    if (sortBy === 'price') {
        // Price sort: explicit user choice
        orderBy.push({ price: sortDir })
        orderBy.push({ is_featured: 'desc' })
    } else if (sortBy === 'name') {
        orderBy.push({ name: sortDir })
    } else if (sortBy === 'created_at') {
        orderBy.push({ created_at: sortDir })
        orderBy.push({ price: 'desc' })
    } else {
        // Default sort: featured → bestseller → has-variant-group → high price
        // Products with a variant_group (multi-variant) are surfaced before single products
        orderBy.push({ is_featured: 'desc' })
        orderBy.push({ is_bestseller: 'desc' })
        orderBy.push({ variant_group: { sort: 'asc', nulls: 'last' } })
        orderBy.push({ price: 'desc' })
    }

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
                display_name: true,
                slug: true,
                category_id: true,
                subcategory_id: true,
                brand_id: true,
                price: true,
                original_price: true,
                price_display: true,
                image_main_url: true,
                image_hover_url: true,
                stock_status: true,
                is_active: true,
                is_featured: true,
                is_new: true,
                is_bestseller: true,
                sort_order: true,
                product_type: true,
                categories: { select: { name: true, slug: true } },
                subcategories: { select: { name: true, slug: true } },
                brands: { select: { name: true, slug: true } },
                product_feature_values: { select: { product_features: { select: { name: true, icon_name: true } } } },
            },
        }),
        prisma.products.count({ where }),
    ])

    return {
        products: products.map(p => ({ ...p, price: p.price ? Number(p.price) : null, original_price: p.original_price ? Number(p.original_price) : null })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
    }
}

// ─── PUBLIC: GET AVAILABLE FILTERS (DYNAMIC) ─────────────────────────────────

export const getAvailableFilters = unstable_cache(
    async (categorySlug: string) => {
        // Query to get all subcategories, brands, materials, origins, features that are connected to an active product in this category.

        const [subcategories, brands, materials, origins, features] = await Promise.all([
            prisma.subcategories.findMany({
                where: { products: { some: { is_active: true, categories: { slug: categorySlug } } }, is_active: true },
                select: { name: true, slug: true, icon_name: true },
                orderBy: { sort_order: 'asc' }
            }),
            prisma.brands.findMany({
                where: { products: { some: { is_active: true, categories: { slug: categorySlug } } }, is_active: true },
                select: { name: true, slug: true, logo_url: true },
                orderBy: { sort_order: 'asc' }
            }),
            prisma.materials.findMany({
                where: { products: { some: { is_active: true, categories: { slug: categorySlug } } } },
                select: { name: true, slug: true },
                orderBy: { sort_order: 'asc' }
            }),
            prisma.origins.findMany({
                where: { products: { some: { is_active: true, categories: { slug: categorySlug } } } },
                select: { name: true, slug: true }
            }),
            prisma.product_features.findMany({
                where: { product_feature_values: { some: { products: { is_active: true, categories: { slug: categorySlug } } } } },
                select: { name: true, slug: true, icon_name: true },
                orderBy: { sort_order: 'asc' }
            })
        ])

        return {
            subcategories,
            brands,
            materials,
            origins,
            features
        }
    },
    ['available-filters'],
    { revalidate: 3600, tags: ['products', 'filters'] }
)

// ─── PUBLIC: GET SPEC FILTERS FOR SUBCATEGORY (from filter_definitions) ───────

export const getSubcategorySpecFilters = unstable_cache(
    async (subcategoryId: number) => {
        const defs = await prisma.filter_definitions.findMany({
            where: { subcategory_id: subcategoryId, is_active: true },
            orderBy: { sort_order: 'asc' },
            select: { filter_key: true, filter_label: true, filter_type: true, options: true }
        })

        // Only return filters with source='specs' that have options
        return defs
            .filter(d => {
                const opts = d.options as any
                return opts && opts.source === 'specs' && Array.isArray(opts.values) && opts.values.length > 0
            })
            .map(d => ({
                key: d.filter_key,
                label: d.filter_label,
                type: d.filter_type,
                values: (d.options as any).values as string[],
            }))
    },
    ['subcategory-spec-filters'],
    { revalidate: 3600, tags: ['filters'] }
)

// ─── PUBLIC: PRODUCT DETAIL ──────────────────────────────────────────────────

async function _getPublicProductBySlug(categorySlug: string, slug: string) {
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

export const getPublicProductBySlug = unstable_cache(
    _getPublicProductBySlug,
    ['product-detail'],
    { revalidate: 1800, tags: ['products', 'product-detail'] }
)

// ─── PUBLIC: GET VARIANT SIBLINGS (same variant_group) ────────────────────────

export type VariantSibling = {
    id: number
    sku: string
    name: string
    slug: string
    price: number | null
    price_display: string | null
    image_main_url: string | null
    subcategories: { slug: string } | null
    categories: { slug: string }
}

export const getVariantSiblings = unstable_cache(
    async (variantGroup: string, currentProductId: number): Promise<VariantSibling[]> => {
        if (!variantGroup) return []

        const siblings = await prisma.products.findMany({
            where: {
                variant_group: variantGroup,
                is_active: true,
                id: { not: currentProductId },
            },
            orderBy: [{ price: 'desc' }, { sku: 'asc' }],
            select: {
                id: true,
                sku: true,
                name: true,
                slug: true,
                price: true,
                price_display: true,
                image_main_url: true,
                subcategories: { select: { slug: true } },
                categories: { select: { slug: true } },
            },
        })

        return siblings.map(s => ({
            ...s,
            price: s.price ? Number(s.price) : null,
        }))
    },
    ['variant-siblings'],
    { revalidate: 3600, tags: ['products', 'variant-siblings'] }
)

// ─── PUBLIC: GET PRODUCT COMPONENTS (from product_relationships) ──────────────

export const getProductComponents = unstable_cache(
    async (productId: number) => {
        const rels = await prisma.product_relationships.findMany({
            where: { parent_id: productId, relationship_type: 'component' },
            orderBy: { sort_order: 'asc' },
            select: {
                id: true,
                child_sku: true,
                relationship_type: true,
                sort_order: true,
                child: {
                    select: {
                        id: true,
                        name: true,
                        display_name: true,
                        slug: true,
                        sku: true,
                        price: true,
                original_price: true,
                        price_display: true,
                        image_main_url: true,
                        subcategories: { select: { slug: true } },
                    }
                }
            }
        })
        // Serialize Decimal → number
        return rels.map(r => ({
            ...r,
            child: r.child ? { ...r.child, price: r.child.price ? Number(r.child.price) : null, original_price: r.child.original_price ? Number(r.child.original_price) : null } : null
        }))
    },
    ['product-components'],
    { revalidate: 3600, tags: ['products', 'product-components'] }
)

// ─── CACHED: FEATURED PRODUCTS (per category) ────────────────────────────────

export const getFeaturedProductsByCategorySlug = unstable_cache(
    async (categorySlug: string, brandSlug?: string | null, subcategorySlug?: string | null, skip = 0, take = 20) => {
        const whereClause: any = {
            is_active: true,
            categories: { slug: categorySlug },
        }
        
        if (brandSlug) {
            whereClause.brands = { slug: brandSlug }
        }
        
        if (subcategorySlug) {
            whereClause.subcategories = { slug: subcategorySlug }
        }

        const [products, total] = await Promise.all([
            prisma.products.findMany({
                where: whereClause,
                orderBy: [
                    { is_featured: 'desc' },  // featured products first
                    { sort_order: 'asc' },
                    { created_at: 'desc' },
                ],
                skip,
                take,
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    price: true,
                original_price: true,
                    price_display: true,
                    image_main_url: true,
                    image_hover_url: true,
                    is_new: true,
                    is_bestseller: true,
                    stock_status: true,
                    categories: { select: { slug: true } },
                    subcategories: { select: { name: true, slug: true } },
                    brands: { select: { name: true, slug: true } },
                    product_feature_values: { select: { product_features: { select: { name: true, icon_name: true } } } },
                },
            }),
            prisma.products.count({ where: whereClause })
        ])
        
        return {
            products: products.map(p => ({ ...p, price: p.price ? Number(p.price) : null, original_price: p.original_price ? Number(p.original_price) : null })),
            total
        }
    },
    ['featured-products'],
    { revalidate: 3600, tags: ['products', 'featured-products'] }
)


// ─── CACHED: TOP PRODUCTS PER BRAND (for homepage TBVS section) ──────────────
// Fetches N products per brand to ensure each brand is always represented.
// Returns flat array in brand priority order.

export const getTopProductsPerBrand = unstable_cache(
    async (categorySlug: string, brandSlugs: string[], perBrand = 8) => {
        const results = await Promise.all(
            brandSlugs.map(brandSlug =>
                prisma.products.findMany({
                    where: {
                        is_active: true,
                        is_featured: true,          // only admin-selected featured products
                        categories: { slug: categorySlug },
                        brands: { slug: brandSlug },
                    },
                    orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }],
                    take: perBrand,
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        price: true,
                original_price: true,
                        price_display: true,
                        image_main_url: true,
                        image_hover_url: true,
                        is_new: true,
                        is_bestseller: true,
                        stock_status: true,
                        categories: { select: { slug: true } },
                        subcategories: { select: { name: true, slug: true } },
                        brands: { select: { name: true, slug: true } },
                        product_feature_values: { select: { product_features: { select: { name: true, icon_name: true } } } },
                    },
                })
            )
        )
        return results
            .flat()
            .map(p => ({ ...p, price: p.price ? Number(p.price) : null, original_price: p.original_price ? Number(p.original_price) : null }))
    },
    ['top-products-per-brand'],
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
                original_price: true,
                price_display: true,
                image_main_url: true,
                is_new: true,
                is_bestseller: true,
                categories: { select: { name: true, slug: true } },
                brands: { select: { name: true, slug: true } },
            },
        })
        return products.map(p => ({ ...p, price: p.price ? Number(p.price) : null, original_price: p.original_price ? Number(p.original_price) : null }))
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
                original_price: true,
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
        products: products.map(p => ({ ...p, price: p.price ? Number(p.price) : null, original_price: p.original_price ? Number(p.original_price) : null })),
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
    return { ...p, price: p.price ? Number(p.price) : null, original_price: p.original_price ? Number(p.original_price) : null }
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

// ─── PUBLIC: COMPATIBLE LIDS (Nắp bồn cầu tương thích) ──────────────────────
// Chỉ dùng cho PDP bồn cầu (subcategory_id = 1)
// Logic: nắp cùng brand → fallback top nắp nếu không đủ

const SUB_NAP_BON_CAU = 9

export type CompatibleLid = {
    id: number
    sku: string
    name: string
    slug: string
    price_display: string | null
    image_main_url: string | null
    categories: { slug: string }
    subcategories: { slug: string } | null
}

async function _getCompatibleLids(brandId: number | null, limit = 6): Promise<CompatibleLid[]> {
    const lidSelect = {
        id: true,
        sku: true,
        name: true,
        slug: true,
        price_display: true,
        image_main_url: true,
        categories: { select: { slug: true } },
        subcategories: { select: { slug: true } },
    } satisfies Prisma.productsSelect

    // 1. Tìm nắp cùng brand
    if (brandId) {
        const sameBrand = await prisma.products.findMany({
            where: {
                subcategory_id: SUB_NAP_BON_CAU,
                brand_id: brandId,
                is_active: true,
            },
            select: lidSelect,
            orderBy: [{ is_bestseller: 'desc' }, { sort_order: 'asc' }],
            take: limit,
        })
        if (sameBrand.length > 0) return sameBrand
    }

    // 2. Fallback: top nắp bán chạy bất kể brand
    return prisma.products.findMany({
        where: { subcategory_id: SUB_NAP_BON_CAU, is_active: true },
        select: lidSelect,
        orderBy: [{ is_bestseller: 'desc' }, { sort_order: 'asc' }],
        take: limit,
    })
}

export const getCompatibleLids = unstable_cache(
    _getCompatibleLids,
    ['compatible-lids'],
    { revalidate: 3600, tags: ['products', 'compatible-lids'] }
)
