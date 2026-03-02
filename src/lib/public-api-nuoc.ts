import prisma from '@/lib/prisma';
import { cache } from 'react';

/**
 * Fetch all active NUOC product types with their subtypes and product count.
 */
export const getNuocTypes = cache(async () => {
    return await prisma.nuoc_product_types.findMany({
        where: { is_active: true },
        include: {
            nuoc_subtypes: {
                where: { is_active: true },
                orderBy: { sort_order: 'asc' },
            },
            _count: {
                select: {
                    nuoc_products: { where: { is_active: true } },
                },
            },
        },
        orderBy: { sort_order: 'asc' },
    });
});

/**
 * Fetch all active NUOC brands.
 */
export const getNuocBrands = cache(async () => {
    return await prisma.nuoc_brands.findMany({
        where: { is_active: true },
        orderBy: [{ is_featured: 'desc' }, { sort_order: 'asc' }],
    });
});

/**
 * Fetch all NUOC materials.
 */
export const getNuocMaterials = cache(async () => {
    return await prisma.nuoc_materials.findMany({
        orderBy: { sort_order: 'asc' },
    });
});

/**
 * Fetch NUOC products with optional filters and pagination.
 */
export const getNuocProducts = cache(
    async (
        filters?: {
            typeSlug?: string;
            subtypeSlug?: string;
            brandSlug?: string;
            materialSlug?: string;
            page?: number;
            limit?: number;
        }
    ) => {
        const page = filters?.page ?? 1;
        const limit = filters?.limit ?? 24;
        const skip = (page - 1) * limit;

        const where: any = { is_active: true };

        if (filters?.typeSlug) {
            where.nuoc_product_types = { slug: filters.typeSlug };
        }
        if (filters?.subtypeSlug) {
            where.nuoc_subtypes = { slug: filters.subtypeSlug };
        }
        if (filters?.brandSlug) {
            where.nuoc_brands = { slug: filters.brandSlug };
        }
        if (filters?.materialSlug) {
            where.nuoc_materials = { slug: filters.materialSlug };
        }

        const [products, total] = await Promise.all([
            prisma.nuoc_products.findMany({
                where,
                include: {
                    nuoc_product_types: true,
                    nuoc_subtypes: true,
                    nuoc_brands: true,
                    nuoc_materials: true,
                    origins: true,
                },
                orderBy: [
                    { is_featured: 'desc' },
                    { sort_order: 'asc' },
                    { created_at: 'desc' },
                ],
                skip,
                take: limit,
            }),
            prisma.nuoc_products.count({ where }),
        ]);

        return {
            products,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }
);

/**
 * Fetch a single NUOC product by slug with all relations.
 */
export const getNuocProductBySlug = cache(async (slug: string) => {
    return await prisma.nuoc_products.findUnique({
        where: { slug },
        include: {
            nuoc_product_types: true,
            nuoc_subtypes: true,
            nuoc_brands: true,
            nuoc_materials: true,
            colors: true,
            origins: true,
            nuoc_product_images: { orderBy: { sort_order: 'asc' } },
        },
    });
});

/**
 * Fetch related NUOC products (same product_type, excluding current product).
 */
export const getRelatedNuocProducts = cache(
    async (productTypeId: number, excludeProductId: number, limit = 4) => {
        return await prisma.nuoc_products.findMany({
            where: {
                product_type_id: productTypeId,
                id: { not: excludeProductId },
                is_active: true,
            },
            take: limit,
            include: {
                nuoc_product_types: true,
                nuoc_brands: true,
            },
            orderBy: [{ is_featured: 'desc' }, { sort_order: 'asc' }],
        });
    }
);
