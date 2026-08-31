import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

import { createAdminServerClient } from '../../../src/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_OTP_TYPES = new Set<EmailOtpType>([
  'signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email',
])

function safeNext(value: string | null) {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/'
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash')
  const typeValue = request.nextUrl.searchParams.get('type')
  const nextPath = safeNext(request.nextUrl.searchParams.get('next'))
  const type = typeValue as EmailOtpType
  const supabase = await createAdminServerClient()
  const { error } = tokenHash && ALLOWED_OTP_TYPES.has(type)
    ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    : { error: new Error('invalid confirmation') }
  const response = NextResponse.redirect(
    new URL(error ? '/login?error=auth_confirm' : nextPath, request.url),
  )
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return response
}
