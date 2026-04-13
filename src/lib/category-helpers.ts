import { unstable_cache } from 'next/cache'
import prisma from '@/lib/prisma'

// Fetch a single category with its subcategories and product counts
export const getCategoryWithSubcategories = unstable_cache(
    async (slug: string) => {
        const category = await prisma.categories.findFirst({
            where: { slug },
            include: {
                subcategories: {
                    orderBy: { sort_order: 'asc' },
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        thumbnail_url: true,
                        _count: { select: { products: { where: { is_active: true } } } },
                    },
                },
            },
        })
        return category
    },
    ['category-with-subcategories'],
    { revalidate: 3600, tags: ['categories'] }
)

// Fetch all active categories for navigation
export const getAllCategories = unstable_cache(
    async () => {
        return prisma.categories.findMany({
            where: { is_active: true },
            orderBy: { sort_order: 'asc' },
            select: { id: true, name: true, slug: true },
        })
    },
    ['all-categories'],
    { revalidate: 3600, tags: ['categories'] }
)
