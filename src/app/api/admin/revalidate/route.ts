import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getWriteFreezeMessage, requireWritesAllowed, WRITE_FREEZE_ERROR_CODE } from '@/lib/write-freeze'

const DEFAULT_TAGS = ['brands', 'categories', 'subcategories']
const MAX_TAGS_PER_REQUEST = 20
const TAG_PATTERN = /^[a-z0-9:_-]{1,128}$/i

function getRevalidateSecret() {
    return process.env.REVALIDATE_SECRET || process.env.REVALIDATION_SECRET
}

function parseTags(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const tags = searchParams.get('tags')?.split(',') ?? DEFAULT_TAGS
    return tags
        .map(tag => tag.trim())
        .filter(Boolean)
        .slice(0, MAX_TAGS_PER_REQUEST)
}

// POST /api/admin/revalidate?tags=brands,categories
// Busts Next.js unstable_cache by tag
export async function POST(req: NextRequest) {
    const secret = req.headers.get('x-revalidate-secret')
    const configuredSecret = getRevalidateSecret()

    if (!configuredSecret) {
        return NextResponse.json(
            { error: 'Revalidation is not configured' },
            { status: 503 },
        )
    }

    if (secret !== configuredSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        requireWritesAllowed('api.admin.revalidate')
    } catch {
        return NextResponse.json(
            { error: getWriteFreezeMessage(), code: WRITE_FREEZE_ERROR_CODE },
            { status: 503 },
        )
    }

    const tags = parseTags(req)
    if (tags.length === 0 || tags.some(tag => !TAG_PATTERN.test(tag))) {
        return NextResponse.json(
            { error: 'Invalid revalidation tag' },
            { status: 400 },
        )
    }

    const revalidated: string[] = []
    for (const tag of tags) {
        revalidateTag(tag, 'max')
        revalidated.push(tag)
    }

    return NextResponse.json({
        success: true,
        revalidated,
        timestamp: new Date().toISOString(),
    })
}

export async function GET() {
    return NextResponse.json(
        { error: 'Method not allowed' },
        { status: 405, headers: { Allow: 'POST' } },
    )
}
