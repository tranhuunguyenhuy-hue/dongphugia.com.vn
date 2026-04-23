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
            className="relative flex items-center justify-center w-11 h-11 rounded-[12px] border border-[#3C8A9E]/60 hover:bg-brand-50 transition-colors shrink-0"
        >
            <ShoppingCart className="w-[20px] h-[20px] text-brand-600" strokeWidth={2.25} />
            {count > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] bg-brand-600 border-2 border-white text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none shadow-sm">
                    {count > 99 ? '99+' : count}
                </span>
            )}
        </button>
    )
}
