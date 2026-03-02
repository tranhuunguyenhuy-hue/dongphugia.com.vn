import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
    const start = Date.now()
    await prisma.$queryRaw`SELECT 1`
    const dbTime = Date.now() - start

    return Response.json({
        dbTime,
        region: process.env.VERCEL_REGION,
    })
}
