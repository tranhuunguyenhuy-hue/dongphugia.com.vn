import { getAdminOrderById } from '@/lib/order-actions'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Package, User, Phone, Mail, MapPin, FileText, CreditCard, Truck, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { OrderStatusSelect } from '../order-status-select'
import { OrderPaymentSelect } from '../order-payment-select'

export const dynamic = 'force-dynamic'

interface PageProps {
    params: Promise<{ id: string }>
}

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
    pending: { label: 'Chờ xác nhận', color: 'bg-amber-100 text-amber-700 border border-amber-200', dot: 'bg-amber-400' },
    confirmed: { label: 'Đã xác nhận', color: 'bg-blue-100 text-blue-700 border border-blue-200', dot: 'bg-blue-400' },
    processing: { label: 'Đang xử lý', color: 'bg-purple-100 text-purple-700 border border-purple-200', dot: 'bg-purple-400' },
    shipping: { label: 'Đang giao', color: 'bg-indigo-100 text-indigo-700 border border-indigo-200', dot: 'bg-indigo-400' },
    delivered: { label: 'Đã giao', color: 'bg-emerald-100 text-emerald-700 border border-emerald-200', dot: 'bg-emerald-400' },
    cancelled: { label: 'Đã hủy', color: 'bg-red-100 text-red-600 border border-red-200', dot: 'bg-red-400' },
}

const paymentConfig: Record<string, { label: string; color: string }> = {
    unpaid: { label: 'Chưa thanh toán', color: 'bg-orange-100 text-orange-700 border border-orange-200' },
    paid: { label: 'Đã thanh toán', color: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
    refunded: { label: 'Đã hoàn tiền', color: 'bg-neutral-100 text-neutral-600 border border-neutral-200' },
}

function formatVND(amount: number) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
}

