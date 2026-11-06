'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { InstallOption } from '@/lib/order-pricing'
import { trackAddToCart } from '@/lib/tracking'

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
    installOption?: InstallOption
    installationFee?: number | null
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
            version: 2,
            migrate: (persistedState, version) => {
                if (version >= 2 || !persistedState || typeof persistedState !== 'object') return persistedState as CartStore
                const state = persistedState as { items?: CartItem[] }
                return {
                    ...state,
                    items: (state.items ?? []).map((item) => {
                        const basePrice = item.price
                        const discount = item.onlineDiscountAmount ?? 0
                        const validDiscount = Number.isFinite(discount) && discount > 0 && basePrice !== null && discount < basePrice
                            ? discount
                            : 0
                        return {
                            ...item,
                            installationFee: item.installOption === 'none' ? 0 : null,
                            finalPrice: basePrice === null ? undefined : basePrice - validDiscount,
                        }
                    }),
                } as CartStore
            },
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
        state.items.reduce((sum, i) => {
            const basePrice = i.price
            if (basePrice === null || !Number.isFinite(basePrice) || basePrice <= 0) return sum
            const discount = i.onlineDiscountAmount ?? 0
            const validDiscount = Number.isFinite(discount) && discount > 0 && discount < basePrice ? discount : 0
            return sum + (basePrice - validDiscount) * i.quantity
        }, 0)
    )

export const useCartHasPricedItems = () =>
    useCartStore((state) => state.items.some(i => i.price !== null && Number.isFinite(i.price) && i.price > 0))

export function getCartItemUnitPrice(item: Pick<CartItem, 'price' | 'onlineDiscountAmount'>): number | null {
    const basePrice = item.price
    if (basePrice === null || !Number.isFinite(basePrice) || basePrice <= 0) return null
    const discount = item.onlineDiscountAmount ?? 0
    const validDiscount = Number.isFinite(discount) && discount > 0 && discount < basePrice ? discount : 0
    return basePrice - validDiscount
}
