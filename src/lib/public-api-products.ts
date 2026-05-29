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

    stock_status: string
    is_active: boolean
    is_featured: boolean
    is_promotion?: boolean
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
    product_type?: string | string[] // e.g. 'tay-sen', 'sen-am-tuong'
    product_sub_type?: string | string[] // e.g. '1-duong', 'bat-sen'
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
    is_promotion?: boolean
        is_active?: boolean
    is_master?: boolean
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
        product_sub_type,
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
        is_promotion,
        is_master,
        price_min,
        price_max,
        search,
        page = 1,
        pageSize = 24,
        sortBy = 'created_at',
        sortDir = 'desc',
    } = filters

    const toArray = (val: string | string[] | undefined) => val ? (Array.isArray(val) ? val : val.split(',')) : undefined

    // Build AND array to prevent multiple OR conditions from overwriting each other at the root level
    const AND: Prisma.productsWhereInput[] = []

    if (is_master !== undefined) {
        AND.push({ is_master })
    } else if (!search) {
        // Bypass Logic: Hide variants by default, BUT allow CMS override via is_featured or sort_order
        AND.push({ OR: [{ is_master: true }, { is_featured: true }, { sort_order: { gt: 0 } }] })
    }

    const subcatSlugs = subcategory_slugs ? toArray(subcategory_slugs) : (subcategory_slug ? [subcategory_slug] : undefined)
    if (subcatSlugs) {
        AND.push({
            OR: [
                { subcategories: { slug: { in: subcatSlugs } } },
                { secondary_subcategories: { some: { subcategories: { slug: { in: subcatSlugs } } } } },
            ]
        })
    }

    // Không hiển thị phụ kiện ở trang listing chính (trừ khi khách đang xem danh mục phụ kiện hoặc tìm kiếm)
    if (!search && !subcatSlugs?.some(s => s.includes('phu-kien')) && (!product_type || !String(product_type).includes('phu-kien'))) {
        AND.push({
            OR: [
                { product_type: null },
                { NOT: { product_type: { contains: 'phu-kien' } } }
            ]
        })
    }

    if (search) {
        AND.push({
            OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ]
        })
    }

    // Spec-based filters: filter by JSON field values in specs column
    if (spec_filters && Object.keys(spec_filters).length > 0) {
        Object.entries(spec_filters).forEach(([key, value]) => {
            const values = String(value).split(',').map(v => v.trim()).filter(Boolean)
            if (values.length === 1) {
                AND.push({ specs: { path: [key], string_contains: values[0] } })
            } else if (values.length > 1) {
                AND.push({
                    OR: values.map(v => ({ specs: { path: [key], string_contains: v } }))
                })
            }
        })
    }

    const where: Prisma.productsWhereInput = {
        is_active: true,
        ...(AND.length > 0 ? { AND } : {}),
        ...(category_slug && { categories: { slug: category_slug } }),
        ...(product_type && { product_type: { in: toArray(product_type) } }),
        ...(product_sub_type && { product_sub_type: { in: toArray(product_sub_type) } }),
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
        ...(is_promotion !== undefined && { is_promotion }),
        ...((price_min !== undefined || price_max !== undefined) && {
            price: {
                ...(price_min !== undefined && { gte: price_min }),
                ...(price_max !== undefined && { lte: price_max }),
            },
        }),
    }

    const orderBy: Prisma.productsOrderByWithRelationInput[] = []

    if (sortBy === 'price') {
        // Price sort: explicit user choice
        orderBy.push({ price: sortDir })
        orderBy.push({ sort_order: 'desc' })
        orderBy.push({ is_featured: 'desc' })
    } else if (sortBy === 'name') {
        orderBy.push({ name: sortDir })
    } else if (sortBy === 'created_at') {
        orderBy.push({ created_at: sortDir })
        orderBy.push({ sort_order: 'desc' })
        orderBy.push({ price: 'desc' })
    } else {
        // Default sort: featured → sort_order (TOTO with variants > TOTO > Others) → bestseller → high price
        orderBy.push({ is_featured: 'desc' })
        orderBy.push({ sort_order: 'desc' })
        orderBy.push({ is_promotion: 'desc' })
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
                online_discount_amount: true,
                price_display: true,
                image_main_url: true,

                stock_status: true,
                is_active: true,
                is_featured: true,
                is_promotion: true,
                sort_order: true,
                product_type: true,
                categories: { select: { name: true, slug: true } },
                subcategories: { select: { name: true, slug: true } },
                brands: { select: { name: true, slug: true } },
                colors: { select: { name: true, hex_code: true, slug: true } },
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

        const [subcategories, brands, materials, origins, features, colors] = await Promise.all([
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
            }),
            prisma.colors.findMany({
                where: { products: { some: { is_active: true, categories: { slug: categorySlug } } } },
                select: { name: true, slug: true, hex_code: true }
            })
        ])

        return {
            subcategories,
            brands,
            materials,
            origins,
            features,
            colors
        }
    },
    ['available-filters'],
    { revalidate: 3600, tags: ['products', 'filters'] }
)

