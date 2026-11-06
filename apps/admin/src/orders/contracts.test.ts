import { describe, expect, it } from 'vitest'

import {
  allowedOrderRequestStatusTransitions,
  parseAdminOrderDetail,
  parseAdminOrderList,
  parseOrderSearchQuery,
  parseOrderRequestStatus,
} from './contracts'

const summary = {
  id: 14,
  order_number: 'DPG-261104-0000000E',
  customer_name: 'Customer Name',
  customer_phone: '0900000000',
  status: 'pending',
  payment_status: 'unpaid',
  total: 1200000,
  shipping_fee_status: 'pending_confirmation',
  assigned_to: null,
  created_at: '2026-11-04T10:00:00.000Z',
}

describe('Admin order inbox transport contracts', () => {
  it('accepts only well-formed staff-visible order summaries', () => {
    expect(parseAdminOrderList({ orders: [summary], total: 1 })).toEqual({
      orders: [summary],
      total: 1,
    })
    expect(parseAdminOrderList({ orders: [{ ...summary, status: 'unexpected' }], total: 1 })).toBeNull()
    expect(parseAdminOrderList({ orders: [{ ...summary, shipping_fee_status: 'unknown' }], total: 1 })).toBeNull()
    expect(parseAdminOrderList({ orders: [summary], total: -1 })).toBeNull()
  })

  it('requires the commercial snapshot on order detail items', () => {
    const detail = {
      order: {
        ...summary,
        customer_email: null,
        customer_address: null,
        note: null,
        subtotal: 1200000,
        discount: 0,
        shipping_fee: 0,
        shipping_fee_status: 'pending_confirmation',
        internal_note: null,
        updated_at: summary.created_at,
      },
      items: [{
        id: 2,
        product_id: 4,
        product_name: 'Product',
        product_sku: 'SKU-1',
        quantity: 1,
        unit_price: 1200000,
        total_price: 1200000,
        commercial_snapshot: { final_unit_price: 1200000 },
      }],
    }
    expect(parseAdminOrderDetail(detail)?.items).toHaveLength(1)
    expect(parseAdminOrderDetail({ ...detail, items: [{ ...detail.items[0], commercial_snapshot: null }] })).toBeNull()
  })

  it('allows only staff confirmation steps for public order requests', () => {
    expect(parseOrderRequestStatus('pending')).toBe('pending')
    expect(parseOrderRequestStatus('not-a-status')).toBeNull()
    expect(allowedOrderRequestStatusTransitions('pending')).toEqual(['received', 'cancelled'])
    expect(allowedOrderRequestStatusTransitions('received')).toEqual(['cancelled'])
    expect(allowedOrderRequestStatusTransitions('confirmed')).toEqual([])
  })

  it('normalizes bounded order search and rejects control characters or oversized input', () => {
    expect(parseOrderSearchQuery('  DPG-261104  ')).toEqual({ value: 'DPG-261104', error: null })
    expect(parseOrderSearchQuery('')).toEqual({ value: '', error: null })
    expect(parseOrderSearchQuery('a'.repeat(101))).toEqual({ value: 'a'.repeat(100), error: 'Từ khóa tối đa 100 ký tự.' })
    expect(parseOrderSearchQuery('Nguyễn\nA')).toEqual({ value: '', error: 'Từ khóa có ký tự không hợp lệ.' })
  })
})
