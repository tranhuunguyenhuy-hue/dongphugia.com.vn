import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { getAdminBasePath, getAdminSupabasePublicConfig, isAdminAuthEnabled } from '../config/env'

const PUBLIC_PATHS = new Set([
  '/login',
  '/forgot-password',
  '/reset-password',
  '/auth/callback',
  '/auth/confirm',
  '/auth/logout',
  '/api/health',
  '/robots.txt',
])

function isPublicPath(pathname: string) {
  const basePath = getAdminBasePath()
  const routePath = basePath && pathname.startsWith(`${basePath}/`)
    ? pathname.slice(basePath.length)
    : pathname === basePath ? '/' : pathname
  return PUBLIC_PATHS.has(routePath)
}

export async function updateAdminSession(request: NextRequest) {
  if (!isAdminAuthEnabled()) {
    const basePath = getAdminBasePath()
    const routePath = basePath && request.nextUrl.pathname.startsWith(`${basePath}/`)
      ? request.nextUrl.pathname.slice(basePath.length)
      : request.nextUrl.pathname === basePath ? '/' : request.nextUrl.pathname
    const response = ['/auth/callback','/auth/confirm','/auth/logout'].includes(routePath)
      ? new NextResponse('Admin authentication is unavailable in this environment.', { status: 503 })
      : isPublicPath(request.nextUrl.pathname)
        ? NextResponse.next({ request })
        : NextResponse.redirect(new URL(`${basePath}/login?error=auth_unavailable`, request.url))
    response.headers.set('Cache-Control', 'private, no-store')
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    return response
  }
  const { url, publishableKey } = getAdminSupabasePublicConfig()
  let response = NextResponse.next({ request })
  const supabase = createServerClient(url, publishableKey, {
    auth: { flowType: 'pkce' },
    cookieOptions: { path: getAdminBasePath() || '/' },
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const { data } = await supabase.auth.getClaims()
  if (!data?.claims && !isPublicPath(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone()
    // Next's basePath middleware redirects from the app-relative path and adds
    // /admin to the external URL. Prefixing this path here would produce
    // /admin/admin/login in the combined Worker.
    loginUrl.pathname = '/login'
    loginUrl.search = ''
    loginUrl.searchParams.set(
      'next',
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    )
    response = NextResponse.redirect(loginUrl)
  }

  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  return response
}
