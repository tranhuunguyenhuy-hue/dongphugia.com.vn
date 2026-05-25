import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
    const start = Date.now()
    let dbStatus: Record<string, unknown> = { ok: false }

    try {
        const productCount = await prisma.products.count({ where: { is_active: true } })
        const categoryCount = await prisma.categories.count()
        dbStatus = {
            ok: true,
            products: productCount,
            categories: categoryCount,
            queryTime: Date.now() - start,
        }
    } catch (e: unknown) {
        dbStatus = {
            ok: false,
            error: e instanceof Error ? e.message : String(e),
            code: typeof e === 'object' && e !== null ? (e as { code?: string }).code : undefined,
            queryTime: Date.now() - start,
        }
    }

    return Response.json({
        ok: dbStatus.ok,
        time: Date.now() - start,
        region: process.env.VERCEL_REGION,
        db: dbStatus,
        env: {
            hasDbUrl: !!process.env.DATABASE_URL,
            hasDirectUrl: !!process.env.DIRECT_URL,
            dbUrlPrefix: process.env.DATABASE_URL?.substring(0, 30) + '...',
        },
    })
}
