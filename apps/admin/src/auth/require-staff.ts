import 'server-only'

import { redirect } from 'next/navigation'

import { createAdminServerClient } from '../supabase/server'

export type AdminStaffContext = Readonly<{
  auth_user_id: string
  email: string
  display_name: string
  status: 'active'
  roles: string[]
  capabilities: string[]
}>

function isActiveStaffContext(value: unknown): value is AdminStaffContext {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.auth_user_id === 'string' &&
    typeof candidate.email === 'string' &&
    typeof candidate.display_name === 'string' &&
    candidate.status === 'active' &&
    Array.isArray(candidate.roles) &&
    Array.isArray(candidate.capabilities)
  )
}

export async function requireActiveStaff(): Promise<AdminStaffContext> {
  const supabase = await createAdminServerClient()
  const { data: claims, error: claimsError } = await supabase.auth.getClaims()
  if (claimsError || !claims?.claims?.sub) redirect('/login')

  const { data, error } = await supabase.schema('dpg_v1_api').rpc('staff_context')
  if (error || !isActiveStaffContext(data)) redirect('/login?error=staff_access')
  return data
}
