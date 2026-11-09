import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/tracking', () => ({ trackAddToCart: vi.fn() }))

import { useCartStore } from './cart-store'

const item = (sku: string) => ({
  productId: 42,
  sku,
  name: `Synthetic ${sku}`,
  slug: 'synthetic-product',
  categorySlug: 'synthetic-category',
  price: 120_000,
  priceDisplay: '120.000 đ',
  imageUrl: null,
  installOption: 'none' as const,
})

describe('cart exact SKU identity', () => {
  beforeEach(() => {
    localStorage.clear()
    useCartStore.setState({ items: [], isOpen: false })
  })

  it('keeps two exact SKUs of one Product as distinct lines', () => {
    useCartStore.getState().addItem(item('SKU-42-A'))
    useCartStore.getState().addItem(item('SKU-42-B'))

    expect(useCartStore.getState().items).toEqual([
      expect.objectContaining({ productId: 42, sku: 'SKU-42-A', quantity: 1 }),
      expect.objectContaining({ productId: 42, sku: 'SKU-42-B', quantity: 1 }),
    ])
  })
})
