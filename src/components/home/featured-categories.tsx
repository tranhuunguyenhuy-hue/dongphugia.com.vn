import prisma from '@/lib/prisma'
import { FeaturedProductsClient } from './featured-products-client'

export const revalidate = 3600 // Cached for 1 hour

export async function FeaturedCategories() {
    // Fetch all categories and featured products using unified v2 schema
    const [allCategories, featuredProducts] = await Promise.all([
        prisma.categories.findMany({
            where: { is_active: true },
            orderBy: { sort_order: 'asc' },
            select: { id: true, name: true, slug: true }
        }),
        prisma.products.findMany({
            where: { is_featured: true, is_active: true },
            include: {
                categories: { select: { id: true, slug: true } },
                subcategories: { select: { name: true, slug: true } },
                brands: { select: { name: true, slug: true } }
            },
            take: 40, // 8 per category × 5
            orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }]
        })
    ])

    // Group products by category slug
    const productsByCategory = new Map<string, typeof featuredProducts>()
    for (const product of featuredProducts) {
        const slug = product.categories?.slug
        if (!slug) continue
        if (!productsByCategory.has(slug)) {
            productsByCategory.set(slug, [])
        }
        const items = productsByCategory.get(slug)!
        if (items.length < 8) {
            items.push(product)
        }
    }

    const categories = allCategories.map(cat => ({
        id: cat.slug,
        label: cat.name,
        basePath: `/${cat.slug}`,
        products: (productsByCategory.get(cat.slug) || []).map(p => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            price: p.price != null ? Number(p.price) : null,
            original_price: p.original_price != null ? Number(p.original_price) : null,
            price_display: p.price_display,
            image_main_url: p.image_main_url,

            is_promotion: p.is_promotion,
            
            stock_status: p.stock_status,
            subcategories: p.subcategories,
            brands: p.brands,
        }))
    }))

    return (
        <section className="py-20 lg:py-28 bg-neutral-50 overflow-hidden">
            <div className="max-w-[1280px] mx-auto px-5">
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
                    <div>
                        <div className="h-1 w-8 bg-[#2E7A96] mb-4" />
                        <h2 className="text-[13px] font-medium tracking-[0.15em] uppercase text-neutral-500 mb-2">
                            Sản phẩm nổi bật
                        </h2>
                        <p className="text-3xl lg:text-[36px] leading-tight font-medium text-neutral-900">
                            Khám phá những sản phẩm cao cấp
                        </p>
                    </div>
                </div>

                <FeaturedProductsClient categories={categories} />
            </div>
        </section>
    )
}
