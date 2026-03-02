import prisma from '@/lib/prisma';
import { cache } from 'react';

/**
 * Fetch all active TBVS product types with their subtypes and product count.
 */
export const getTBVSTypes = cache(async () => {
    return await prisma.tbvs_product_types.findMany({
        where: { is_active: true },
        include: {
            tbvs_subtypes: {
                where: { is_active: true },
                orderBy: { sort_order: 'asc' },
            },
            _count: {
                select: {
                    tbvs_products: { where: { is_active: true } },
                },
            },
        },
        orderBy: { sort_order: 'asc' },
    });
});

/**
 * Fetch TBVS products with optional filters and pagination.
 */
export const getTBVSProducts = cache(
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
            where.tbvs_product_types = { slug: filters.typeSlug };
        }
        if (filters?.subtypeSlug) {
            where.tbvs_subtypes = { slug: filters.subtypeSlug };
        }
        if (filters?.brandSlug) {
            where.tbvs_brands = { slug: filters.brandSlug };
        }

        const [products, total] = await Promise.all([
            prisma.tbvs_products.findMany({
                where,
                include: {
                    tbvs_product_types: true,
                    tbvs_subtypes: true,
                    tbvs_brands: true,
                    tbvs_materials: true,
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
            prisma.tbvs_products.count({ where }),
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
 * Fetch a single TBVS product by slug with all relations.
 */
export const getTBVSProductBySlug = cache(async (slug: string) => {
    return await prisma.tbvs_products.findUnique({
        where: { slug },
        include: {
            tbvs_product_types: true,
            tbvs_subtypes: true,
            tbvs_brands: true,
            tbvs_materials: true,
            colors: true,
            origins: true,
            tbvs_product_images: { orderBy: { sort_order: 'asc' } },
            tbvs_product_technologies: {
                include: { tbvs_technologies: true },
            },
        },
    });
});

/**
 * Fetch related TBVS products (same product_type, excluding current product).
 */
export const getRelatedTBVSProducts = cache(
    async (productTypeId: number, excludeProductId: number, limit = 4) => {
        return await prisma.tbvs_products.findMany({
            where: {
                product_type_id: productTypeId,
                id: { not: excludeProductId },
                is_active: true,
            },
            take: limit,
            include: {
                tbvs_product_types: true,
                tbvs_brands: true,
            },
            orderBy: [{ is_featured: 'desc' }, { sort_order: 'asc' }],
        });
    }
);
