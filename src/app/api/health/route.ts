export const dynamic = 'force-dynamic'

export async function GET() {
    const start = Date.now()
    return Response.json({
        ok: true,
        time: Date.now() - start,
        region: process.env.VERCEL_REGION,
    })
}
