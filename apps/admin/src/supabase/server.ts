import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { getAdminSupabasePublicConfig } from '../config/env'

export async function createAdminServerClient() {
  const cookieStore = await cookies()
  const { url, publishableKey } = getAdminSupabasePublicConfig()

  return createServerClient(url, publishableKey, {
    auth: { flowType: 'pkce' },
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Server Components cannot always write cookies. The Admin proxy
          // owns refresh persistence for subsequent requests.
        }
      },
    },
  })
}
