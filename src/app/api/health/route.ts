import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type DatabaseHealth =
    | {
        ok: true
        products: number
        categories: number
        queryTime: number
    }
    | {
        ok: false
        error: 'database_unavailable'
        queryTime: number
    }

export async function GET() {
    const start = Date.now()
    let dbStatus: DatabaseHealth

    try {
        const productCount = await prisma.products.count({ where: { is_active: true } })
        const categoryCount = await prisma.categories.count()
        dbStatus = {
            ok: true,
            products: productCount,
            categories: categoryCount,
            queryTime: Date.now() - start,
        }
    } catch (error: unknown) {
        const prismaCode = error && typeof error === 'object' && 'code' in error
            ? String(error.code)
            : undefined

        console.error(JSON.stringify({
            event: 'health_check_failed',
            prismaCode,
            durationMs: Date.now() - start,
        }))

        dbStatus = {
            ok: false,
            error: 'database_unavailable',
            queryTime: Date.now() - start,
        }
    }

    return Response.json({
        ok: dbStatus.ok,
        time: Date.now() - start,
        region: process.env.VERCEL_REGION,
        db: dbStatus,
    })
}
