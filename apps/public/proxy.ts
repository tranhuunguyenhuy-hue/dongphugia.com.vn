import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { getPublicAppEnvironment } from './src/config/env'
import { PUBLIC_PREVIEW_ROBOTS_HEADER } from './src/worker-policy'

export function proxy(request: NextRequest) {
  const appEnvironment = getPublicAppEnvironment()
  if (['preview', 'staging'].includes(appEnvironment.environment)
    && (request.nextUrl.pathname === '/blog' || request.nextUrl.pathname.startsWith('/blog/'))) {
    return new NextResponse('Blog content is unavailable in this environment.', {
      status: 503,
      headers: {
        'Cache-Control': 'private, no-store',
        'X-Robots-Tag': PUBLIC_PREVIEW_ROBOTS_HEADER,
      },
    })
  }
  const response = NextResponse.next()
  const isApiResponse = request.nextUrl.pathname.startsWith('/api/')
  response.headers.set(
    'Cache-Control',
    isApiResponse
      ? 'private, no-store'
      : 'public, max-age=0, s-maxage=300, must-revalidate',
  )
  if (appEnvironment.previewNoindex) {
    response.headers.set('X-Robots-Tag', PUBLIC_PREVIEW_ROBOTS_HEADER)
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
