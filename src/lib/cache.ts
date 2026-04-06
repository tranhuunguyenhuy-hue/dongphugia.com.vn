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
