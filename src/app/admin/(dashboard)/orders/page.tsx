import { getAdminOrders, getOrderStats } from '@/lib/order-actions'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ShoppingBag, Clock, Truck, CheckCircle, TrendingUp } from 'lucide-react'
import { PageHeader } from '@/components/admin/page-header'
import { OrdersTableClient } from './orders-table-client'
import { OrderSearch } from './order-search'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

interface PageProps {
    searchParams: Promise<{ status?: string; payment_status?: string; search?: string; page?: string }>
}



function formatVND(amount: number) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
}

const STATUS_FILTERS = [
    { label: 'Tất cả', value: '' },
    { label: 'Cần xử lý', value: 'pending' },
    { label: 'Tiếp nhận', value: 'received' },
    { label: 'Xác nhận đơn', value: 'confirmed' },
    { label: 'Báo cáo kho', value: 'inventory_check' },
    { label: 'Đặt hàng thành công', value: 'completed' },
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
            <PageHeader
                title="Đơn hàng"
                description={`Quản lý và theo dõi đơn hàng của khách — ${total} đơn hàng`}
            />



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

            {/* Filters & Search */}
            <div className="flex flex-col sm:flex-row justify-between gap-4">
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
                <Suspense fallback={<div className="h-10 w-full sm:w-[320px] bg-slate-100 animate-pulse rounded-md"></div>}>
                    <OrderSearch />
                </Suspense>
            </div>

            {/* Table */}
            <OrdersTableClient orders={orders} />

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