// ─── PUBLIC: GET AVAILABLE FILTERS SCOPED TO SUBCATEGORY + PRODUCT TYPE ──────
// Returns only brands/features that actually have products in this subcategory
// (+ optional product_type). Prevents user from clicking a brand with 0 results.

export const getAvailableFiltersBySubcategory = unstable_cache(
    async (subcategorySlug: string, productType?: string) => {
        const productWhere = {
            is_active: true,
            subcategories: { slug: subcategorySlug },
            ...(productType ? { product_type: productType } : {}),
        }

        const [brands, features, colors, materials, origins] = await Promise.all([
            prisma.brands.findMany({
                where: { products: { some: productWhere }, is_active: true },
                select: { name: true, slug: true, logo_url: true },
                orderBy: { sort_order: 'asc' }
            }),
            prisma.product_features.findMany({
                where: { product_feature_values: { some: { products: productWhere } } },
                select: { name: true, slug: true, icon_name: true },
                orderBy: { sort_order: 'asc' }
            }),
            prisma.colors.findMany({
                where: { products: { some: productWhere } },
                select: { name: true, slug: true, hex_code: true }
            }),
            prisma.materials.findMany({
                where: { products: { some: productWhere } },
                select: { name: true, slug: true },
                orderBy: { sort_order: 'asc' }
            }),
            prisma.origins.findMany({
                where: { products: { some: productWhere } },
                select: { name: true, slug: true }
            }),
        ])

        return {
            subcategories: [] as { name: string; slug: string; icon_name: string | null }[],
            brands,
            materials,
            origins,
            features,
            colors,
        }
    },
    ['available-filters-subcategory'],
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
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const opts = d.options as any
                return opts && opts.source === 'specs' && Array.isArray(opts.values) && opts.values.length > 0
            })
            .map(d => ({
                key: d.filter_key,
                label: d.filter_label,
                type: d.filter_type,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    original_price: number | null
    price_display: string | null
    image_main_url: string | null
    is_active: boolean
    variant_type: string | null
    variant_label: string | null
    subcategories: { slug: string } | null
    categories: { slug: string }
    colors?: { name: string; hex_code: string | null } | null
}

export const getVariantSiblings = unstable_cache(
    async (variantGroup: string, currentProductId: number): Promise<VariantSibling[]> => {
        if (!variantGroup) return []

        // Include both active and inactive siblings so the UI can render stub swatches
        // for colour variants that exist but are not yet available (is_active=false)
        const siblings = await prisma.products.findMany({
            where: {
                variant_group: variantGroup,
                id: { not: currentProductId },
            },
            orderBy: [{ is_active: 'desc' }, { price: 'desc' }, { sku: 'asc' }],
            select: {
                id: true,
                sku: true,
                name: true,
                slug: true,
                price: true,
                original_price: true,
                online_discount_amount: true,
                price_display: true,
                image_main_url: true,
                is_active: true,
                variant_type: true,
                variant_label: true,
                subcategories: { select: { slug: true } },
                categories: { select: { slug: true } },
                colors: { select: { name: true, hex_code: true } },
            },
        })

        return siblings.map(s => ({
            ...s,
            price: s.price ? Number(s.price) : null,
            original_price: s.original_price ? Number(s.original_price) : null,
            online_discount_amount: s.online_discount_amount ? Number(s.online_discount_amount) : null,
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
                online_discount_amount: true,
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
    async (categorySlug: string, brandSlugs?: string | string[] | null, subcategorySlug?: string | null, skip = 0, take = 20) => {
        const whereClause: Prisma.productsWhereInput = {
            is_active: true,
            is_home_featured: true,
            NOT: { product_type: { contains: 'phu-kien' } },
            categories: { slug: categorySlug },
        }
        
        if (brandSlugs) {
            const arr = Array.isArray(brandSlugs) ? brandSlugs : [brandSlugs];
            if (arr.length > 0) {
                whereClause.brands = { slug: { in: arr } }
            }
        }
        
        if (subcategorySlug) {
            whereClause.subcategories = { slug: subcategorySlug }
        }

        const [products, total] = await Promise.all([
            prisma.products.findMany({
                where: whereClause,
                orderBy: [
                    { is_featured: 'desc' },
                    { sort_order: 'desc' },
                    { created_at: 'desc' },
                ],
                skip,
                take,
                select: {
                    id: true,
                    name: true,
                    display_name: true,
                    sku: true,
                    slug: true,
                    price: true,
                original_price: true,
                online_discount_amount: true,
                    price_display: true,
                    image_main_url: true,

                    is_promotion: true,
                    stock_status: true,
                    categories: { select: { slug: true } },
                    subcategories: { select: { name: true, slug: true } },
                    brands: { select: { name: true, slug: true } },
                    colors: { select: { name: true, hex_code: true, slug: true } },
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
                        OR: [{ is_master: true }, { is_featured: true }, { sort_order: { gt: 0 } }],
                        is_featured: true,          // only admin-selected featured products
                        NOT: { product_type: { contains: 'phu-kien' } },
                        categories: { slug: categorySlug },
                        brands: { slug: brandSlug },
                    },
                    orderBy: [{ sort_order: 'desc' }, { created_at: 'desc' }],
                    take: perBrand,
                    select: {
                        id: true,
                        name: true,
                        display_name: true,
                        sku: true,
                        slug: true,
                        price: true,
                original_price: true,
                online_discount_amount: true,
                        price_display: true,
                        image_main_url: true,

                        is_promotion: true,
                        stock_status: true,
                        categories: { select: { slug: true } },
                        subcategories: { select: { name: true, slug: true } },
                        brands: { select: { name: true, slug: true } },
                        colors: { select: { name: true, hex_code: true, slug: true } },
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
            where: { is_active: true, is_promotion: true },
            orderBy: { created_at: 'desc' },
            take: limit,
            select: {
                id: true,
                name: true,
                slug: true,
                price: true,
                original_price: true,
                online_discount_amount: true,
                price_display: true,
                image_main_url: true,
                is_promotion: true,
                categories: { select: { name: true, slug: true } },
                brands: { select: { name: true, slug: true } },
            },
        })
        return products.map(p => ({ ...p, price: p.price ? Number(p.price) : null, original_price: p.original_price ? Number(p.original_price) : null }))
    },
    ['new-arrivals'],
    { revalidate: 3600, tags: ['products', 'new-arrivals'] }
)

// ─── CACHED: HOME FEATURED PRODUCTS ─────────────────────────────────────────

export const getHomeFeaturedProducts = unstable_cache(
    async (limit = 15) => {
        const products = await prisma.products.findMany({
            where: { is_active: true, is_home_featured: true },
            orderBy: [{ sort_order: 'desc' }, { created_at: 'desc' }],
            take: limit,
            select: {
                id: true,
                name: true,
                slug: true,
                price: true,
                original_price: true,
                online_discount_amount: true,
                price_display: true,
                image_main_url: true,
                is_promotion: true,
                stock_status: true,
                categories: { select: { name: true, slug: true } },
                subcategories: { select: { name: true, slug: true } },
                brands: { select: { name: true, slug: true } },
                product_feature_values: { select: { product_features: { select: { name: true, icon_name: true } } } },
            },
        })
        return products.map(p => ({ ...p, price: p.price ? Number(p.price) : null, original_price: p.original_price ? Number(p.original_price) : null }))
    },
    ['home-featured-products'],
    { revalidate: 3600, tags: ['products', 'home-featured'] }
)

// ─── ADMIN: LIST ALL (with pagination + search, no RLS filter) ───────────────

export async function getAdminProducts(params: {
    search?: string
    category_id?: number
    subcategory_id?: number
    brand_id?: number
    highlight_type?: 'featured' | 'promotion'
    is_active?: boolean
    sort?: 'price_asc' | 'price_desc' | 'default'
    page?: number
    pageSize?: number
}) {
    const { search, category_id, subcategory_id, brand_id, highlight_type, is_active, sort, page = 1, pageSize = 50 } = params

    const where: Prisma.productsWhereInput = {
        ...(search && {
            OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
            ],
        }),
        ...(category_id && { category_id }),
        ...(subcategory_id && { subcategory_id }),
        ...(brand_id && { brand_id }),
        ...(highlight_type === 'featured' && { is_featured: true }),
        ...(highlight_type === 'promotion' && { is_promotion: true }),
        ...(is_active !== undefined && { is_active }),
    }

    const orderBy: Prisma.productsOrderByWithRelationInput[] = []
    if (sort === 'price_asc') {
        orderBy.push({ price: 'asc' })
    } else if (sort === 'price_desc') {
        orderBy.push({ price: 'desc' })
    } else {
        orderBy.push({ is_featured: 'desc' }, { is_promotion: 'desc' })
    }
    // Always fallback to default sorting
    orderBy.push({ sort_order: 'asc' }, { created_at: 'desc' })

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
                price: true,
                original_price: true,
                online_discount_amount: true,
                price_display: true,
                image_main_url: true,
                stock_status: true,
                is_active: true,
                is_featured: true,
                is_home_featured: true,
                is_promotion: true,
                sort_order: true,
                created_at: true,
                categories: { select: { name: true, slug: true } },
                subcategories: { select: { name: true } },
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

    const relationships = await prisma.product_relationships.findMany({
        where: { parent_id: id },
        orderBy: { sort_order: 'asc' },
        include: { child: { select: { id: true, sku: true, name: true, price: true, image_main_url: true } } }
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let variants: any[] = []
    if (p.variant_group) {
        const rawVariants = await prisma.products.findMany({
            where: { variant_group: p.variant_group },
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
        })
        variants = rawVariants.map(v => ({
            ...v,
            price: v.price ? Number(v.price) : null
        }))
    }

    return { 
        ...p, 
        variants,
        product_relationships: relationships.map(rel => ({
            ...rel,
            child: rel.child ? { ...rel.child, price: rel.child.price ? Number(rel.child.price) : null } : null
        })),
        price: p.price ? Number(p.price) : null, 
        original_price: p.original_price ? Number(p.original_price) : null 
    }
}

// ─── STATS ───────────────────────────────────────────────────────────────────

export async function getProductStats() {
    const [total, active, featured, promotion] = await Promise.all([
        prisma.products.count(),
        prisma.products.count({ where: { is_active: true } }),
        prisma.products.count({ where: { is_featured: true } }),
        prisma.products.count({ where: { OR: [{ is_promotion: true }, { original_price: { gt: prisma.products.fields.price } }] } }),
    ])
    return { total, active, featured, promotion }
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
            orderBy: [{ is_promotion: 'desc' }, { sort_order: 'asc' }],
            take: limit,
        })
        if (sameBrand.length > 0) return sameBrand
    }

    // 2. Fallback: top nắp bán chạy bất kể brand
    return prisma.products.findMany({
        where: { subcategory_id: SUB_NAP_BON_CAU, is_active: true },
        select: lidSelect,
        orderBy: [{ is_promotion: 'desc' }, { sort_order: 'asc' }],
        take: limit,
    })
}

export const getCompatibleLids = unstable_cache(
    _getCompatibleLids,
    ['compatible-lids'],
    { revalidate: 3600, tags: ['products', 'compatible-lids'] }
)
