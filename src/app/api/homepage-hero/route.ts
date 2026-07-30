import { NextRequest, NextResponse } from 'next/server'
import { getHomepageBanners } from '@/lib/homepage-data'
import { createResponsiveMediaUrl } from '@/lib/media/media-profiles'

export const dynamic = 'force-dynamic'

const SUPPORTED_WIDTHS = new Set([720, 1280, 1600])
const REMOTE_MEDIA_HOSTS = new Set([
    process.env.BUNNY_CDN_HOSTNAME ?? 'cdn.dongphugia.com.vn',
    'tygjmrhandbffjllxveu.supabase.co',
    'vietceramics.com',
    'images.unsplash.com',
    'cdn.hita.com.vn',
    'hita.com.vn',
    'www.transparenttextures.com',
])

function isAllowedMediaTarget(target: URL, requestUrl: URL) {
    if (target.origin === requestUrl.origin) return true
    return target.protocol === 'https:' && REMOTE_MEDIA_HOSTS.has(target.hostname)
}

export async function GET(request: NextRequest) {
    const requestedWidth = Number(request.nextUrl.searchParams.get('width'))
    const width = SUPPORTED_WIDTHS.has(requestedWidth) ? requestedWidth : 1280
    const [banner] = await getHomepageBanners()
    const sourceUrl = banner?.image_url ?? '/images/banner-1.editorial.w960.webp'
    const responsiveUrl = createResponsiveMediaUrl(sourceUrl, width)
    const target = new URL(responsiveUrl, request.url)

    if (!isAllowedMediaTarget(target, request.nextUrl)) {
        return NextResponse.json(
            { error: 'Unsupported homepage media origin' },
            { status: 422 },
        )
    }

    const upstream = await fetch(target, {
        cache: 'force-cache',
        signal: AbortSignal.timeout(10_000),
    })
    const contentType = upstream.headers.get('content-type')

    if (!upstream.ok || !upstream.body || !contentType?.startsWith('image/')) {
        return NextResponse.json(
            { error: 'Homepage media is unavailable' },
            { status: 502 },
        )
    }

    return new NextResponse(upstream.body, {
        headers: {
            'Cache-Control':
                'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
            'Content-Type': contentType,
            'X-Content-Type-Options': 'nosniff',
        },
    })
}
