import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createCartFingerprint,
  getConflictedOrderRequestReceiptKeys,
  getPendingOrderRequestReceiptKeys,
  getStoredOrderRequestReceiptKey,
  markOrderRequestReceiptConflict,
  markOrderRequestReceiptVerified,
  storeOrderRequestReceiptKey,
} from './guest-order-client'

const FIRST_KEY = '6c3af64a-b474-4e79-8c5c-92dddc0ed17e'
const SECOND_KEY = 'f4ba4023-9b36-42be-a63d-8c05db272a5b'

function createMemoryStorage() {
  const entries = new Map<string, string>()
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value),
    removeItem: (key: string) => entries.delete(key),
  }
}

describe('guest order receipt recovery storage', () => {
  beforeEach(() => vi.stubGlobal('localStorage', createMemoryStorage()))
  afterEach(() => vi.unstubAllGlobals())

  it('keeps a conflicting receipt out of automatic recovery and success-page selection', () => {
    expect(storeOrderRequestReceiptKey(FIRST_KEY)).toBe(true)

    markOrderRequestReceiptConflict(FIRST_KEY)

    expect(getPendingOrderRequestReceiptKeys()).toEqual([])
    expect(getConflictedOrderRequestReceiptKeys()).toEqual([FIRST_KEY])
    expect(getStoredOrderRequestReceiptKey()).toBeNull()
  })

  it('keeps the new request active while retaining the old conflict for lookup', () => {
    storeOrderRequestReceiptKey(FIRST_KEY)
    markOrderRequestReceiptConflict(FIRST_KEY)
    storeOrderRequestReceiptKey(SECOND_KEY)
    markOrderRequestReceiptVerified(SECOND_KEY)

    expect(getConflictedOrderRequestReceiptKeys()).toEqual([FIRST_KEY])
    expect(getStoredOrderRequestReceiptKey()).toBe(SECOND_KEY)
  })
})

describe('guest order cart fingerprint', () => {
  it('changes when the selected exact SKU changes', async () => {
    const first = await createCartFingerprint([
      { productId: 42, sku: 'SKU-42-A', quantity: 1, installOption: 'none' },
    ])
    const second = await createCartFingerprint([
      { productId: 42, sku: 'SKU-42-B', quantity: 1, installOption: 'none' },
    ])

    expect(first).not.toBe(second)
  })
})
