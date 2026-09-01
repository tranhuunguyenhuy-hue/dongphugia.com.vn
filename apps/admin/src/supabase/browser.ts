'use client'

import { createBrowserClient } from '@supabase/ssr'

import { getAdminSupabasePublicConfig } from '../config/env'

export function createAdminBrowserClient() {
  // Next.js replaces direct NEXT_PUBLIC_* property reads in the client bundle.
  // Passing a dynamic process.env object would work on the server but leave the
  // browser bundle without the public Supabase configuration.
  const { url, publishableKey } = getAdminSupabasePublicConfig({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  })
  return createBrowserClient(url, publishableKey, {
    auth: { flowType: 'pkce' },
  })
}
