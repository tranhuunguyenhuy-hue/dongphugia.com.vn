'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCartStore, useCartTotal, CartItem } from '@/lib/cart-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { formatPrice } from '@/lib/utils'
import { Minus, Plus, Trash2, Package2, ShoppingBag, ArrowLeft, Loader2 } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { toast } from 'sonner'

export default function CartPage() {
    const router = useRouter()
    const { items, removeItem, updateQuantity, clearCart } = useCartStore()
    const total = useCartTotal()

    const [isSubmitting, setIsSubmitting] = useState(false)
    const [form, setForm] = useState({
        customer_name: '',
        customer_phone: '',
        customer_email: '',
        customer_address: '',
        note: '',
    })

    const hasPricedItems = items.some(i => i.price !== null && i.price > 0)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (items.length === 0) return

        setIsSubmitting(true)
        try {
            const res = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, items }),
            })
            const data = await res.json()

            if (!res.ok) {
                toast.error(data.error ?? 'Đã có lỗi xảy ra. Vui lòng thử lại.')
                return
            }

            clearCart()
            router.push(`/dat-hang-thanh-cong?order=${data.order_number}`)
        } catch {
            toast.error('Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.')
        } finally {
            setIsSubmitting(false)
        }
    }

    if (items.length === 0) {
        return (
            <div className="max-w-[1280px] mx-auto px-5 lg:px-8 py-16 flex flex-col items-center gap-6 text-center">
                <div className="w-24 h-24 bg-neutral-100 rounded-full flex items-center justify-center">
                    <ShoppingBag className="w-10 h-10 text-neutral-300" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900">Giỏ hàng trống</h1>
                    <p className="text-neutral-500 mt-2">Hãy thêm sản phẩm vào giỏ hàng để tiến hành đặt hàng.</p>
                </div>
                <Link href="/">
                    <Button className="bg-[#2E7A96] hover:bg-[#25617a] text-white gap-2">
                        <ArrowLeft className="w-4 h-4" />
                        Tiếp tục mua hàng
                    </Button>
                </Link>
            </div>
        )
    }

    return (
        <div className="max-w-[1280px] mx-auto px-5 lg:px-8 py-10">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-neutral-500 mb-8">
                <Link href="/" className="hover:text-[#2E7A96]">Trang chủ</Link>
                <span>/</span>
                <span className="text-neutral-900 font-medium">Giỏ hàng</span>
            </div>

            <h1 className="text-3xl font-bold text-neutral-900 mb-8">
                Giỏ hàng
                <span className="ml-3 text-lg font-normal text-neutral-400">
                    ({items.reduce((s, i) => s + i.quantity, 0)} sản phẩm)
                </span>
            </h1>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">
                {/* Left: Items */}
                <div className="space-y-4">
                    {items.map((item) => (
                        <CartPageItem
                            key={item.productId}
                            item={item}
                            onRemove={() => removeItem(item.productId)}
                            onQtyChange={(qty) => updateQuantity(item.productId, qty)}
                        />
                    ))}

                    <div className="flex justify-between items-center pt-4">
                        <Link href="/" className="text-sm text-neutral-500 hover:text-[#2E7A96] flex items-center gap-1.5">
                            <ArrowLeft className="w-4 h-4" />
                            Tiếp tục mua hàng
                        </Link>
                        <button
                            onClick={clearCart}
                            className="text-sm text-red-400 hover:text-red-600 transition-colors"
                        >
                            Xóa toàn bộ
                        </button>
                    </div>
                </div>

                {/* Right: Order Summary + Form */}
                <div className="space-y-6">
                    {/* Summary */}
                    <div className="bg-neutral-50 rounded-2xl border border-neutral-200 p-6 space-y-4">
                        <h2 className="font-semibold text-neutral-900 text-lg">Tóm tắt đơn hàng</h2>

                        <div className="space-y-2 text-sm">
                            {items.map(item => (
                                <div key={item.productId} className="flex justify-between text-neutral-600">
                                    <span className="line-clamp-1 flex-1 mr-2">{item.name} × {item.quantity}</span>
                                    <span className="shrink-0 font-medium">
                                        {item.price ? formatPrice(item.price * item.quantity) : 'Liên hệ'}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="border-t border-neutral-200 pt-4 flex justify-between">
                            <span className="font-semibold text-neutral-900">Tổng cộng</span>
                            <span className="font-bold text-xl text-[#2E7A96]">
                                {hasPricedItems ? formatPrice(total) : 'Liên hệ'}
                            </span>
                        </div>

                        <p className="text-xs text-neutral-400">
                            Giá chưa bao gồm chi phí vận chuyển. Nhân viên sẽ liên hệ xác nhận đơn hàng.
                        </p>
                    </div>

                    {/* Customer Form */}
                    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-4">
                        <h2 className="font-semibold text-neutral-900 text-lg">Thông tin đặt hàng</h2>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-neutral-700">
                                Họ và tên <span className="text-red-500">*</span>
                            </label>
                            <Input
                                placeholder="Nguyễn Văn A"
                                required
                                value={form.customer_name}
                                onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                                className="h-11"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-neutral-700">
                                Số điện thoại <span className="text-red-500">*</span>
                            </label>
                            <Input
                                type="tel"
                                placeholder="09..."
                                required
                                value={form.customer_phone}
                                onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))}
                                className="h-11"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-neutral-700">Email</label>
                            <Input
                                type="email"
                                placeholder="email@example.com"
                                value={form.customer_email}
                                onChange={e => setForm(f => ({ ...f, customer_email: e.target.value }))}
                                className="h-11"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-neutral-700">Địa chỉ nhận hàng</label>
                            <Input
                                placeholder="Số nhà, đường, phường/xã, tỉnh/thành"
                                value={form.customer_address}
                                onChange={e => setForm(f => ({ ...f, customer_address: e.target.value }))}
                                className="h-11"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-neutral-700">Ghi chú</label>
                            <Textarea
                                placeholder="Yêu cầu đặc biệt, thời gian giao hàng..."
                                rows={3}
                                value={form.note}
                                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                                className="resize-none"
                            />
                        </div>

                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full h-12 bg-[#2E7A96] hover:bg-[#25617a] text-white font-semibold text-[15px] rounded-xl gap-2 mt-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Đang xử lý...
                                </>
                            ) : (
                                'Xác nhận đặt hàng'
                            )}
                        </Button>

                        <p className="text-xs text-center text-neutral-400">
                            Bằng cách đặt hàng, bạn đồng ý với chính sách của Đông Phú Gia.
                        </p>
                    </form>
                </div>
            </div>
        </div>
    )
}

