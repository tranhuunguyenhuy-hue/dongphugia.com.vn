'use client'

import { useRef, useState } from 'react'
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
import { trackGenerateLead } from '@/lib/tracking'

const VIETNAM_MOBILE_PATTERN = /^(?:\+84|0)(?:3|5|7|8|9)\d{8}$/

export default function CartPage() {
    const router = useRouter()
    const { items, removeItem, updateQuantity, clearCart } = useCartStore()
    const total = useCartTotal()
    const idempotencyRef = useRef<{ cartFingerprint: string; key: string } | null>(null)

    const [isSubmitting, setIsSubmitting] = useState(false)
    const [form, setForm] = useState({
        customer_name: '',
        customer_phone: '',
        customer_email: '',
        customer_address: '',
        note: '',
    })

    const hasOnlyPricedItems = items.every(i => (i.finalPrice ?? i.price ?? 0) > 0)
    const normalizedPhone = form.customer_phone.replace(/[\s().-]/g, '')
    const phoneIsInvalid = form.customer_phone.length > 0 && !VIETNAM_MOBILE_PATTERN.test(normalizedPhone)

    const handleClearCart = () => {
        if (window.confirm('Xóa toàn bộ sản phẩm khỏi giỏ hàng?')) {
            clearCart()
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (items.length === 0) return
        if (!VIETNAM_MOBILE_PATTERN.test(normalizedPhone)) {
            toast.error('Vui lòng nhập số điện thoại Việt Nam hợp lệ.')
            return
        }

        setIsSubmitting(true)
        try {
            const input = {
                ...form,
                customer_phone: normalizedPhone,
                items: items.map(item => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    installOption: item.installOption ?? 'none',
                })),
            }
            // Persist only a random key and a hash of cart IDs/quantities. Do not
            // store the customer form or a fingerprint containing PII.
            const cartFingerprint = await createCartFingerprint(input.items)
            const idempotencyKey = getOrCreateOrderRequestKey(cartFingerprint, idempotencyRef.current)
            idempotencyRef.current = { cartFingerprint, key: idempotencyKey }

            const res = await fetch('/api/order-requests', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Idempotency-Key': idempotencyKey,
                },
                body: JSON.stringify(input),
            })
            const data: unknown = await res.json().catch(() => null)

            if (!res.ok) {
                const code = data && typeof data === 'object' && 'error' in data
                    && data.error && typeof data.error === 'object' && 'code' in data.error
                    && typeof data.error.code === 'string'
                    ? data.error.code
                    : ''
                const message = code === 'PRODUCT_UNAVAILABLE'
                    ? 'Một sản phẩm trong giỏ không còn khả dụng. Vui lòng kiểm tra lại.'
                    : code === 'PRODUCT_REQUIRES_QUOTE'
                        ? 'Một sản phẩm cần được báo giá riêng. Vui lòng xóa sản phẩm đó hoặc liên hệ tư vấn.'
                        : code === 'ORDER_RATE_LIMITED'
                            ? 'Bạn vừa gửi nhiều yêu cầu. Vui lòng đợi một chút rồi thử lại.'
                            : code === 'ORDER_INTAKE_UNAVAILABLE'
                                ? 'Chức năng nhận yêu cầu đang tạm thời gián đoạn. Giỏ hàng của bạn vẫn được giữ lại.'
                                : code === 'IDEMPOTENCY_KEY_REUSED'
                                    ? 'Yêu cầu này đã được gửi trước đó với thông tin khác. Nếu bạn muốn tạo yêu cầu mới, hãy kiểm tra lại rồi bấm gửi thêm một lần nữa.'
                                : 'Chưa gửi được yêu cầu. Vui lòng kiểm tra thông tin và thử lại.'
                if (code === 'IDEMPOTENCY_KEY_REUSED') {
                    clearOrderRequestKey(cartFingerprint, idempotencyKey)
                    idempotencyRef.current = null
                }
                toast.error(message)
                return
            }

            const orderNumber = data && typeof data === 'object' && 'data' in data
                && data.data && typeof data.data === 'object' && 'order_number' in data.data
                && typeof data.data.order_number === 'string'
                ? data.data.order_number
                : null
            if (!orderNumber) {
                toast.error('Chưa xác nhận được mã tiếp nhận. Giỏ hàng của bạn vẫn được giữ lại.')
                return
            }

            // A submitted request is not a confirmed purchase.
            trackGenerateLead('order_request_submit')

            clearOrderRequestKey(cartFingerprint, idempotencyKey)
            idempotencyRef.current = null
            clearCart()
            router.push(`/dat-hang-thanh-cong?order=${encodeURIComponent(orderNumber)}`)
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
                            key={item.cartItemId}
                            item={item}
                            onRemove={() => removeItem(item.cartItemId)}
                            onQtyChange={(qty) => updateQuantity(item.cartItemId, qty)}
                        />
                    ))}

                    <div className="flex justify-between items-center pt-4">
                        <Link href="/" className="text-sm text-neutral-500 hover:text-[#2E7A96] flex items-center gap-1.5">
                            <ArrowLeft className="w-4 h-4" />
                            Tiếp tục mua hàng
                        </Link>
                        <button
                            onClick={handleClearCart}
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
                            {items.map(item => {
                                const finalItemPrice = item.finalPrice ?? item.price;
                                return (
                                    <div key={item.cartItemId} className="flex flex-col mb-2 last:mb-0">
                                        <div className="flex justify-between text-neutral-600">
                                            <span className="line-clamp-1 flex-1 mr-2">{item.name} × {item.quantity}</span>
                                            <span className="shrink-0 font-medium">
                                                {finalItemPrice ? formatPrice(finalItemPrice * item.quantity) : 'Liên hệ'}
                                            </span>
                                        </div>
                                        {(item.installOption === 'install' || item.installOption === 'replace' || (item.onlineDiscountAmount || 0) > 0) && (
                                            <div className="text-[11px] text-neutral-400 pl-2">
                                                {item.installOption === 'install' && <span>+ Lắp đặt</span>}
                                                {item.installOption === 'replace' && <span>+ Tháo dỡ & Lắp đặt</span>}
                                                {(item.onlineDiscountAmount || 0) > 0 && <span>, có ưu đãi online tham khảo</span>}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        <div className="border-t border-neutral-200 pt-4 flex justify-between">
                            <span className="font-semibold text-neutral-900">Tạm tính tham khảo</span>
                            <span className="font-bold text-xl text-[#2E7A96]">
                                {hasOnlyPricedItems ? formatPrice(total) : 'Liên hệ báo giá'}
                            </span>
                        </div>

                        <p className="text-xs text-neutral-400">
                            Giá chưa gồm vận chuyển. Đây mới là yêu cầu đặt hàng; nhân viên sẽ xác nhận giá và tồn kho trước khi chốt. Bạn chưa phải thanh toán lúc gửi yêu cầu.
                        </p>
                    </div>

                    {/* Customer Form */}
                    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-4">
                        <h2 className="font-semibold text-neutral-900 text-lg">Gửi yêu cầu đặt hàng</h2>

                        <div className="space-y-1">
                            <label htmlFor="customer-name" className="text-sm font-medium text-neutral-700">
                                Họ và tên <span className="text-red-500">*</span>
                            </label>
                            <Input
                                id="customer-name"
                                autoComplete="name"
                                placeholder="Nguyễn Văn A"
                                required
                                value={form.customer_name}
                                onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                                className="h-11"
                            />
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="customer-phone" className="text-sm font-medium text-neutral-700">
                                Số điện thoại <span className="text-red-500">*</span>
                            </label>
                            <Input
                                id="customer-phone"
                                type="tel"
                                inputMode="tel"
                                autoComplete="tel"
                                placeholder="0912 345 678"
                                required
                                value={form.customer_phone}
                                onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))}
                                aria-invalid={phoneIsInvalid}
                                aria-describedby={phoneIsInvalid ? 'customer-phone-error' : undefined}
                                className="h-11"
                            />
                            {phoneIsInvalid && (
                                <p id="customer-phone-error" className="text-xs text-red-600" role="alert">
                                    Nhập số di động Việt Nam gồm 10 số, ví dụ 0912 345 678.
                                </p>
                            )}
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
                            disabled={isSubmitting || phoneIsInvalid}
                            className="w-full h-12 bg-[#2E7A96] hover:bg-[#25617a] text-white font-semibold text-[15px] rounded-xl gap-2 mt-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Đang xử lý...
                                </>
                            ) : (
                                'Gửi yêu cầu đặt hàng'
                            )}
                        </Button>

                        <p className="text-xs text-center text-neutral-500">
                            Bằng cách đặt hàng, bạn đồng ý với{' '}
                            <Link href="/chinh-sach-bao-mat" className="underline hover:text-[#2E7A96]">chính sách bảo mật</Link>
                            {' '}và{' '}
                            <Link href="/dieu-kien-giao-dich" className="underline hover:text-[#2E7A96]">điều kiện giao dịch</Link>.
                        </p>
                    </form>
                </div>
            </div>
        </div>
    )
}

