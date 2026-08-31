import { NextResponse, type NextRequest } from 'next/server'

import { createAdminServerClient } from '../../../src/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const supabase = await createAdminServerClient()
  await supabase.auth.signOut({ scope: 'global' })
  const response = NextResponse.redirect(new URL('/login', request.url))
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return response
}
