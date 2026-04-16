'use server'

import prisma from '@/lib/prisma';
import { cache } from 'react';

// Fetch categories + subcategories + brands for mega menu using unified schema (v2)
export const getMegaMenuData = cache(async () => {
    try {
        const [categories, subcategories, brands] = await Promise.all([
            // All active categories
            prisma.categories.findMany({
                where: {
                    is_active: true,
                    slug: { not: 'san-go' }, // Removed from project scope
                },
                orderBy: { sort_order: 'asc' },
                select: { id: true, name: true, slug: true, thumbnail_url: true, icon_name: true }
            }),
            // All active subcategories with their category reference
            prisma.subcategories.findMany({
                where: { is_active: true },
                orderBy: { sort_order: 'asc' },
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    thumbnail_url: true,
                    hero_image_url: true,
                    icon_name: true,
                    category_id: true
                }
            }),
            // Featured brands for quick navigation
            prisma.brands.findMany({
                where: { is_active: true, is_featured: true },
                orderBy: { sort_order: 'asc' },
                select: { id: true, name: true, slug: true, logo_url: true },
                take: 20
            })
        ]);

        // Group subcategories by category_id for easy lookup
        const subcatsByCategory: Record<number, typeof subcategories> = {};
        for (const sub of subcategories) {
            if (!subcatsByCategory[sub.category_id]) {
                subcatsByCategory[sub.category_id] = [];
            }
            subcatsByCategory[sub.category_id].push(sub);
        }

        // Build menu data keyed by category slug
        const menuData: Record<string, {
            subcategories: typeof subcategories;
            brands: typeof brands;
        }> = {};
        for (const cat of categories) {
            menuData[cat.slug] = {
                subcategories: subcatsByCategory[cat.id] || [],
                brands: brands // Shared brands across all categories for now
            };
        }

        return { categories, menuData };
    } catch (e) {
        console.error("MegaMenu DB Fetch Error:", e);
        return { categories: [], menuData: {} };
    }
});
