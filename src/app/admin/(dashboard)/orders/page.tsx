import { getAdminOrders, getOrderStats } from '@/lib/order-actions'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { ShoppingBag, Clock, Truck, CheckCircle, TrendingUp } from 'lucide-react'
import { OrderStatusSelect } from './order-status-select'

export const dynamic = 'force-dynamic'

interface PageProps {
    searchParams: Promise<{ status?: string; payment_status?: string; search?: string; page?: string }>
}

const statusConfig: Record<string, { label: string; color: string }> = {
    pending: { label: 'Chờ xác nhận', color: 'bg-amber-100 text-amber-700' },
    confirmed: { label: 'Đã xác nhận', color: 'bg-blue-100 text-blue-700' },
    processing: { label: 'Đang xử lý', color: 'bg-purple-100 text-purple-700' },
    shipping: { label: 'Đang giao', color: 'bg-indigo-100 text-indigo-700' },
    delivered: { label: 'Đã giao', color: 'bg-emerald-100 text-emerald-700' },
    cancelled: { label: 'Đã hủy', color: 'bg-red-100 text-red-700' },
}

const paymentConfig: Record<string, { label: string; color: string }> = {
    unpaid: { label: 'Chưa TT', color: 'bg-orange-100 text-orange-700' },
    paid: { label: 'Đã TT', color: 'bg-emerald-100 text-emerald-700' },
    refunded: { label: 'Hoàn tiền', color: 'bg-neutral-100 text-neutral-600' },
}

function formatVND(amount: number) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
}

export default async function AdminOrdersPage({ searchParams }: PageProps) {
    const params = await searchParams
    const page = Number(params.page || 1)

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
                        Quản lý và theo dõi đơn hàng của khách
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
                        <p className="text-sm text-emerald-700">Doanh thu (đơn đã giao & thanh toán)</p>
                        <p className="text-2xl font-bold text-emerald-800">{formatVND(stats.revenue)}</p>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-neutral-50 hover:bg-neutral-50">
                            <TableHead>Mã đơn</TableHead>
                            <TableHead>Khách hàng</TableHead>
                            <TableHead>SP</TableHead>
                            <TableHead>Tổng tiền</TableHead>
                            <TableHead>Trạng thái</TableHead>
                            <TableHead>Thanh toán</TableHead>
                            <TableHead>Ngày đặt</TableHead>
                            <TableHead>Cập nhật</TableHead>
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
                        ) : orders.map(order => {
                            const status = statusConfig[order.status] || { label: order.status, color: 'bg-neutral-100 text-neutral-600' }
                            const payment = paymentConfig[order.payment_status] || { label: order.payment_status, color: 'bg-neutral-100' }

                            return (
                                <TableRow key={order.id} className="hover:bg-neutral-50/60">
                                    <TableCell>
                                        <Link href={`/admin/orders/${order.id}`} className="font-mono text-sm font-semibold text-[#2E7A96] hover:underline">
                                            {order.order_number}
                                        </Link>
                                    </TableCell>
                                    <TableCell>
                                        <p className="text-sm font-medium">{order.customer_name}</p>
                                        <p className="text-xs text-muted-foreground">{order.customer_phone}</p>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm text-muted-foreground">
                                            {(order as any)._count?.order_items || 0} SP
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm font-semibold">
                                            {formatVND(order.total)}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.color}`}>
                                            {status.label}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${payment.color}`}>
                                            {payment.label}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-xs text-muted-foreground">
                                            {new Date(order.created_at).toLocaleDateString('vi-VN')}
                                        </span>
                                    </TableCell>
                                    <TableCell>
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
                            <Link href={`/admin/orders?page=${page - 1}`}>
                                <Button variant="outline" size="sm">← Trước</Button>
                            </Link>
                        )}
                        <span className="flex items-center px-3 text-sm">Trang {page}/{totalPages}</span>
                        {page < totalPages && (
                            <Link href={`/admin/orders?page=${page + 1}`}>
                                <Button variant="outline" size="sm">Tiếp →</Button>
                            </Link>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
