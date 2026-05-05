import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const q = searchParams.get('q')
        const limit = parseInt(searchParams.get('limit') || '8', 10)

        if (!q || q.length < 2) {
            return NextResponse.json({ results: [], total: 0 })
        }

        const whereClause = {
            is_active: true,
            OR: [
                { name: { contains: q, mode: 'insensitive' as const } },
                { sku: { contains: q, mode: 'insensitive' as const } },
            ]
        }

        const [products, total] = await Promise.all([
            prisma.products.findMany({
                where: whereClause,
                take: limit,
                select: {
                    id: true,
                    sku: true,
                    name: true,
                    slug: true,
                    price: true,
                    price_display: true,
                    image_main_url: true,
                    categories: { select: { slug: true } },
                    subcategories: { select: { slug: true } },
                    brands: { select: { name: true } },
                },
                orderBy: [
                    { is_promotion: 'desc' },
                    { created_at: 'desc' }
                ]
            }),
            prisma.products.count({ where: whereClause })
        ])

        const results = products.map(p => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            slug: p.slug,
            price: p.price ? Number(p.price) : null,
            price_display: p.price_display,
            image_main_url: p.image_main_url,
            category_slug: p.categories?.slug || 'san-pham',
            subcategory_slug: p.subcategories?.slug || 'chi-tiet',
            brand_name: p.brands?.name || null,
            url: `/${p.categories?.slug || 'san-pham'}/${p.subcategories?.slug || 'chi-tiet'}/${p.slug}`
        }))

        return NextResponse.json({ results, total })
    } catch (error) {
        console.error('[SEARCH_API_ERROR]', error)
        return NextResponse.json({ results: [], total: 0 }, { status: 500 })
    }
}
