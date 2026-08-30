import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const response = NextResponse.next()
  const isApiResponse = request.nextUrl.pathname.startsWith('/api/')
  response.headers.set(
    'Cache-Control',
    isApiResponse
      ? 'private, no-store'
      : 'public, max-age=0, s-maxage=300, must-revalidate',
  )
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
