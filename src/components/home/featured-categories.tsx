import prisma from '@/lib/prisma'
import { FeaturedTabsClient } from './featured-tabs-client'

export const revalidate = 3600 // Cached for 1 hour

export async function FeaturedCategories() {
    const [gach, tbvs, bep, sango, nuoc] = await Promise.all([
        prisma.products.findMany({
            where: { is_featured: true, is_active: true },
            include: { collections: true, sizes: true, surfaces: true, pattern_types: true },
            take: 8,
            orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }]
        }),
        prisma.tbvs_products.findMany({
            where: { is_featured: true, is_active: true },
            include: { tbvs_product_types: true, tbvs_brands: true, tbvs_subtypes: true, tbvs_materials: true },
            take: 8,
            orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }]
        }),
        prisma.bep_products.findMany({
            where: { is_featured: true, is_active: true },
            include: { bep_product_types: true, bep_brands: true, bep_subtypes: true },
            take: 8,
            orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }]
        }),
        prisma.sango_products.findMany({
            where: { is_featured: true, is_active: true },
            include: { sango_product_types: true, origins: true },
            take: 8,
            orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }]
        }),
        prisma.nuoc_products.findMany({
            where: { is_featured: true, is_active: true },
            include: { nuoc_product_types: true, nuoc_brands: true, nuoc_subtypes: true, nuoc_materials: true },
            take: 8,
            orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }]
        })
    ])

    const categories = [
        { id: 'gach', label: 'Gạch ốp lát', basePath: '/gach-op-lat', products: gach },
        { id: 'tbvs', label: 'Thiết bị vệ sinh', basePath: '/thiet-bi-ve-sinh', products: tbvs },
        { id: 'bep', label: 'Thiết bị bếp', basePath: '/thiet-bi-bep', products: bep },
        { id: 'sango', label: 'Sàn gỗ', basePath: '/san-go', products: sango },
        { id: 'nuoc', label: 'Vật liệu nước', basePath: '/vat-lieu-nuoc', products: nuoc }
    ]

    return (
        <section className="py-16 bg-white overflow-hidden">
            <div className="max-w-[1280px] mx-auto px-5">
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
                    <div>
                        <h2 className="text-3xl lg:text-[40px] leading-tight font-bold text-[#111827] tracking-tight">
                            Sản phẩm nổi bật
                        </h2>
                        <p className="text-[#4b5563] mt-3 text-lg">
                            Khám phá những sản phẩm cao cấp được khách hàng yêu thích nhất
                        </p>
                    </div>
                </div>

                <FeaturedTabsClient categories={categories} />
            </div>
        </section>
    )
}
