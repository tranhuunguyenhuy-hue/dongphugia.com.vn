import prisma from '@/lib/prisma';
import { cache } from 'react';

/**
 * Fetch all active SANGO product types with product count.
 */
export const getSangoTypes = cache(async () => {
    return await prisma.sango_product_types.findMany({
        where: { is_active: true },
        include: {
            _count: {
                select: {
                    sango_products: { where: { is_active: true } },
                },
            },
        },
        orderBy: { sort_order: 'asc' },
    });
});

/**
 * Fetch SANGO products with optional filters and pagination.
 */
export const getSangoProducts = cache(
    async (
        filters?: {
            typeSlug?: string;
            colorId?: number;
            originId?: number;
            thicknessMin?: number;
            thicknessMax?: number;
            page?: number;
            limit?: number;
        }
    ) => {
        const page = filters?.page ?? 1;
        const limit = filters?.limit ?? 24;
        const skip = (page - 1) * limit;

        const where: any = { is_active: true };

        if (filters?.typeSlug) {
            where.sango_product_types = { slug: filters.typeSlug };
        }
        if (filters?.colorId) {
            where.color_id = filters.colorId;
        }
        if (filters?.originId) {
            where.origin_id = filters.originId;
        }
        if (filters?.thicknessMin || filters?.thicknessMax) {
            where.thickness_mm = {};
            if (filters?.thicknessMin) where.thickness_mm.gte = filters.thicknessMin;
            if (filters?.thicknessMax) where.thickness_mm.lte = filters.thicknessMax;
        }

        const [products, total] = await Promise.all([
            prisma.sango_products.findMany({
                where,
                include: {
                    sango_product_types: true,
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
            prisma.sango_products.count({ where }),
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
 * Fetch a single SANGO product by slug with all relations.
 */
export const getSangoProductBySlug = cache(async (slug: string) => {
    return await prisma.sango_products.findUnique({
        where: { slug },
        include: {
            sango_product_types: true,
            colors: true,
            origins: true,
            sango_product_images: { orderBy: { sort_order: 'asc' } },
        },
    });
});

/**
 * Fetch related SANGO products (same product_type, excluding current product).
 */
export const getRelatedSangoProducts = cache(
    async (productTypeId: number, excludeProductId: number, limit = 4) => {
        return await prisma.sango_products.findMany({
            where: {
                product_type_id: productTypeId,
                id: { not: excludeProductId },
                is_active: true,
            },
            take: limit,
            include: {
                sango_product_types: true,
            },
            orderBy: [{ is_featured: 'desc' }, { sort_order: 'asc' }],
        });
    }
);
