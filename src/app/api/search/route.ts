import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'

/**
 * GET /api/search?q=bon+cau&category=thiet-bi-ve-sinh&limit=10&page=1
 *
 * Full-Text Search dùng PostgreSQL tsvector + GIN index.
 * Fallback về ILIKE nếu search_vector chưa được backfill cho record đó.
 */
export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl
    const q = searchParams.get('q')?.trim() ?? ''
    const category = searchParams.get('category') ?? ''
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '10'), 50)
    const page = Math.max(parseInt(searchParams.get('page') ?? '1'), 1)
    const offset = (page - 1) * limit
    const mode = searchParams.get('mode') ?? 'autocomplete' // 'autocomplete' | 'full'

    if (!q || q.length < 2) {
        return NextResponse.json({ results: [], total: 0, query: q })
    }

    try {
        // Build tsquery — convert spaces to & for AND search
        // Also try prefix matching for partial words
        const tsQuery = q
            .split(/\s+/)
            .filter(Boolean)
            .map(w => `${w.replace(/'/g, "''")}:*`) // prefix match
            .join(' & ')

        // Category filter SQL fragment
        const categoryJoin = category
            ? Prisma.sql`INNER JOIN categories c ON p.category_id = c.id AND c.slug = ${category}`
            : Prisma.sql``

        // Run FTS query
        const results = await prisma.$queryRaw<{
            id: number
            sku: string
            name: string
            slug: string
            price: number | null
            price_display: string | null
            image_main_url: string | null
            category_slug: string
            subcategory_slug: string | null
            brand_name: string | null
            rank: number
        }[]>`
            SELECT
                p.id,
                p.sku,
                p.name,
                p.slug,
                p.price::float,
                p.price_display,
                p.image_main_url,
                cat.slug AS category_slug,
                sub.slug AS subcategory_slug,
                br.name  AS brand_name,
                ts_rank(p.search_vector, to_tsquery('simple', ${tsQuery})) AS rank
            FROM products p
            INNER JOIN categories cat ON p.category_id = cat.id
            LEFT JOIN subcategories sub ON p.subcategory_id = sub.id
            LEFT JOIN brands br ON p.brand_id = br.id
            ${categoryJoin}
            WHERE
                p.is_active = true
                AND (
                    -- Primary: FTS with tsvector
                    (p.search_vector IS NOT NULL AND p.search_vector @@ to_tsquery('simple', ${tsQuery}))
                    OR
                    -- Fallback: ILIKE for products without search_vector yet
                    (p.search_vector IS NULL AND (
                        p.name ILIKE ${`%${q}%`}
                        OR p.sku ILIKE ${`%${q}%`}
                    ))
                    OR
                    -- Always match exact SKU
                    p.sku ILIKE ${`${q}%`}
                )
            ORDER BY rank DESC, p.sort_order ASC
            LIMIT ${limit}
            OFFSET ${offset}
        `

        // Count query (without LIMIT)
        const countResult = await prisma.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(*) as count
            FROM products p
            INNER JOIN categories cat ON p.category_id = cat.id
            ${categoryJoin}
            WHERE
                p.is_active = true
                AND (
                    (p.search_vector IS NOT NULL AND p.search_vector @@ to_tsquery('simple', ${tsQuery}))
                    OR (p.search_vector IS NULL AND (
                        p.name ILIKE ${`%${q}%`}
                        OR p.sku ILIKE ${`%${q}%`}
                    ))
                    OR p.sku ILIKE ${`${q}%`}
                )
        `

        const total = Number(countResult[0]?.count ?? 0)

        // For autocomplete mode, return minimal data
        const response = {
            results: results.map(r => ({
                id: r.id,
                sku: r.sku,
                name: r.name,
                slug: r.slug,
                price: r.price,
                price_display: r.price_display,
                image_main_url: r.image_main_url,
                category_slug: r.category_slug,
                subcategory_slug: r.subcategory_slug,
                brand_name: r.brand_name,
                url: r.subcategory_slug
                    ? `/${r.category_slug}/${r.subcategory_slug}/${r.slug}`
                    : `/${r.category_slug}/${r.slug}`,
            })),
            total,
            page,
            limit,
            query: q,
        }

        return NextResponse.json(response, {
            headers: {
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
            },
        })
    } catch (err) {
        console.error('[GET /api/search]', err)
        // Fallback graceful: ILIKE only
        try {
            const fallback = await prisma.products.findMany({
                where: {
                    is_active: true,
                    OR: [
                        { name: { contains: q, mode: 'insensitive' } },
                        { sku: { contains: q, mode: 'insensitive' } },
                    ],
                    ...(category && { categories: { slug: category } }),
                },
                select: {
                    id: true, sku: true, name: true, slug: true,
                    price: true, price_display: true, image_main_url: true,
                    categories: { select: { slug: true } },
                    subcategories: { select: { slug: true } },
                    brands: { select: { name: true } },
                },
                take: limit,
                skip: offset,
            })
            return NextResponse.json({
                results: fallback.map(r => ({
                    id: r.id,
                    sku: r.sku,
                    name: r.name,
                    slug: r.slug,
                    price: r.price ? Number(r.price) : null,
                    price_display: r.price_display,
                    image_main_url: r.image_main_url,
                    category_slug: r.categories.slug,
                    subcategory_slug: r.subcategories?.slug ?? null,
                    brand_name: r.brands?.name ?? null,
                    url: r.subcategories?.slug
                        ? `/${r.categories.slug}/${r.subcategories.slug}/${r.slug}`
                        : `/${r.categories.slug}/${r.slug}`,
                })),
                total: fallback.length,
                page, limit, query: q, _fallback: true,
            })
        } catch {
            return NextResponse.json({ error: 'Lỗi tìm kiếm. Vui lòng thử lại.' }, { status: 500 })
        }
    }
}
