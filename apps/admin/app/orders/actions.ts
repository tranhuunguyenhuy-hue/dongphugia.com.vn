'use server'

import { revalidatePath } from 'next/cache'

import { requireActiveStaff } from '../../src/auth/require-staff'
import { createAdminServerClient } from '../../src/supabase/server'
const STAFF_TRANSITION_STATUSES = ['received', 'cancelled'] as const

export type OrderStatusActionResult =
  | { ok: true }
  | { ok: false; message: string }

export async function updateGuestOrderStatus(input: {
  orderId: number
  status: string
  idempotencyKey: string
}): Promise<OrderStatusActionResult> {
  const staff = await requireActiveStaff()
  if (!staff.capabilities.includes('orders:update_status')) {
    return { ok: false, message: 'Tài khoản không có quyền cập nhật yêu cầu đặt hàng.' }
  }

  if (
    !Number.isSafeInteger(input.orderId) || input.orderId < 1 ||
    !STAFF_TRANSITION_STATUSES.includes(input.status as (typeof STAFF_TRANSITION_STATUSES)[number]) ||
    !/^[a-f0-9-]{36}$/i.test(input.idempotencyKey)
  ) {
    return { ok: false, message: 'Thông tin cập nhật không hợp lệ.' }
  }

  const client = await createAdminServerClient()
  const { error } = await client.schema('public').rpc('phase2_admin_order_update_status', {
    p_order_id: input.orderId,
    p_status: input.status,
    p_idempotency_key: input.idempotencyKey,
    p_request_id: crypto.randomUUID(),
  })
  if (error) {
    const message = error.message || ''
    if (message.includes('INVALID_ORDER_TRANSITION')) {
      return { ok: false, message: 'Yêu cầu đã chuyển trạng thái. Tải lại trang để xem trạng thái mới.' }
    }
    if (message.includes('RESOURCE_NOT_FOUND') || message.includes('FORBIDDEN')) {
      return { ok: false, message: 'Không tìm thấy yêu cầu hoặc tài khoản không có quyền truy cập.' }
    }
    if (message.includes('IDEMPOTENCY_KEY_REUSED')) {
      return { ok: false, message: 'Yêu cầu cập nhật đã thay đổi. Hãy tải lại và thử lại.' }
    }
    return { ok: false, message: 'Chưa cập nhật được trạng thái. Vui lòng thử lại.' }
  }

  revalidatePath('/orders')
  revalidatePath(`/orders/${input.orderId}`)
  return { ok: true }
}
