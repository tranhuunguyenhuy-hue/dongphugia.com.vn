import { NextResponse, type NextRequest } from 'next/server'

import { createAdminServerClient } from '../../../src/supabase/server'
import { getAdminPath, isAdminAuthEnabled } from '../../../src/config/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!isAdminAuthEnabled()) return Response.json({ error: 'Admin authentication is unavailable in this environment.' }, { status: 503, headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' } })
  const supabase = await createAdminServerClient()
  await supabase.auth.signOut({ scope: 'global' })
  const response = NextResponse.redirect(new URL(getAdminPath('/login'), request.url))
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return response
}
