import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { getPublicAppEnvironment } from './src/config/env'
import {
  isTemporarilyUnavailablePublicPath,
  PUBLIC_PREVIEW_ROBOTS_HEADER,
  temporaryUnavailablePublicResponse,
} from './src/worker-policy'

export function proxy(request: NextRequest) {
  const preview = getPublicAppEnvironment().previewNoindex
  if (isTemporarilyUnavailablePublicPath(request)) {
    return temporaryUnavailablePublicResponse(request, preview)
  }

  const response = NextResponse.next()
  const isApiResponse = request.nextUrl.pathname.startsWith('/api/')
  response.headers.set(
    'Cache-Control',
    isApiResponse
      ? 'private, no-store'
      : 'public, max-age=0, s-maxage=300, must-revalidate',
  )
  if (preview) {
    response.headers.set('X-Robots-Tag', PUBLIC_PREVIEW_ROBOTS_HEADER)
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
