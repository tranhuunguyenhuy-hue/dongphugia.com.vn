import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { getAdminSupabasePublicConfig } from '../config/env'

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
  return PUBLIC_PATHS.has(pathname)
}

export async function updateAdminSession(request: NextRequest) {
  const { url, publishableKey } = getAdminSupabasePublicConfig()
  let response = NextResponse.next({ request })
  const supabase = createServerClient(url, publishableKey, {
    auth: { flowType: 'pkce' },
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
