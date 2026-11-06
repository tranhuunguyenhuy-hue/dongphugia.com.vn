export const ORDER_REQUEST_STATUSES = [
  'pending',
  'received',
  'confirmed',
  'inventory_check',
  'completed',
  'cancelled',
] as const

export type OrderRequestStatus = (typeof ORDER_REQUEST_STATUSES)[number]
export type ShippingFeeStatus = 'pending_confirmation' | 'confirmed' | 'not_applicable'

export type AdminOrderSummary = Readonly<{
  id: number
  order_number: string
  customer_name: string
  customer_phone: string
  status: OrderRequestStatus
  payment_status: string
  total: number
  shipping_fee_status: ShippingFeeStatus
  assigned_to: number | null
  created_at: string
}>

export type AdminOrderItem = Readonly<{
  id: number
  product_id: number
  product_name: string
  product_sku: string
  quantity: number
  unit_price: number
  total_price: number
  commercial_snapshot: Record<string, unknown>
}>

export type OrderConfirmation = Readonly<{
  base_total: number
  shipping_fee: number
  installation_fees: Array<Readonly<{
    order_item_id: number
    product_sku: string
    install_option: 'none' | 'install' | 'replace'
    fee_per_unit: number
    line_total: number
  }>>
  confirmed_total: number
  confirmed_at: string
}>

export type AdminOrderDetail = Readonly<{
  order: AdminOrderSummary & {
    customer_email: string | null
    customer_address: string | null
    note: string | null
    subtotal: number
    discount: number
    shipping_fee: number
    internal_note: string | null
    updated_at: string
  }
  items: AdminOrderItem[]
  confirmation: OrderConfirmation | null
}>

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function positiveInteger(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isSafeInteger(number) && number > 0 ? number : null
}

