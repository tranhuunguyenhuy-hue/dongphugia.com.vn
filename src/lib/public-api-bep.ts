import prisma from '@/lib/prisma';
import { cache } from 'react';

/**
 * Fetch all active BEP product types with their subtypes and product count.
 */
export const getBepTypes = cache(async () => {
    return await prisma.bep_product_types.findMany({
        where: { is_active: true },
        include: {
            bep_subtypes: {
                where: { is_active: true },
                orderBy: { sort_order: 'asc' },
            },
            _count: {
                select: {
                    bep_products: { where: { is_active: true } },
                },
            },
        },
        orderBy: { sort_order: 'asc' },
    });
});

/**
 * Fetch BEP products with optional filters and pagination.
 */
export const getBepProducts = cache(
    async (
        filters?: {
            typeSlug?: string;
            subtypeSlug?: string;
            brandSlug?: string;
            page?: number;
            limit?: number;
        }
    ) => {
        const page = filters?.page ?? 1;
        const limit = filters?.limit ?? 24;
        const skip = (page - 1) * limit;

        const where: any = { is_active: true };

        if (filters?.typeSlug) {
            where.bep_product_types = { slug: filters.typeSlug };
        }
        if (filters?.subtypeSlug) {
            where.bep_subtypes = { slug: filters.subtypeSlug };
        }
        if (filters?.brandSlug) {
            where.bep_brands = { slug: filters.brandSlug };
        }

        const [products, total] = await Promise.all([
            prisma.bep_products.findMany({
                where,
                include: {
                    bep_product_types: true,
                    bep_subtypes: true,
                    bep_brands: true,
                    colors: true,
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
            prisma.bep_products.count({ where }),
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
 * Fetch a single BEP product by slug with all relations.
 */
export const getBepProductBySlug = cache(async (slug: string) => {
    return await prisma.bep_products.findUnique({
        where: { slug },
        include: {
            bep_product_types: true,
            bep_subtypes: true,
            bep_brands: true,
            colors: true,
            origins: true,
            bep_product_images: { orderBy: { sort_order: 'asc' } },
        },
    });
});

/**
 * Fetch related BEP products (same product_type, excluding current product).
 */
export const getRelatedBepProducts = cache(
    async (productTypeId: number, excludeProductId: number, limit = 4) => {
        return await prisma.bep_products.findMany({
            where: {
                product_type_id: productTypeId,
                id: { not: excludeProductId },
                is_active: true,
            },
            take: limit,
            include: {
                bep_product_types: true,
                bep_brands: true,
            },
            orderBy: [{ is_featured: 'desc' }, { sort_order: 'asc' }],
        });
    }
);
