import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { rateLimiter, getClientIp, RATE_LIMITS } from '@/lib/rate-limiter'
import { buildPublicProductVisibilityWhere } from '@/lib/public-product-visibility'
import { getCanonicalProductPath, primaryTaxonAssignmentSelect } from '@/lib/taxonomy-paths'

export async function GET(request: NextRequest) {
    // Rate limiting: 30 requests per minute per IP
    const ip = getClientIp(request)
    const { maxReqs, windowMs } = RATE_LIMITS.searchGet
    if (!rateLimiter.isAllowed(`search:${ip}`, maxReqs, windowMs)) {
        return NextResponse.json(
            { error: 'Quá nhiều yêu cầu, vui lòng thử lại sau.' },
            { status: 429, headers: { 'Retry-After': '60' } }
        )
    }

    try {
        const { searchParams } = new URL(request.url)
        const q = searchParams.get('q')
        const limit = parseInt(searchParams.get('limit') || '8', 10)

        if (!q || q.length < 2) {
            return NextResponse.json({ results: [], total: 0 })
        }

        const whereClause = {
            AND: [
                buildPublicProductVisibilityWhere(),
                {
                    OR: [
                        { name: { contains: q, mode: 'insensitive' as const } },
                        { sku: { contains: q, mode: 'insensitive' as const } },
                    ]
                },
            ],
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
                    original_price: true,
                    online_discount_amount: true,
                    price_display: true,
                    image_main_url: true,
                    is_promotion: true,
                    is_featured: true,
                    stock_status: true,
                    is_active: true,
                    display_name: true,
                    product_type: true,
                    categories: { select: { slug: true, name: true } },
                    subcategories: { select: { slug: true, name: true } },
                    brands: { select: { name: true } },
                    product_taxon_assignments: primaryTaxonAssignmentSelect,
                },
                orderBy: [
                    { is_active: 'desc' },
                    { is_promotion: 'desc' },
                    { created_at: 'desc' }
                ]
            }),
            prisma.products.count({ where: whereClause })
        ])

        const results = products.map(p => {
            const canonical = getCanonicalProductPath(p)
            return {
                ...p,
                price: p.price ? Number(p.price) : null,
                original_price: p.original_price ? Number(p.original_price) : null,
                online_discount_amount: p.online_discount_amount ? Number(p.online_discount_amount) : null,
                category_slug: canonical.categorySlug,
                subcategory_slug: canonical.subcategorySlug,
                brand_name: p.brands?.name || null,
                url: canonical.urlPath,
            }
        })

        return NextResponse.json({ results, total })
    } catch (error) {
        console.error('[SEARCH_API_ERROR]', error)
        return NextResponse.json({ results: [], total: 0 }, { status: 500 })
    }
}
