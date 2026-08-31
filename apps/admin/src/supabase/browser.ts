'use client'

import { createBrowserClient } from '@supabase/ssr'

import { getAdminSupabasePublicConfig } from '../config/env'

export function createAdminBrowserClient() {
  const { url, publishableKey } = getAdminSupabasePublicConfig()
  return createBrowserClient(url, publishableKey, {
    auth: { flowType: 'pkce' },
  })
}