// ─── CartPageItem ─────────────────────────────────────────────────────────────

function CartPageItem({ item, onRemove, onQtyChange }: {
    item: CartItem
    onRemove: () => void
    onQtyChange: (qty: number) => void
}) {
    return (
        <div className="flex gap-4 p-4 bg-white border border-neutral-200 rounded-2xl">
            <div className="w-20 h-20 rounded-xl border border-neutral-100 bg-neutral-50 overflow-hidden shrink-0">
                {item.imageUrl ? (
                    <Image src={item.imageUrl} alt={item.name} width={80} height={80} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Package2 className="w-7 h-7 text-neutral-300" />
                    </div>
                )}
            </div>

            <div className="flex-1 min-w-0">
                <p className="font-semibold text-neutral-900 line-clamp-2 text-sm leading-snug">{item.name}</p>
                {item.brandName && <p className="text-xs text-neutral-400 mt-0.5">{item.brandName}</p>}
                <p className="text-xs text-neutral-400 mt-0.5">SKU: {item.sku}</p>

                <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center border border-neutral-200 rounded-lg overflow-hidden h-9">
                        <button onClick={() => onQtyChange(item.quantity - 1)} className="w-9 h-full flex items-center justify-center bg-neutral-50 hover:bg-neutral-100 transition-colors">
                            <Minus className="w-3 h-3 text-neutral-600" />
                        </button>
                        <span className="w-10 text-center text-sm font-semibold border-x border-neutral-200">
                            {item.quantity}
                        </span>
                        <button onClick={() => onQtyChange(item.quantity + 1)} className="w-9 h-full flex items-center justify-center bg-neutral-50 hover:bg-neutral-100 transition-colors">
                            <Plus className="w-3 h-3 text-neutral-600" />
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="font-bold text-[#2E7A96]">
                            {item.price ? formatPrice(item.price * item.quantity) : 'Liên hệ'}
                        </span>
                        <button onClick={onRemove} className="w-8 h-8 flex items-center justify-center text-neutral-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