const ORDER_REQUEST_STORAGE_KEY = 'dpg-order-request-idempotency-v1'

async function createCartFingerprint(items: Array<{ productId: number; quantity: number; installOption?: string }>) {
    const canonicalItems = items.map(({ productId, quantity, installOption }) => ({
        productId,
        quantity,
        installOption: installOption ?? 'none',
    }))
    const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(canonicalItems)))
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

function getOrCreateOrderRequestKey(
    cartFingerprint: string,
    current: { cartFingerprint: string; key: string } | null,
) {
    try {
        if (current?.cartFingerprint === cartFingerprint) return current.key
        const stored = localStorage.getItem(ORDER_REQUEST_STORAGE_KEY)
        if (stored) {
            const value: unknown = JSON.parse(stored)
            if (value && typeof value === 'object' && 'cartFingerprint' in value && 'key' in value
                && value.cartFingerprint === cartFingerprint && typeof value.key === 'string'
                && /^[a-f0-9-]{36}$/i.test(value.key)) return value.key
        }
    } catch { /* A storage failure falls back to an in-memory request key. */ }

    const key = window.crypto.randomUUID()
    try {
        localStorage.setItem(ORDER_REQUEST_STORAGE_KEY, JSON.stringify({ cartFingerprint, key }))
    } catch { /* The server still enforces idempotency for retries on this page. */ }
    return key
}

