import { getAdminOrders, getOrderStats } from '@/lib/order-actions'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { ShoppingBag, Clock, Truck, CheckCircle, TrendingUp, Eye, Package } from 'lucide-react'
import { OrderStatusSelect } from './order-status-select'

export const dynamic = 'force-dynamic'

interface PageProps {
    searchParams: Promise<{ status?: string; payment_status?: string; search?: string; page?: string }>
}

const statusConfig: Record<string, { label: string; color: string }> = {
    pending: { label: 'Chờ xác nhận', color: 'bg-amber-100 text-amber-700 border border-amber-200' },
    confirmed: { label: 'Đã xác nhận', color: 'bg-blue-100 text-blue-700 border border-blue-200' },
    processing: { label: 'Đang xử lý', color: 'bg-purple-100 text-purple-700 border border-purple-200' },
    shipping: { label: 'Đang giao', color: 'bg-indigo-100 text-indigo-700 border border-indigo-200' },
    delivered: { label: 'Đã giao', color: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
    cancelled: { label: 'Đã hủy', color: 'bg-red-100 text-red-600 border border-red-200' },
}

const paymentConfig: Record<string, { label: string; color: string }> = {
    unpaid: { label: 'Chưa TT', color: 'bg-orange-100 text-orange-700' },
    paid: { label: 'Đã TT', color: 'bg-emerald-100 text-emerald-700' },
    refunded: { label: 'Hoàn tiền', color: 'bg-neutral-100 text-neutral-600' },
}

function formatVND(amount: number) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
}

const STATUS_FILTERS = [
    { label: 'Tất cả', value: '' },
    { label: 'Chờ xác nhận', value: 'pending' },
    { label: 'Đã xác nhận', value: 'confirmed' },
    { label: 'Đang xử lý', value: 'processing' },
    { label: 'Đang giao', value: 'shipping' },
    { label: 'Đã giao', value: 'delivered' },
    { label: 'Đã hủy', value: 'cancelled' },
]

