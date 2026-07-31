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
    // The checked-in fallback only has a w960 variant. Keep that exact local
    // asset instead of manufacturing missing w720/w1280/w1600 paths.
    const responsiveUrl = banner
        ? createResponsiveMediaUrl(sourceUrl, width)
        : sourceUrl
    const target = new URL(responsiveUrl, request.url)

    if (!isAllowedMediaTarget(target, request.nextUrl)) {
        return NextResponse.json(
            { error: 'Unsupported homepage media origin' },
            { status: 422 },
        )
    }

    // Avoid sending an HTTPS request back through the public reverse proxy
    // when the media is local to this container. Coolify terminates TLS at the
    // proxy, while the Next.js listener itself is plain HTTP.
    const fetchTarget =
        target.origin === request.nextUrl.origin
            ? new URL(`${target.pathname}${target.search}`, 'http://127.0.0.1:3000')
            : target

    let upstream: Response
    try {
        upstream = await fetch(fetchTarget, {
            cache: 'force-cache',
            signal: AbortSignal.timeout(10_000),
        })
    } catch {
        return NextResponse.json(
            { error: 'Homepage media upstream failed' },
            { status: 502 },
        )
    }
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