export default async function AdminOrderDetailPage({ params }: PageProps) {
    const { id } = await params
    const orderId = Number(id)
    if (isNaN(orderId)) notFound()

    const order = await getAdminOrderById(orderId)
    if (!order) notFound()

    const status = statusConfig[order.status] || { label: order.status, color: 'bg-neutral-100 text-neutral-600', dot: 'bg-neutral-400' }
    const payment = paymentConfig[order.payment_status] || { label: order.payment_status, color: 'bg-neutral-100' }

    const createdAt = new Date(order.created_at)

    return (
        <div className="space-y-6 max-w-5xl">
            {/* Back + Header */}
            <div className="flex items-start gap-4">
                <Link href="/admin/orders" className="mt-1 p-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 transition-colors">
                    <ArrowLeft className="w-4 h-4 text-stone-600" />
                </Link>
                <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="text-xl font-bold tracking-tight font-mono text-stone-900">{order.order_number}</h1>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${status.color}`}>
                            {status.label}
                        </span>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${payment.color}`}>
                            {payment.label}
                        </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Đặt lúc {createdAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ngày {createdAt.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Left: Products + Summary */}
                <div className="lg:col-span-2 space-y-5">
                    {/* Product List */}
                    <Card className="border border-stone-200/60 shadow-sm">
                        <CardHeader className="pb-3 border-b border-stone-100">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <Package className="w-4 h-4 text-stone-500" />
                                Sản phẩm đặt mua ({order.order_items.length} sản phẩm)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-stone-100">
                                {order.order_items.map((item: any, idx: number) => (
                                    <div key={item.id} className="flex items-start gap-4 p-4 hover:bg-stone-50/50 transition-colors">
                                        {/* Index */}
                                        <div className="w-7 h-7 rounded-full bg-stone-100 text-stone-500 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                                            {idx + 1}
                                        </div>

                                        {/* Product thumbnail from DB */}
                                        {(item as any).products?.image_main_url ? (
                                            <div className="w-14 h-14 rounded-lg border border-stone-200 overflow-hidden shrink-0 bg-stone-50">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={(item as any).products.image_main_url}
                                                    alt={item.product_name}
                                                    className="w-full h-full object-contain p-1"
                                                />
                                            </div>
                                        ) : (
                                            <div className="w-14 h-14 rounded-lg border border-stone-200 bg-stone-100 flex items-center justify-center shrink-0">
                                                <Package className="w-6 h-6 text-stone-400" />
                                            </div>
                                        )}

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-stone-800 leading-snug">{item.product_name}</p>
                                            <p className="text-xs text-stone-400 mt-0.5">SKU: {item.product_sku}</p>
                                            <div className="flex items-center gap-3 mt-1.5 text-xs text-stone-500">
                                                <span>Số lượng: <strong className="text-stone-800">{item.quantity}</strong></span>
                                                {item.unit_price > 0 && (
                                                    <span>Đơn giá: <strong className="text-stone-800">{formatVND(item.unit_price)}</strong></span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Total */}
                                        <div className="text-right shrink-0">
                                            {item.total_price > 0 ? (
                                                <p className="text-sm font-bold text-stone-900">{formatVND(item.total_price)}</p>
                                            ) : (
                                                <p className="text-xs text-stone-400 italic">Báo giá</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Order Summary */}
                            <div className="border-t border-stone-100 bg-stone-50/50 p-4 space-y-2">
                                <div className="flex justify-between text-sm text-stone-600">
                                    <span>Tạm tính</span>
                                    <span>{formatVND(order.subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-sm text-stone-600">
                                    <span>Phí vận chuyển</span>
                                    <span className="text-emerald-600 font-medium">
                                        {order.shipping_fee > 0 ? formatVND(order.shipping_fee) : 'Miễn phí'}
                                    </span>
                                </div>
                                <div className="flex justify-between text-base font-bold text-stone-900 pt-2 border-t border-stone-200">
                                    <span>Tổng cộng</span>
                                    <span className="text-[#2E7A96]">{formatVND(order.total)}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Note */}
                    {order.note && (
                        <Card className="border border-amber-200/70 bg-amber-50/50 shadow-sm">
                            <CardContent className="p-4 flex items-start gap-3">
                                <FileText className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-xs font-semibold text-amber-700 mb-1">Ghi chú của khách</p>
                                    <p className="text-sm text-stone-700 leading-relaxed">{order.note}</p>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Right: Customer Info + Actions */}
                <div className="space-y-4">
                    {/* Customer Info */}
                    <Card className="border border-stone-200/60 shadow-sm">
                        <CardHeader className="pb-3 border-b border-stone-100">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-stone-700">
                                <User className="w-4 h-4" />
                                Thông tin khách hàng
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3">
                            <div className="flex items-center gap-2.5">
                                <User className="w-4 h-4 text-stone-400 shrink-0" />
                                <div>
                                    <p className="text-[11px] text-stone-400">Họ tên</p>
                                    <p className="text-sm font-semibold text-stone-800">{order.customer_name}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2.5">
                                <Phone className="w-4 h-4 text-stone-400 shrink-0" />
                                <div>
                                    <p className="text-[11px] text-stone-400">Điện thoại</p>
                                    <a href={`tel:${order.customer_phone}`} className="text-sm font-semibold text-[#2E7A96] hover:underline">
                                        {order.customer_phone}
                                    </a>
                                </div>
                            </div>
                            {order.customer_email && (
                                <div className="flex items-center gap-2.5">
                                    <Mail className="w-4 h-4 text-stone-400 shrink-0" />
                                    <div>
                                        <p className="text-[11px] text-stone-400">Email</p>
                                        <a href={`mailto:${order.customer_email}`} className="text-sm text-[#2E7A96] hover:underline break-all">
                                            {order.customer_email}
                                        </a>
                                    </div>
                                </div>
                            )}
                            {order.customer_address && (
                                <div className="flex items-start gap-2.5">
                                    <MapPin className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-[11px] text-stone-400">Địa chỉ</p>
                                        <p className="text-sm text-stone-700 leading-snug">{order.customer_address}</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Payment Info */}
                    <Card className="border border-stone-200/60 shadow-sm">
                        <CardHeader className="pb-3 border-b border-stone-100">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-stone-700">
                                <CreditCard className="w-4 h-4" />
                                Thanh toán
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3">
                            {order.payment_method && (
                                <div>
                                    <p className="text-[11px] text-stone-400">Phương thức</p>
                                    <p className="text-sm font-medium text-stone-800 mt-0.5">{order.payment_method}</p>
                                </div>
                            )}
                            <div>
                                <p className="text-[11px] text-stone-400 mb-1.5">Trạng thái thanh toán</p>
                                <OrderPaymentSelect id={order.id} currentPaymentStatus={order.payment_status} />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Order Status Management */}
                    <Card className="border border-stone-200/60 shadow-sm">
                        <CardHeader className="pb-3 border-b border-stone-100">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-stone-700">
                                <Truck className="w-4 h-4" />
                                Trạng thái đơn hàng
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4">
                            <OrderStatusSelect id={order.id} currentStatus={order.status} />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