function nonNegativeNumber(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

function parseOrderSummary(value: unknown): AdminOrderSummary | null {
  const candidate = record(value)
  if (!candidate) return null
  const id = positiveInteger(candidate.id)
  const total = nonNegativeNumber(candidate.total)
  const shippingFeeStatus = candidate.shipping_fee_status
  if (
    id === null || total === null ||
    typeof candidate.order_number !== 'string' ||
    typeof candidate.customer_name !== 'string' ||
    typeof candidate.customer_phone !== 'string' ||
    typeof candidate.status !== 'string' ||
    !ORDER_REQUEST_STATUSES.includes(candidate.status as OrderRequestStatus) ||
    typeof candidate.payment_status !== 'string' ||
    (shippingFeeStatus !== 'pending_confirmation' && shippingFeeStatus !== 'confirmed' && shippingFeeStatus !== 'not_applicable') ||
    typeof candidate.created_at !== 'string'
  ) return null

  const assignedTo = candidate.assigned_to === null || candidate.assigned_to === undefined
    ? null
    : positiveInteger(candidate.assigned_to)
  if (candidate.assigned_to !== null && candidate.assigned_to !== undefined && assignedTo === null) return null

  return {
    id,
    order_number: candidate.order_number,
    customer_name: candidate.customer_name,
    customer_phone: candidate.customer_phone,
    status: candidate.status as OrderRequestStatus,
    payment_status: candidate.payment_status,
    total,
    shipping_fee_status: shippingFeeStatus,
    assigned_to: assignedTo,
    created_at: candidate.created_at,
  }
}

export function parseAdminOrderList(value: unknown): { orders: AdminOrderSummary[]; total: number } | null {
  const candidate = record(value)
  if (!candidate || !Array.isArray(candidate.orders)) return null
  const total = nonNegativeNumber(candidate.total)
  if (total === null) return null
  const orders = candidate.orders.map(parseOrderSummary)
  if (orders.some((order) => order === null)) return null
  return { orders: orders as AdminOrderSummary[], total }
}

export function parseAdminOrderDetail(value: unknown): AdminOrderDetail | null {
  const candidate = record(value)
  const order = record(candidate?.order)
  if (!order || !Array.isArray(candidate?.items)) return null
  const summary = parseOrderSummary(order)
  const subtotal = nonNegativeNumber(order.subtotal)
  const discount = nonNegativeNumber(order.discount)
  const shippingFee = nonNegativeNumber(order.shipping_fee)
  const shippingFeeStatus = order.shipping_fee_status
  if (
    !summary || subtotal === null || discount === null || shippingFee === null ||
    (shippingFeeStatus !== 'pending_confirmation' && shippingFeeStatus !== 'confirmed' && shippingFeeStatus !== 'not_applicable') ||
    typeof order.updated_at !== 'string' ||
    (order.customer_email !== null && typeof order.customer_email !== 'string') ||
    (order.customer_address !== null && typeof order.customer_address !== 'string') ||
    (order.note !== null && typeof order.note !== 'string') ||
    (order.internal_note !== null && typeof order.internal_note !== 'string')
  ) return null

  const items = candidate.items.map((value): AdminOrderItem | null => {
    const item = record(value)
    const id = positiveInteger(item?.id)
    const productId = positiveInteger(item?.product_id)
    const quantity = positiveInteger(item?.quantity)
    const unitPrice = nonNegativeNumber(item?.unit_price)
    const totalPrice = nonNegativeNumber(item?.total_price)
    const commercialSnapshot = record(item?.commercial_snapshot)
    if (
      !item || id === null || productId === null || quantity === null ||
      unitPrice === null || totalPrice === null || !commercialSnapshot ||
      typeof item.product_name !== 'string' || typeof item.product_sku !== 'string'
    ) return null
    return {
      id,
      product_id: productId,
      product_name: item.product_name,
      product_sku: item.product_sku,
      quantity,
      unit_price: unitPrice,
      total_price: totalPrice,
      commercial_snapshot: commercialSnapshot,
    }
  })
  if (items.some((item) => item === null)) return null

  let confirmation: OrderConfirmation | null = null
  const rawConfirmation = record(candidate?.confirmation)
  if (candidate?.confirmation !== null && candidate?.confirmation !== undefined) {
    if (!rawConfirmation || !Array.isArray(rawConfirmation.installation_fees)) return null
    const baseTotal = nonNegativeNumber(rawConfirmation.base_total)
    const confirmationShipping = nonNegativeNumber(rawConfirmation.shipping_fee)
    const confirmedTotal = nonNegativeNumber(rawConfirmation.confirmed_total)
    if (baseTotal === null || confirmationShipping === null || confirmedTotal === null || typeof rawConfirmation.confirmed_at !== 'string') return null
    const installationFees = rawConfirmation.installation_fees.map((value) => {
      const fee = record(value)
      const orderItemId = positiveInteger(fee?.order_item_id)
      const feePerUnit = nonNegativeNumber(fee?.fee_per_unit)
      const lineTotal = nonNegativeNumber(fee?.line_total)
      if (
        !fee || orderItemId === null || feePerUnit === null || lineTotal === null ||
        typeof fee.product_sku !== 'string' ||
        (fee.install_option !== 'none' && fee.install_option !== 'install' && fee.install_option !== 'replace')
      ) return null
      return {
        order_item_id: orderItemId,
        product_sku: fee.product_sku,
        install_option: fee.install_option,
        fee_per_unit: feePerUnit,
        line_total: lineTotal,
      }
    })
    if (installationFees.some((fee) => fee === null)) return null
    confirmation = {
      base_total: baseTotal,
      shipping_fee: confirmationShipping,
      installation_fees: installationFees as OrderConfirmation['installation_fees'],
      confirmed_total: confirmedTotal,
      confirmed_at: rawConfirmation.confirmed_at,
    }
  }
  if (summary.status === 'confirmed' && confirmation === null) return null

  return {
    order: {
      ...summary,
      customer_email: order.customer_email as string | null,
      customer_address: order.customer_address as string | null,
      note: order.note as string | null,
      subtotal,
      discount,
      shipping_fee: shippingFee,
      shipping_fee_status: shippingFeeStatus,
      internal_note: order.internal_note as string | null,
      updated_at: order.updated_at,
    },
    items: items as AdminOrderItem[],
    confirmation,
  }
}

export function parseOrderRequestStatus(value: string | undefined): OrderRequestStatus | null {
  return value && ORDER_REQUEST_STATUSES.includes(value as OrderRequestStatus)
    ? value as OrderRequestStatus
    : null
}

export function parseOrderSearchQuery(value: string | undefined): { value: string; error: string | null } {
  const normalized = (value ?? '').trim()
  if (normalized.length > 100) return { value: normalized.slice(0, 100), error: 'Từ khóa tối đa 100 ký tự.' }
  if (/[\u0000-\u001f\u007f]/.test(normalized)) return { value: '', error: 'Từ khóa có ký tự không hợp lệ.' }
  return { value: normalized, error: null }
}

export function allowedOrderRequestStatusTransitions(status: OrderRequestStatus): OrderRequestStatus[] {
  if (status === 'pending') return ['received', 'cancelled']
  if (status === 'received') return ['cancelled']
  if (status === 'confirmed') return ['inventory_check', 'cancelled']
  if (status === 'inventory_check') return ['completed', 'cancelled']
  return []
}
