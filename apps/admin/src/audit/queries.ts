import 'server-only'

import { createAdminServerClient } from '../supabase/server'
import { parseAdminAuditEvents } from './contracts'

export async function getAdminAuditEvents(limit = 50, offset = 0) {
  const client = await createAdminServerClient()
  const { data, error } = await client.schema('public').rpc('leo542_admin_audit_list', {
    p_limit: limit,
    p_offset: offset,
  })
  if (error) return null
  return parseAdminAuditEvents(data)
}