function clearOrderRequestKey(cartFingerprint: string, key: string) {
    try {
        const stored = localStorage.getItem(ORDER_REQUEST_STORAGE_KEY)
        if (!stored) return
        const value: unknown = JSON.parse(stored)
        if (value && typeof value === 'object' && 'cartFingerprint' in value && 'key' in value
            && value.cartFingerprint === cartFingerprint && value.key === key) {
            localStorage.removeItem(ORDER_REQUEST_STORAGE_KEY)
        }
    } catch { /* Storage cleanup is best effort; the order endpoint remains authoritative. */ }
}

// ─── CartPageItem ─────────────────────────────────────────────────────────────

function CartPageItem({ item, onRemove, onQtyChange }: {
    item: CartItem
    onRemove: () => void
    onQtyChange: (qty: number) => void
}) {
    const finalItemPrice = item.finalPrice ?? item.price;
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
                
                {/* Options display */}
                <div className="flex flex-col gap-0.5 mt-1.5">
                    {item.installOption === 'install' && (
                        <p className="text-[12px] text-sky-600 font-medium">+ Lắp đặt: {formatPrice(item.installationFee || 0)}</p>
                    )}
                    {item.installOption === 'replace' && (
                        <p className="text-[12px] text-sky-600 font-medium">+ Tháo dỡ & Lắp đặt: {formatPrice(item.installationFee || 0)}</p>
                    )}
                    {(item.onlineDiscountAmount || 0) > 0 && (
                        <p className="text-[12px] text-emerald-600 font-medium">Ưu đãi online tham khảo: {formatPrice(item.onlineDiscountAmount || 0)}</p>
                    )}
                </div>

                <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center border border-neutral-200 rounded-lg overflow-hidden h-9">
                        <button
                            type="button"
                            onClick={() => onQtyChange(item.quantity - 1)}
                            aria-label={`Giảm số lượng ${item.name}`}
                            className="w-9 h-full flex items-center justify-center bg-neutral-50 hover:bg-neutral-100 transition-colors"
                        >
                            <Minus className="w-3 h-3 text-neutral-600" />
                        </button>
                        <span className="w-10 text-center text-sm font-semibold border-x border-neutral-200">
                            {item.quantity}
                        </span>
                        <button
                            type="button"
                            onClick={() => onQtyChange(item.quantity + 1)}
                            aria-label={`Tăng số lượng ${item.name}`}
                            className="w-9 h-full flex items-center justify-center bg-neutral-50 hover:bg-neutral-100 transition-colors"
                        >
                            <Plus className="w-3 h-3 text-neutral-600" />
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="font-bold text-[#2E7A96]">
                            {finalItemPrice ? formatPrice(finalItemPrice * item.quantity) : 'Liên hệ'}
                        </span>
                        <button
                            type="button"
                            onClick={onRemove}
                            aria-label={`Xóa ${item.name} khỏi giỏ hàng`}
                            className="w-8 h-8 flex items-center justify-center text-neutral-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
