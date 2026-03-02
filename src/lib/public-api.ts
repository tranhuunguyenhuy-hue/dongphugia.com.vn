import prisma from '@/lib/prisma';
import { cache } from 'react';

/**
 * Fetch all active product categories.
 */
export const getActiveCategories = cache(async () => {
    return await prisma.product_categories.findMany({
        where: { is_active: true },
        orderBy: { sort_order: 'asc' },
    });
});

/**
 * Fetch pattern_types by category slug, with product count.
 */
export const getPatternTypesByCategorySlug = cache(async (categorySlug: string) => {
    return await prisma.pattern_types.findMany({
        where: {
            product_categories: { slug: categorySlug },
            is_active: true,
        },
        include: {
            _count: { select: { products: true } },
        },
        orderBy: { sort_order: 'asc' },
    });
});

/**
 * Fetch a single pattern_type by slug.
 */
export const getPatternTypeBySlug = cache(async (slug: string) => {
    return await prisma.pattern_types.findUnique({
        where: { slug },
        include: {
            product_categories: true,
            _count: { select: { products: true, collections: true } },
        },
    });
});

/**
 * Fetch collections by pattern_type slug, with product count.
 */
export const getCollectionsByPatternSlug = cache(async (patternSlug: string) => {
    return await prisma.collections.findMany({
        where: {
            pattern_types: { slug: patternSlug },
            is_active: true,
        },
        include: {
            _count: { select: { products: true } },
        },
        orderBy: { sort_order: 'asc' },
    });
});

/**
 * Fetch products by pattern_type slug with optional filters.
 */
export const getProductsByPatternSlug = cache(
    async (
        patternSlug: string,
        filters?: {
            collectionSlug?: string;
            colorSlug?: string;
            surfaceSlug?: string;
            sizeSlug?: string;
            originSlug?: string;
            locationSlug?: string;
        }
    ) => {
        const where: any = {
            pattern_types: { slug: patternSlug },
            is_active: true,
        };

        if (filters?.collectionSlug) {
            where.collections = { slug: filters.collectionSlug };
        }
        if (filters?.surfaceSlug) {
            where.surfaces = { slug: filters.surfaceSlug };
        }
        if (filters?.sizeSlug) {
            where.sizes = { slug: filters.sizeSlug };
        }
        if (filters?.originSlug) {
            where.origins = { slug: filters.originSlug };
        }
        if (filters?.colorSlug) {
            where.product_colors = {
                some: { colors: { slug: filters.colorSlug } },
            };
        }
        if (filters?.locationSlug) {
            where.product_locations = {
                some: { locations: { slug: filters.locationSlug } },
            };
        }

        return await prisma.products.findMany({
            where,
            include: {
                collections: true,
                sizes: true,
                surfaces: true,
                origins: true,
                pattern_types: true,
            },
            orderBy: [{ is_featured: 'desc' }, { sort_order: 'asc' }, { created_at: 'desc' }],
        });
    }
);

/**
 * Fetch a single product by slug with all relations.
 */
export const getProductBySlug = cache(async (slug: string) => {
    return await prisma.products.findUnique({
        where: { slug },
        include: {
            product_images: { orderBy: { sort_order: 'asc' } },
            product_colors: { include: { colors: true } },
            product_locations: { include: { locations: true } },
            collections: true,
            sizes: true,
            surfaces: true,
            origins: true,
            pattern_types: {
                include: { product_categories: true },
            },
        },
    });
});

/**
 * Fetch products in the same collection
 */
export const getRelatedProductsInCollection = cache(async (collectionId: number | null, excludeProductId: number) => {
    if (!collectionId) return [];
    return await prisma.products.findMany({
        where: {
            collection_id: collectionId,
            id: { not: excludeProductId },
            is_active: true,
        },
        select: {
            id: true,
            sku: true,
            slug: true,
        },
        orderBy: { sort_order: 'asc' }
    });
});

/**
 * Fetch featured products for homepage.
 */
export const getFeaturedProducts = cache(async (limit = 10) => {
    return await prisma.products.findMany({
        where: { is_featured: true, is_active: true },
        take: limit,
        include: {
            collections: true,
            sizes: true,
            surfaces: true,
            pattern_types: true,
        },
        orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }],
    });
});

/**
 * Fetch filter lookup data for a pattern_type slug.
 */
export const getFilterData = cache(async (patternSlug: string) => {
    const patternType = await prisma.pattern_types.findUnique({
        where: { slug: patternSlug },
        select: { id: true },
    });

    if (!patternType) {
        return { colors: [], surfaces: [], sizes: [], origins: [], collections: [], locations: [] };
    }

    const ptId = patternType.id;

    const [colors, surfaces, sizes, origins, collections, locations] = await Promise.all([
        prisma.colors.findMany({
            where: {
                product_colors: {
                    some: {
                        products: { pattern_type_id: ptId, is_active: true },
                    },
                },
            },
            orderBy: { name: 'asc' },
        }),
        prisma.surfaces.findMany({
            where: {
                products: { some: { pattern_type_id: ptId, is_active: true } },
            },
            orderBy: { name: 'asc' },
        }),
        prisma.sizes.findMany({
            where: {
                products: { some: { pattern_type_id: ptId, is_active: true } },
            },
            orderBy: { sort_order: 'asc' },
        }),
        prisma.origins.findMany({
            where: {
                products: { some: { pattern_type_id: ptId, is_active: true } },
            },
            orderBy: { name: 'asc' },
        }),
        prisma.collections.findMany({
            where: { pattern_type_id: ptId, is_active: true },
            orderBy: { sort_order: 'asc' },
        }),
        prisma.locations.findMany({
            where: {
                product_locations: {
                    some: {
                        products: { pattern_type_id: ptId, is_active: true },
                    },
                },
            },
            orderBy: { name: 'asc' },
        }),
    ]);

    return { colors, surfaces, sizes, origins, collections, locations };
});

