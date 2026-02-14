import prisma from '@/lib/prisma';
import { cache } from 'react';

/**
 * Fetch a category by slug, including children and parent.
 */
export const getCategoryBySlug = cache(async (slug: string) => {
    return await prisma.category.findUnique({
        where: { slug },
        include: {
            children: {
                include: {
                    _count: { select: { products: true } },
                },
            },
            parent: true,
        },
    });
});

/**
 * Fetch products for a category (and its children) with pagination.
 */
export const getProductsByCategory = cache(
    async (
        categorySlug: string,
        page: number = 1,
        limit: number = 20,
        sort: string = 'newest',
        filters?: { productTypeId?: string; collectionId?: string }
    ) => {
        const skip = (page - 1) * limit;

        let orderBy: any = { createdAt: 'desc' };
        if (sort === 'price_asc') orderBy = { price: 'asc' };
        if (sort === 'price_desc') orderBy = { price: 'desc' };
        if (sort === 'name_asc') orderBy = { name: 'asc' };

        const category = await prisma.category.findUnique({
            where: { slug: categorySlug },
            select: { id: true, children: { select: { id: true } } },
        });

        if (!category) return { products: [], total: 0 };

        const categoryIds = [category.id, ...category.children.map((c) => c.id)];

        const where: any = {
            categoryId: { in: categoryIds },
            isPublished: true,
        };

        // Apply filters
        if (filters?.productTypeId) {
            where.productTypeId = filters.productTypeId;
        }
        if (filters?.collectionId) {
            where.collectionId = filters.collectionId;
        }

        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                orderBy,
                skip,
                take: limit,
                include: { category: true, collection: true, productType: true },
            }),
            prisma.product.count({ where }),
        ]);

        return { products, total };
    }
);

/**
 * Fetch all top-level categories for sidebar.
 */
export const getAllCategories = cache(async () => {
    return await prisma.category.findMany({
        where: { parentId: null },
        include: {
            children: {
                include: { _count: { select: { products: true } } },
            },
        },
        orderBy: { name: 'asc' },
    });
});

/**
 * Fetch product types (sub-categories) for a category.
 */
export const getProductTypesByCategory = cache(async (categoryId: string) => {
    return await prisma.productType.findMany({
        where: { categoryId },
        include: { _count: { select: { products: true } } },
        orderBy: { name: 'asc' },
    });
});

/**
 * Fetch collections for a category (via productType).
 */


/**
 * Fetch a single product type by ID.
 */
export const getProductTypeById = cache(async (id: string) => {
    return await prisma.productType.findUnique({
        where: { id },
    });
});

/**
 * Fetch collections for a category (via productType).
 */
export const getCollectionsByCategory = cache(async (categoryId: string) => {
    return await prisma.collection.findMany({
        where: { productType: { categoryId } },
        include: {
            _count: { select: { products: true } },
            productType: { select: { id: true } } // Include productTypeId
        },
        orderBy: { name: 'asc' },
    });
});

/**
 * Fetch a single collection by ID.
 */
export const getCollectionById = cache(async (id: string) => {
    return await prisma.collection.findUnique({
        where: { id },
        include: {
            productType: { select: { id: true } } // Include productTypeId for reverse lookup
        }
    });
});

/**
 * Extract unique filter values from products in a category.
 */
export const getFilterValues = cache(async (categoryId: string) => {
    const products = await prisma.product.findMany({
        where: {
            categoryId,
            isPublished: true,
            specs: { not: null },
        },
        select: { specs: true },
    });

    const colors = new Set<string>();
    const surfaces = new Set<string>();
    const dimensions = new Set<string>();

    for (const p of products) {
        if (!p.specs) continue;
        try {
            const specs = JSON.parse(p.specs as string);
            if (specs.color) colors.add(specs.color);
            if (specs.surface) surfaces.add(specs.surface);
            if (specs.dimensions) dimensions.add(specs.dimensions);
        } catch { /* skip invalid JSON */ }
    }

    return {
        colors: Array.from(colors).sort(),
        surfaces: Array.from(surfaces).sort(),
        dimensions: Array.from(dimensions).sort(),
    };
});

/**
 * Fetch a product by slug with all relations.
 */
export const getProductBySlug = cache(async (slug: string) => {
    return await prisma.product.findUnique({
        where: { slug },
        include: {
            category: { include: { parent: true } },
            brand: true,
            productType: true,
            collection: true,
        },
    });
});

/**
 * Fetch related products (same category, excluding current).
 */
export const getRelatedProducts = cache(
    async (categoryId: string, excludeProductId: string, limit: number = 5) => {
        return await prisma.product.findMany({
            where: {
                categoryId,
                id: { not: excludeProductId },
                isPublished: true,
            },
            take: limit,
            orderBy: { createdAt: 'desc' },
        });
    }
);

/**
 * Fetch a collection by slug with its products.
 */
export const getCollectionBySlug = cache(async (slug: string) => {
    return await prisma.collection.findUnique({
        where: { slug },
        include: {
            products: {
                where: { isPublished: true },
                orderBy: { createdAt: 'desc' },
            },
            productType: { include: { category: true } },
        },
    });
});
