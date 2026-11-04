const ORDER_NUMBER_PATTERN = /^DPG-[0-9]{6}-[0-9A-F]{8}$/

/** Accept only the persisted, pending, unpaid response returned by order intake. */
export function getPersistedOrderRequestNumber(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !('data' in value)) return null
  const data = value.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const keys = Object.keys(data).sort()
  if (keys.length !== 3 || keys.join(',') !== 'order_number,payment_status,status') return null
  if (
    !('order_number' in data) || typeof data.order_number !== 'string'
    || !ORDER_NUMBER_PATTERN.test(data.order_number)
    || !('status' in data) || data.status !== 'pending'
    || !('payment_status' in data) || data.payment_status !== 'unpaid'
  ) return null
  return data.order_number
}
