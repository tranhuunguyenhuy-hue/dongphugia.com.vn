import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'

// POST /api/admin/revalidate?tags=brands,categories
// Busts Next.js unstable_cache by tag
export async function POST(req: NextRequest) {
    const secret = req.headers.get('x-revalidate-secret')

    // Simple secret protection (optional, add REVALIDATE_SECRET to .env.local)
    if (process.env.REVALIDATE_SECRET && secret !== process.env.REVALIDATE_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const tags = searchParams.get('tags')?.split(',') ?? ['brands', 'categories', 'subcategories']

    const revalidated: string[] = []
    for (const tag of tags) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(revalidateTag as any)(tag.trim())
        revalidated.push(tag.trim())
    }

    return NextResponse.json({
        success: true,
        revalidated,
        timestamp: new Date().toISOString(),
    })
}

// GET for convenience during development
export async function GET(req: NextRequest) {
    return POST(req)
}
