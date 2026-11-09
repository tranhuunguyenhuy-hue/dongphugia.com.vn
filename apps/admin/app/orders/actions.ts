'use server'

import { revalidatePath } from 'next/cache'

import { requireActiveStaff } from '../../src/auth/require-staff'
import { createAdminServerClient } from '../../src/supabase/server'
const STAFF_TRANSITION_STATUSES = ['received', 'inventory_check', 'completed', 'cancelled'] as const

export type OrderStatusActionResult =
  | { ok: true }
  | { ok: false; message: string }

export type CommercialConfirmationInput = {
  orderId: number
  shippingFee: number
  installationFees: Array<{ orderItemId: number; feePerUnit: number }>
  idempotencyKey: string
}

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

export async function confirmGuestOrderCommercialTerms(input: CommercialConfirmationInput): Promise<OrderStatusActionResult> {
  const staff = await requireActiveStaff()
  if (!staff.capabilities.includes('orders:update_status')) {
    return { ok: false, message: 'Tài khoản không có quyền xác nhận yêu cầu đặt hàng.' }
  }

  const feeRows = input && typeof input === 'object' ? input.installationFees : null
  const validFeeRows = Array.isArray(feeRows)
    && feeRows.length >= 1 && feeRows.length <= 50
    && feeRows.every((fee) => fee !== null && typeof fee === 'object'
      && Number.isSafeInteger(fee.orderItemId) && fee.orderItemId > 0
      && Number.isSafeInteger(fee.feePerUnit) && fee.feePerUnit >= 0 && fee.feePerUnit <= 1_000_000_000_000)
    && new Set(feeRows.map((fee) => fee?.orderItemId)).size === feeRows.length
  if (
    !input || typeof input !== 'object' ||
    !Number.isSafeInteger(input.orderId) || input.orderId < 1 ||
    !Number.isSafeInteger(input.shippingFee) || input.shippingFee < 0 || input.shippingFee > 1_000_000_000_000 ||
    !validFeeRows ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.idempotencyKey)
  ) {
    return { ok: false, message: 'Thông tin xác nhận thương mại không hợp lệ.' }
  }

  const client = await createAdminServerClient()
  const { error } = await client.schema('public').rpc('phase2_admin_order_confirm', {
    p_order_id: input.orderId,
    p_shipping_fee: input.shippingFee,
    p_installation_fees: input.installationFees.map((fee) => ({
      order_item_id: fee.orderItemId,
      fee_per_unit: fee.feePerUnit,
    })),
    p_idempotency_key: input.idempotencyKey,
    p_request_id: crypto.randomUUID(),
  })
  if (error) {
    const message = error.message || ''
    if (message.includes('FORBIDDEN') || message.includes('RESOURCE_NOT_FOUND')) {
      return { ok: false, message: 'Không tìm thấy yêu cầu hoặc tài khoản không có quyền truy cập.' }
    }
    if (message.includes('IDEMPOTENCY_KEY_REUSED')) {
      return { ok: false, message: 'Khóa thử lại đã được dùng cho nội dung khác. Hãy tải lại trang.' }
    }
    if (message.includes('ORDER_ALREADY_CONFIRMED')) {
      return { ok: false, message: 'Yêu cầu đã được xác nhận. Tải lại trang để xem snapshot thương mại.' }
    }
    if (message.includes('INSTALLATION_FEE_LINES_MISMATCH') || message.includes('INSTALLATION_FEE_CONFLICTS')) {
      return { ok: false, message: 'Phí lắp đặt không khớp với các dòng hàng. Tải lại trang và thử lại.' }
    }
    if (message.includes('INVALID_ORDER_TRANSITION')) {
      return { ok: false, message: 'Yêu cầu chưa ở trạng thái tiếp nhận để xác nhận thương mại.' }
    }
    return { ok: false, message: 'Chưa xác nhận được yêu cầu. Vui lòng thử lại.' }
  }

  revalidatePath('/orders')
  revalidatePath(`/orders/${input.orderId}`)
  return { ok: true }
}
