'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CartItem {
    productId: number
    sku: string
    name: string
    slug: string
    categorySlug: string
    subcategorySlug?: string | null
    price: number | null
    priceDisplay: string | null
    imageUrl: string | null
    brandName?: string | null
    quantity: number
}

interface CartStore {
    items: CartItem[]
    isOpen: boolean

    // Actions
    addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void
    removeItem: (productId: number) => void
    updateQuantity: (productId: number, qty: number) => void
    clearCart: () => void
    openCart: () => void
    closeCart: () => void
    toggleCart: () => void

    // Computed (via selectors below)
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useCartStore = create<CartStore>()(
    persist(
        (set, get) => ({
            items: [],
            isOpen: false,

            addItem: (item) => {
                const { quantity = 1, ...rest } = item
                set((state) => {
                    const existing = state.items.find(i => i.productId === rest.productId)
                    if (existing) {
                        return {
                            items: state.items.map(i =>
                                i.productId === rest.productId
                                    ? { ...i, quantity: Math.min(i.quantity + quantity, 99) }
                                    : i
                            ),
                            isOpen: true,
                        }
                    }
                    return {
                        items: [...state.items, { ...rest, quantity }],
                        isOpen: true,
                    }
                })
            },

            removeItem: (productId) => {
                set((state) => ({
                    items: state.items.filter(i => i.productId !== productId),
                }))
            },

            updateQuantity: (productId, qty) => {
                if (qty < 1) {
                    get().removeItem(productId)
                    return
                }
                set((state) => ({
                    items: state.items.map(i =>
                        i.productId === productId
                            ? { ...i, quantity: Math.min(qty, 99) }
                            : i
                    ),
                }))
            },

            clearCart: () => set({ items: [] }),

            openCart: () => set({ isOpen: true }),
            closeCart: () => set({ isOpen: false }),
            toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),
        }),
        {
            name: 'dpg-cart',
            // Only persist items, not UI state
            partialize: (state) => ({ items: state.items }),
        }
    )
)

// ─── Selectors ────────────────────────────────────────────────────────────────

export const useCartCount = () =>
    useCartStore((state) => state.items.reduce((sum, i) => sum + i.quantity, 0))

export const useCartTotal = () =>
    useCartStore((state) =>
        state.items.reduce((sum, i) => sum + (i.price ?? 0) * i.quantity, 0)
    )

export const useCartHasPricedItems = () =>
    useCartStore((state) => state.items.some(i => i.price !== null && i.price > 0))