export default async function AdminOrdersPage({ searchParams }: PageProps) {
    const params = await searchParams
    const page = Number(params.page || 1)
    const activeStatus = params.status || ''

    const [{ orders, total, totalPages }, stats] = await Promise.all([
        getAdminOrders({ status: params.status, payment_status: params.payment_status, search: params.search, page, pageSize: 25 }),
        getOrderStats(),
    ])

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Đơn hàng</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Quản lý và theo dõi đơn hàng của khách — {total} đơn hàng
                    </p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Tổng đơn', value: stats.total, icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Chờ xử lý', value: stats.pending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: 'Đang giao', value: stats.processing, icon: Truck, color: 'text-purple-600', bg: 'bg-purple-50' },
                    { label: 'Đã giao', value: stats.delivered, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                ].map(({ label, value, icon: Icon, color, bg }) => (
                    <Card key={label} className="border-none shadow-sm">
                        <CardContent className="p-5 flex items-center gap-4">
                            <div className={`p-2.5 rounded-full ${bg}`}>
                                <Icon className={`h-5 w-5 ${color}`} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{value.toLocaleString()}</p>
                                <p className="text-xs text-muted-foreground">{label}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Revenue highlight */}
            {stats.revenue > 0 && (
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/60 rounded-xl p-5 flex items-center gap-4">
                    <div className="p-3 bg-emerald-100 rounded-full">
                        <TrendingUp className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-sm text-emerald-700">Doanh thu (đơn đã giao &amp; thanh toán)</p>
                        <p className="text-2xl font-bold text-emerald-800">{formatVND(stats.revenue)}</p>
                    </div>
                </div>
            )}

            {/* Status Filter Tabs */}
            <div className="flex gap-1.5 flex-wrap">
                {STATUS_FILTERS.map(({ label, value }) => {
                    const isActive = activeStatus === value
                    const href = value ? `/admin/orders?status=${value}` : '/admin/orders'
                    return (
                        <Link key={value} href={href}>
                            <span className={`
                                inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-all
                                ${isActive
                                    ? 'bg-stone-900 text-white shadow-sm'
                                    : 'bg-white text-stone-600 border border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                                }
                            `}>
                                {label}
                            </span>
                        </Link>
                    )
                })}
            </div>

            {/* Table */}
            <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-neutral-50 hover:bg-neutral-50">
                            <TableHead className="font-semibold text-stone-700 w-[140px]">Mã đơn</TableHead>
                            <TableHead className="font-semibold text-stone-700">Khách hàng</TableHead>
                            <TableHead className="font-semibold text-stone-700 min-w-[220px]">Sản phẩm</TableHead>
                            <TableHead className="font-semibold text-stone-700 text-right">Tổng tiền</TableHead>
                            <TableHead className="font-semibold text-stone-700">Trạng thái</TableHead>
                            <TableHead className="font-semibold text-stone-700">Thanh toán</TableHead>
                            <TableHead className="font-semibold text-stone-700">Ngày đặt</TableHead>
                            <TableHead className="font-semibold text-stone-700 w-[150px]">Cập nhật</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orders.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                                    <ShoppingBag className="h-10 w-10 mx-auto mb-3 opacity-30" />
                                    Chưa có đơn hàng nào
                                </TableCell>
                            </TableRow>
                        ) : (orders as any[]).map(order => {
                            const status = statusConfig[order.status] || { label: order.status, color: 'bg-neutral-100 text-neutral-600' }
                            const payment = paymentConfig[order.payment_status] || { label: order.payment_status, color: 'bg-neutral-100' }
                            const totalItems = order._count?.order_items || 0
                            const previewItems: any[] = order.order_items || []

                            return (
                                <TableRow key={order.id} className="hover:bg-neutral-50/60 align-top">
                                    <TableCell className="pt-4">
                                        <div className="flex flex-col gap-1">
                                            <Link href={`/admin/orders/${order.id}`} className="font-mono text-xs font-bold text-[#2E7A96] hover:underline">
                                                {order.order_number}
                                            </Link>
                                            <Link href={`/admin/orders/${order.id}`} className="inline-flex items-center gap-1 text-[11px] text-stone-400 hover:text-stone-600 transition-colors">
                                                <Eye className="w-3 h-3" />
                                                Chi tiết
                                            </Link>
                                        </div>
                                    </TableCell>
                                    <TableCell className="pt-4">
                                        <p className="text-sm font-semibold text-stone-800">{order.customer_name}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">{order.customer_phone}</p>
                                        {order.note && (
                                            <p className="text-[11px] text-amber-600 mt-1 italic truncate max-w-[150px]" title={order.note}>
                                                Ghi chú: {order.note}
                                            </p>
                                        )}
                                    </TableCell>
                                    <TableCell className="pt-3">
                                        {previewItems.length > 0 ? (
                                            <div className="flex flex-col gap-1.5">
                                                {previewItems.map((item: any) => (
                                                    <div key={item.id} className="flex items-start gap-2 text-xs">
                                                        <Package className="w-3.5 h-3.5 text-stone-400 mt-0.5 shrink-0" />
                                                        <div className="min-w-0">
                                                            <p className="font-medium text-stone-700 leading-snug line-clamp-1">{item.product_name}</p>
                                                            <p className="text-stone-400">
                                                                SKU: {item.product_sku} · x{item.quantity}
                                                                {item.unit_price > 0 && ` · ${formatVND(item.unit_price)}`}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                                {totalItems > 3 && (
                                                    <p className="text-[11px] text-stone-400 pl-5">+{totalItems - 3} sản phẩm khác</p>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">{totalItems} sản phẩm</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="pt-4 text-right">
                                        <span className="text-sm font-bold text-stone-900">
                                            {formatVND(order.total)}
                                        </span>
                                    </TableCell>
                                    <TableCell className="pt-4">
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.color}`}>
                                            {status.label}
                                        </span>
                                    </TableCell>
                                    <TableCell className="pt-4">
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${payment.color}`}>
                                            {payment.label}
                                        </span>
                                    </TableCell>
                                    <TableCell className="pt-4">
                                        <span className="text-xs text-muted-foreground">
                                            {new Date(order.created_at).toLocaleDateString('vi-VN')}
                                        </span>
                                        <p className="text-[11px] text-stone-400 mt-0.5">
                                            {new Date(order.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </TableCell>
                                    <TableCell className="pt-3">
                                        <OrderStatusSelect id={order.id} currentStatus={order.status} />
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Hiển thị {orders.length} / {total} đơn hàng</span>
                    <div className="flex gap-2">
                        {page > 1 && (
                            <Link href={`/admin/orders?page=${page - 1}${activeStatus ? `&status=${activeStatus}` : ''}`}>
                                <Button variant="outline" size="sm">← Trước</Button>
                            </Link>
                        )}
                        <span className="flex items-center px-3 text-sm">Trang {page}/{totalPages}</span>
                        {page < totalPages && (
                            <Link href={`/admin/orders?page=${page + 1}${activeStatus ? `&status=${activeStatus}` : ''}`}>
                                <Button variant="outline" size="sm">Tiếp →</Button>
                            </Link>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
