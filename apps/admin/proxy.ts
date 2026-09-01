import type { NextRequest } from 'next/server'

import { updateAdminSession } from './src/supabase/proxy'

export async function proxy(request: NextRequest) {
  return updateAdminSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
