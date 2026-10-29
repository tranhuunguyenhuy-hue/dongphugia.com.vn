import { getPublicSnapshotListingShard } from '../../../../../../src/runtime/public-snapshot-listing'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const FAMILIES = new Set(['thiet-bi-ve-sinh', 'thiet-bi-bep', 'vat-lieu-nuoc', 'gach-op-lat'])
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const HEADERS = {
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex, nofollow',
    'Content-Type': 'application/json; charset=utf-8',
}

function response(status: number, message: string) {
    return new Response(JSON.stringify({ error: message }), { status, headers: HEADERS })
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ categorySlug: string; listingSlug: string }> },
) {
    const { categorySlug, listingSlug } = await params
    if (!FAMILIES.has(categorySlug) || !SLUG.test(listingSlug)) return response(404, 'Catalogue unavailable.')

    const url = new URL(request.url)
    for (const key of url.searchParams.keys()) {
        if (key !== 'page') return response(400, 'Unsupported listing request.')
    }
    const pages = url.searchParams.getAll('page')
    if (pages.length > 1 || (pages.length === 1 && !/^[1-9][0-9]{0,3}$/.test(pages[0]))) {
        return response(400, 'Unsupported listing request.')
    }
    const page = Number(pages[0] ?? '1')

    try {
        const shard = await getPublicSnapshotListingShard(categorySlug, listingSlug, page)
        if (!shard) return response(404, 'Catalogue unavailable.')
        return new Response(JSON.stringify(shard), { status: 200, headers: HEADERS })
    } catch {
        return response(503, 'Catalogue temporarily unavailable.')
    }
}