/**
 * Fetch products by category slug with optional pattern type filter and other filters.
 * Used by unified product listing page.
 */
export const getProductsByCategorySlug = cache(
    async (
        categorySlug: string,
        filters?: {
            patternSlug?: string;
            collectionSlug?: string;
            colorSlug?: string;
            surfaceSlug?: string;
            sizeSlug?: string;
            originSlug?: string;
            locationSlug?: string;
        }
    ) => {
        const where: any = {
            is_active: true,
            pattern_types: {
                product_categories: { slug: categorySlug },
                is_active: true,
            },
        };

        if (filters?.patternSlug) {
            where.pattern_types = {
                ...where.pattern_types,
                slug: filters.patternSlug,
            };
        }
        if (filters?.collectionSlug) {
            where.collections = { slug: filters.collectionSlug };
        }
        if (filters?.surfaceSlug) {
            where.surfaces = { slug: filters.surfaceSlug };
        }
        if (filters?.sizeSlug) {
            where.sizes = { slug: filters.sizeSlug };
        }
        if (filters?.originSlug) {
            where.origins = { slug: filters.originSlug };
        }
        if (filters?.colorSlug) {
            where.product_colors = {
                some: { colors: { slug: filters.colorSlug } },
            };
        }
        if (filters?.locationSlug) {
            where.product_locations = {
                some: { locations: { slug: filters.locationSlug } },
            };
        }

        return await prisma.products.findMany({
            where,
            include: {
                collections: true,
                sizes: true,
                surfaces: true,
                origins: true,
                pattern_types: true,
            },
            orderBy: [{ is_featured: 'desc' }, { sort_order: 'asc' }, { created_at: 'desc' }],
        });
    }
);

/**
 * Fetch filter lookup data for an entire category (or scoped to one pattern type).
 * Used by unified product listing page.
 */
export const getFilterDataByCategorySlug = cache(
    async (categorySlug: string, patternSlug?: string) => {
        // Build base condition
        const productWhere: any = {
            is_active: true,
            pattern_types: {
                product_categories: { slug: categorySlug },
                is_active: true,
            },
        };
        if (patternSlug) {
            productWhere.pattern_types = {
                ...productWhere.pattern_types,
                slug: patternSlug,
            };
        }

        const [colors, surfaces, sizes, origins, collections, locations] = await Promise.all([
            prisma.colors.findMany({
                where: { product_colors: { some: { products: productWhere } } },
                orderBy: { name: 'asc' },
            }),
            prisma.surfaces.findMany({
                where: { products: { some: productWhere } },
                orderBy: { name: 'asc' },
            }),
            prisma.sizes.findMany({
                where: { products: { some: productWhere } },
                orderBy: { sort_order: 'asc' },
            }),
            prisma.origins.findMany({
                where: { products: { some: productWhere } },
                orderBy: { name: 'asc' },
            }),
            prisma.collections.findMany({
                where: {
                    is_active: true,
                    pattern_types: {
                        product_categories: { slug: categorySlug },
                        is_active: true,
                        ...(patternSlug ? { slug: patternSlug } : {}),
                    },
                },
                orderBy: { sort_order: 'asc' },
                include: { _count: { select: { products: true } } },
            }),
            prisma.locations.findMany({
                where: { product_locations: { some: { products: productWhere } } },
                orderBy: { name: 'asc' },
            }),
        ]);

        return { colors, surfaces, sizes, origins, collections, locations };
    }
);

/**
 * Fetch active banners for homepage.
 */
export const getBanners = cache(async (limit = 5) => {
    try {
        return await (prisma as any).banners.findMany({
            where: { is_active: true },
            orderBy: { sort_order: 'asc' },
            take: limit,
        });
    } catch {
        // Fallback if banners table not yet migrated
        return [];
    }
});

/**
 * Fetch related products (same pattern_type, excluding current).
 */
export const getRelatedProducts = cache(
    async (patternTypeId: number, excludeProductId: number, limit = 6) => {
        return await prisma.products.findMany({
            where: {
                pattern_type_id: patternTypeId,
                id: { not: excludeProductId },
                is_active: true,
            },
            take: limit,
            include: {
                collections: true,
                sizes: true,
                surfaces: true,
                pattern_types: true,
            },
            orderBy: [{ is_featured: 'desc' }, { sort_order: 'asc' }],
        });
    }
);
