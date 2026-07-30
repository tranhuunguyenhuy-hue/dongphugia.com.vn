import { NextRequest, NextResponse } from 'next/server'
import { getHomepageBanners } from '@/lib/homepage-data'
import { createResponsiveMediaUrl } from '@/lib/media/media-profiles'

export const dynamic = 'force-dynamic'

const SUPPORTED_WIDTHS = new Set([720, 1280, 1600])

export async function GET(request: NextRequest) {
    const requestedWidth = Number(request.nextUrl.searchParams.get('width'))
    const width = SUPPORTED_WIDTHS.has(requestedWidth) ? requestedWidth : 1280
    const [banner] = await getHomepageBanners()
    const sourceUrl = banner?.image_url ?? '/images/banner-1.editorial.w960.webp'
    const responsiveUrl = createResponsiveMediaUrl(sourceUrl, width)
    const target = new URL(responsiveUrl, request.url)
    const response = NextResponse.redirect(target, 307)

    response.headers.set(
        'Cache-Control',
        'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
    )

    return response
}
