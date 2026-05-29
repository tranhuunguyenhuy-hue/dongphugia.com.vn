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
    cartItemId: string
    installOption?: 'none' | 'install' | 'replace'
    installationFee?: number
    onlineDiscountAmount?: number
    finalPrice?: number
}

interface CartStore {
    items: CartItem[]
    isOpen: boolean

    // Actions
    addItem: (item: Omit<CartItem, 'quantity' | 'cartItemId'> & { quantity?: number }) => void
    removeItem: (cartItemId: string) => void
    updateQuantity: (cartItemId: string, qty: number) => void
    clearCart: () => void
    openCart: () => void
    closeCart: () => void
    toggleCart: () => void

    // Computed (via selectors below)
}

// ─── Store ────────────────────────────────────────────────────────────────────

import { trackAddToCart } from '@/lib/tracking'

export const useCartStore = create<CartStore>()(
    persist(
        (set, get) => ({
            items: [],
            isOpen: false,

            addItem: (item) => {
                const { quantity = 1, installOption = 'none', ...rest } = item
                const cartItemId = `${rest.productId}-${installOption}`
                
                // Track Add to Cart
                trackAddToCart({
                    item_id: rest.sku || rest.productId.toString(),
                    item_name: rest.name,
                    price: rest.price || 0,
                    quantity,
                    item_category: rest.categorySlug,
                    item_brand: rest.brandName || undefined,
                })

                set((state) => {
                    const existing = state.items.find(i => i.cartItemId === cartItemId)
                    if (existing) {
                        return {
                            items: state.items.map(i =>
                                i.cartItemId === cartItemId
                                    ? { ...i, quantity: Math.min(i.quantity + quantity, 99) }
                                    : i
                            ),
                            isOpen: true,
                        }
                    }
                    return {
                        items: [...state.items, { ...rest, quantity, installOption, cartItemId }],
                        isOpen: true,
                    }
                })
            },

            removeItem: (cartItemId) => {
                set((state) => ({
                    items: state.items.filter(i => i.cartItemId !== cartItemId),
                }))
            },

            updateQuantity: (cartItemId, qty) => {
                if (qty < 1) {
                    get().removeItem(cartItemId)
                    return
                }
                set((state) => ({
                    items: state.items.map(i =>
                        i.cartItemId === cartItemId
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
        state.items.reduce((sum, i) => sum + (i.finalPrice ?? i.price ?? 0) * i.quantity, 0)
    )

export const useCartHasPricedItems = () =>
    useCartStore((state) => state.items.some(i => (i.finalPrice !== undefined && i.finalPrice !== null ? i.finalPrice > 0 : (i.price !== null && i.price > 0))))
