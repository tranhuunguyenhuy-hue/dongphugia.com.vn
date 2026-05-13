'use client'

import { ShoppingCart } from 'lucide-react'
import { useCartStore, useCartCount } from '@/lib/cart-store'

export function CartIcon() {
    const count = useCartCount()
    const toggleCart = useCartStore((s) => s.toggleCart)

    return (
        <button
            onClick={toggleCart}
            aria-label={`Giỏ hàng${count > 0 ? ` (${count} sản phẩm)` : ''}`}
            className="relative flex items-center justify-center w-11 h-11 rounded-full hover:bg-stone-100 transition-colors shrink-0 text-stone-700 hover:text-brand-600"
        >
            <ShoppingCart className="w-[22px] h-[22px] text-current" strokeWidth={2} />
            {count > 0 && (
                <span className="absolute top-[4px] right-[2px] min-w-[18px] h-[18px] bg-brand-500 border-2 border-white text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none shadow-sm">
                    {count > 99 ? '99+' : count}
                </span>
            )}
        </button>
    )
}
