import { describe, expect, it } from 'vitest'
import { getPersistedOrderRequestNumber } from './guest-order-contract'

describe('getPersistedOrderRequestNumber', () => {
  it('accepts only a valid pending and unpaid intake receipt', () => {
    expect(getPersistedOrderRequestNumber({
      data: {
        order_number: 'DPG-261104-0000002A',
        status: 'pending',
        payment_status: 'unpaid',
      },
    })).toBe('DPG-261104-0000002A')
  })

  it.each([
    null,
    {},
    { data: null },
    { data: { order_number: 'DPG-261104-0000002A' } },
    { data: { order_number: 'DPG-261104-0000002A', status: 'confirmed', payment_status: 'unpaid' } },
    { data: { order_number: 'DPG-261104-0000002A', status: 'pending', payment_status: 'paid' } },
    { data: { order_number: 'forged-order', status: 'pending', payment_status: 'unpaid' } },
  ])('rejects an incomplete or unverified response: %o', (value) => {
    expect(getPersistedOrderRequestNumber(value)).toBeNull()
  })
})
