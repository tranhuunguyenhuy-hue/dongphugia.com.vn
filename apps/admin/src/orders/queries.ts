import 'server-only'

import { createAdminServerClient } from '../supabase/server'
import { parseAdminOrderDetail, parseAdminOrderList, type OrderRequestStatus } from './contracts'

export async function getOrderInbox(input: {
  status: OrderRequestStatus | null
  limit: number
  offset: number
}) {
  const client = await createAdminServerClient()
  const { data, error } = await client.schema('public').rpc('phase2_admin_order_list', {
    p_status: input.status,
    p_limit: input.limit,
    p_offset: input.offset,
  })
  if (error) return null
  return parseAdminOrderList(data)
}

export async function getGuestOrder(orderId: number) {
  const client = await createAdminServerClient()
  const { data, error } = await client.schema('public').rpc('phase2_admin_order_get', {
    p_order_id: orderId,
  })
  if (error) return null
  return parseAdminOrderDetail(data)
}
