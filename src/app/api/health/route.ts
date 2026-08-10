import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        await prisma.products.count({ where: { is_active: true } })
        await prisma.categories.count()
    } catch (error: unknown) {
        const prismaCode = error && typeof error === 'object' && 'code' in error
            ? String(error.code)
            : undefined

        console.error(JSON.stringify({
            event: 'health_check_failed',
            prismaCode,
        }))

        return Response.json(
            { ok: false, error: 'service_unavailable' },
            { status: 503 },
        )
    }

    return Response.json(
        { ok: true },
        { status: 200 },
    )
}
