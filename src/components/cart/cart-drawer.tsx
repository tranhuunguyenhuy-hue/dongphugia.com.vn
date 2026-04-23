'use client'

import { useCartStore, useCartTotal, CartItem } from '@/lib/cart-store'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Minus, Plus, Trash2, ShoppingCart, ArrowRight, Package2 } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils'

export function CartDrawer() {
    const { items, isOpen, closeCart, removeItem, updateQuantity } = useCartStore()
    const total = useCartTotal()

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && closeCart()}>
            <SheetContent
                side="right"
                className="w-full sm:max-w-[420px] flex flex-col p-0 bg-white"
            >
                {/* Header */}
                <SheetHeader className="px-6 py-5 border-b border-neutral-100">
                    <SheetTitle className="flex items-center gap-2 text-neutral-900 text-lg font-bold">
                        <ShoppingCart className="w-5 h-5 text-[#2E7A96]" />
                        Giỏ hàng
                        {items.length > 0 && (
                            <span className="ml-auto text-sm font-normal text-neutral-500">
                                {items.reduce((s, i) => s + i.quantity, 0)} sản phẩm
                            </span>
                        )}
                    </SheetTitle>
                </SheetHeader>

                {/* Content */}
                {items.length === 0 ? (
                    <EmptyCart onClose={closeCart} />
                ) : (
                    <>
                        {/* Item List */}
                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                            {items.map((item) => (
                                <CartItemRow
                                    key={item.productId}
                                    item={item}
                                    onRemove={() => removeItem(item.productId)}
                                    onQtyChange={(qty) => updateQuantity(item.productId, qty)}
                                />
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="border-t border-neutral-100 px-6 py-5 space-y-4 bg-neutral-50/50">
                            {total > 0 && (
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-neutral-600">Tạm tính</span>
                                    <span className="text-lg font-bold text-[#2E7A96]">
                                        {formatPrice(total)}
                                    </span>
                                </div>
                            )}
                            <Link href="/gio-hang" onClick={closeCart}>
                                <Button className="w-full h-12 bg-[#2E7A96] hover:bg-[#25617a] text-white font-semibold text-[15px] rounded-xl gap-2">
                                    Tiến hành đặt hàng
                                    <ArrowRight className="w-4 h-4" />
                                </Button>
                            </Link>
                            <Button
                                variant="ghost"
                                className="w-full h-10 text-neutral-500 text-sm"
                                onClick={closeCart}
                            >
                                Tiếp tục mua hàng
                            </Button>
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>
    )
}

// ─── CartItemRow ─────────────────────────────────────────────────────────────

function CartItemRow({
    item,
    onRemove,
    onQtyChange,
}: {
    item: CartItem
    onRemove: () => void
    onQtyChange: (qty: number) => void
}) {
    const lineTotal = item.price ? item.price * item.quantity : null

    return (
        <div className="flex gap-3 py-3 border-b border-neutral-100 last:border-0">
            {/* Image */}
            <div className="w-16 h-16 rounded-lg border border-neutral-100 bg-neutral-50 overflow-hidden shrink-0">
                {item.imageUrl ? (
                    <Image
                        src={item.imageUrl}
                        alt={item.name}
                        width={64}
                        height={64}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Package2 className="w-6 h-6 text-neutral-300" />
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-900 line-clamp-2 leading-snug">
                    {item.name}
                </p>
                {item.brandName && (
                    <p className="text-xs text-neutral-400 mt-0.5">{item.brandName}</p>
                )}

                <div className="flex items-center justify-between mt-2">
                    {/* Qty control */}
                    <div className="flex items-center border border-neutral-200 rounded-lg overflow-hidden h-8">
                        <button
                            onClick={() => onQtyChange(item.quantity - 1)}
                            className="w-8 h-full flex items-center justify-center bg-neutral-50 hover:bg-neutral-100 text-neutral-600 transition-colors"
                        >
                            <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-9 text-center text-sm font-semibold text-neutral-900 border-x border-neutral-200">
                            {item.quantity}
                        </span>
                        <button
                            onClick={() => onQtyChange(item.quantity + 1)}
                            className="w-8 h-full flex items-center justify-center bg-neutral-50 hover:bg-neutral-100 text-neutral-600 transition-colors"
                        >
                            <Plus className="w-3 h-3" />
                        </button>
                    </div>

                    {/* Price */}
                    <span className="text-sm font-semibold text-[#2E7A96]">
                        {lineTotal ? formatPrice(lineTotal) : item.priceDisplay ?? 'Liên hệ'}
                    </span>
                </div>
            </div>

            {/* Remove */}
            <button
                onClick={onRemove}
                className="shrink-0 w-7 h-7 flex items-center justify-center text-neutral-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
            >
                <Trash2 className="w-3.5 h-3.5" />
            </button>
        </div>
    )
}

// ─── EmptyCart ────────────────────────────────────────────────────────────────

function EmptyCart({ onClose }: { onClose: () => void }) {
    return (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center">
            <div className="w-20 h-20 bg-neutral-100 rounded-full flex items-center justify-center">
                <ShoppingCart className="w-8 h-8 text-neutral-300" />
            </div>
            <div>
                <p className="font-semibold text-neutral-800">Giỏ hàng trống</p>
                <p className="text-sm text-neutral-500 mt-1">
                    Thêm sản phẩm vào giỏ hàng để tiến hành đặt hàng
                </p>
            </div>
            <Button
                onClick={onClose}
                variant="outline"
                className="mt-2 border-[#2E7A96] text-[#2E7A96] hover:bg-[#2E7A96] hover:text-white"
            >
                Tiếp tục mua hàng
            </Button>
        </div>
    )
}
