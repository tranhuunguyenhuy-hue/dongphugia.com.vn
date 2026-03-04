'use server'

import prisma from '@/lib/prisma';
import { cache } from 'react';

// Fetch toàn bộ Categories + Subcategories theo chuẩn
export const getMegaMenuData = cache(async () => {
    try {
        const [
            categories,
            gachData,
            tbvsBrands, tbvsTypes,
            bepBrands, bepTypes,
            sangoTypes,
            nuocBrands, nuocTypes
        ] = await Promise.all([
            // Lấy danh mục gốc từ DB
            prisma.product_categories.findMany({
                where: { is_active: true },
                orderBy: { sort_order: 'asc' },
                select: { id: true, name: true, slug: true, thumbnail_url: true }
            }),
            // Gạch
            prisma.pattern_types.findMany({
                where: { is_active: true, category_id: 1 },
                select: { id: true, name: true, slug: true, thumbnail_url: true, hero_image_url: true },
                orderBy: { sort_order: 'asc' },
            }),
            // TBVS
            prisma.tbvs_brands.findMany({
                where: { is_active: true },
                take: 12,
                orderBy: { sort_order: 'asc' }
            }),
            prisma.tbvs_product_types.findMany({
                where: { is_active: true },
                include: { tbvs_subtypes: { where: { is_active: true }, orderBy: { sort_order: 'asc' } } },
                orderBy: { sort_order: 'asc' }
            }),
            // Bếp
            prisma.bep_brands.findMany({
                where: { is_active: true },
                take: 12,
                orderBy: { sort_order: 'asc' }
            }),
            prisma.bep_product_types.findMany({
                where: { is_active: true },
                include: { bep_subtypes: { where: { is_active: true }, orderBy: { sort_order: 'asc' } } },
                orderBy: { sort_order: 'asc' }
            }),
            // Sàn gỗ
            prisma.sango_product_types.findMany({
                where: { is_active: true },
                select: { id: true, name: true, slug: true, thumbnail_url: true, hero_image_url: true },
                orderBy: { sort_order: 'asc' },
            }),
            // Nước
            prisma.nuoc_brands.findMany({
                where: { is_active: true },
                select: { id: true, name: true, slug: true, logo_url: true },
                take: 12,
                orderBy: { sort_order: 'asc' }
            }),
            prisma.nuoc_product_types.findMany({
                where: { is_active: true },
                include: { nuoc_subtypes: { where: { is_active: true }, orderBy: { sort_order: 'asc' } } },
                orderBy: { sort_order: 'asc' }
            })
        ]);

        const menuData = {
            'gach-op-lat': { layout: 'IMAGE_CARDS' as const, items: gachData },
            'thiet-bi-ve-sinh': { layout: 'COMPLEX_LIST' as const, brands: tbvsBrands, types: tbvsTypes },
            'thiet-bi-bep': { layout: 'COMPLEX_LIST' as const, brands: bepBrands, types: bepTypes },
            'san-go': { layout: 'IMAGE_CARDS' as const, items: sangoTypes },
            'vat-lieu-nuoc': { layout: 'COMPLEX_LIST' as const, brands: nuocBrands, types: nuocTypes }
        };

        return { categories, menuData };
    } catch (e) {
        console.error("MegaMenu DB Fetch Error:", e);
        return { categories: [], menuData: {} };
    }
});
