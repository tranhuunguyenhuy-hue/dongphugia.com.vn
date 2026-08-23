import { unstable_cache } from 'next/cache'
import prisma from '@/lib/prisma'

// Categories — changes rarely, cache aggressively
export const getCategories = unstable_cache(
    async () => prisma.categories.findMany({
        where: { is_active: true },
        orderBy: { sort_order: 'asc' },
    }),
    ['categories'],
    { revalidate: 3600, tags: ['categories'] }
)

// Subcategories — grouped by category
export const getSubcategories = unstable_cache(
    async (categoryId?: number) => prisma.subcategories.findMany({
        where: {
            is_active: true,
            ...(categoryId ? { category_id: categoryId } : {})
        },
        orderBy: { sort_order: 'asc' },
        select: { id: true, name: true, slug: true, thumbnail_url: true, hero_image_url: true, category_id: true },
    }),
    ['subcategories'],
    { revalidate: 3600, tags: ['subcategories'] }
)

// Brands — unified across all categories
export const getBrands = unstable_cache(
    async () => prisma.brands.findMany({
        where: { is_active: true },
        orderBy: { sort_order: 'asc' },
        select: { id: true, name: true, slug: true, logo_url: true },
    }),
    ['brands'],
    { revalidate: 3600, tags: ['brands'] }
)

// Colors — lookup table
export const getColors = unstable_cache(
    async () => prisma.colors.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, slug: true, hex_code: true }
    }),
    ['colors'],
    { revalidate: 86400, tags: ['colors'] }
)

// Origins — lookup table
export const getOrigins = unstable_cache(
    async () => prisma.origins.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, slug: true }
    }),
    ['origins'],
    { revalidate: 86400, tags: ['origins'] }
)

// Materials — lookup table
export const getMaterials = unstable_cache(
    async () => prisma.materials.findMany({
        orderBy: { sort_order: 'asc' },
        select: { id: true, name: true, slug: true }
    }),
    ['materials'],
    { revalidate: 86400, tags: ['materials'] }
)

// Filter Definitions - For dynamic product specs
export const getFilterDefinitions = unstable_cache(
    async () => prisma.filter_definitions.findMany({
        where: { is_active: true },
        orderBy: { sort_order: 'asc' },
    }),
    ['filter_definitions'],
    { revalidate: 3600, tags: ['filter_definitions'] }
)

// Product Types - Unique combinations of subcategory_id, product_type, product_sub_type
export const getProductTypes = unstable_cache(
    async () => prisma.products.findMany({
        where: { 
            product_type: { not: null, notIn: [''] }
        },
        select: { subcategory_id: true, product_type: true, product_sub_type: true },
        distinct: ['subcategory_id', 'product_type', 'product_sub_type'],
    }),
    ['product_types'],
    { revalidate: 3600, tags: ['product_types', 'products'] }
)

// Normalized catalog taxonomy used by the CMS and canonical public readers.
export const getCatalogTaxons = unstable_cache(
    async () => prisma.catalog_taxons.findMany({
        where: { is_active: true },
        orderBy: [{ depth: 'asc' }, { sort_order: 'asc' }, { name: 'asc' }],
        select: {
            id: true,
            parent_id: true,
            name: true,
            slug: true,
            canonical_path: true,
            depth: true,
            is_active: true,
            is_listing_enabled: true,
        },
    }),
    ['catalog_taxons'],
    { revalidate: 3600, tags: ['catalog_taxons', 'products'] },
)

// Normalized Product Type/Subtype references for canonical Product editing.
export const getNormalizedProductTypes = unstable_cache(
    async () => prisma.product_types.findMany({
        where: { is_active: true },
        orderBy: [{ subcategory_id: 'asc' }, { sort_order: 'asc' }, { name: 'asc' }],
        select: {
            id: true,
            subcategory_id: true,
            slug: true,
            name: true,
            product_sub_types: {
                where: { is_active: true },
                orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
                select: { id: true, product_type_id: true, slug: true, name: true },
            },
        },
    }),
    ['normalized_product_types'],
    { revalidate: 3600, tags: ['product_types', 'products'] },
)

// Normalized specification definitions/options for Product Editor forms.
export const getSpecDefinitions = unstable_cache(
    async () => prisma.spec_definitions.findMany({
        orderBy: [{ sort_order: 'asc' }, { label: 'asc' }],
        select: {
            id: true,
            key: true,
            label: true,
            data_type: true,
            unit: true,
            is_filterable: true,
            is_pdp_visible: true,
            spec_options: {
                where: { is_active: true },
                orderBy: [{ sort_order: 'asc' }, { value: 'asc' }],
                select: { id: true, value: true, slug: true },
            },
        },
    }),
    ['spec_definitions'],
    { revalidate: 3600, tags: ['subcategory-spec-filters', 'products'] },
)
