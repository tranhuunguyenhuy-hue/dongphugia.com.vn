import { NextResponse, type NextRequest } from 'next/server'

import { createAdminServerClient } from '../../../src/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function safeNext(value: string | null) {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/'
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const destination = safeNext(request.nextUrl.searchParams.get('next'))
  if (!code) {
    const response = NextResponse.redirect(new URL('/login?error=auth_callback', request.url))
    response.headers.set('Cache-Control', 'private, no-store')
    return response
  }

  const supabase = await createAdminServerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  const response = NextResponse.redirect(
    new URL(error ? '/login?error=auth_callback' : destination, request.url),
  )
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return response
}
