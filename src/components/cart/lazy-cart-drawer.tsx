'use client'

import dynamic from 'next/dynamic'
import { useCartStore } from '@/lib/cart-store'

const CartDrawer = dynamic(
    () => import('@/components/cart/cart-drawer').then((module) => module.CartDrawer),
    { ssr: false },
)

/**
 * The drawer is a sizeable interaction surface. Keep it out of the initial
 * route until the cart store requests it.
 */
export function LazyCartDrawer() {
    const isOpen = useCartStore((state) => state.isOpen)

    return isOpen ? <CartDrawer /> : null
}
