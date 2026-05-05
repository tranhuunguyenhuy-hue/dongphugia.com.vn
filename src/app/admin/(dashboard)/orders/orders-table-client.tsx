'use client'

import { useState } from 'react'
import Link from 'next/link'
import { type ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/admin/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Eye, Package } from 'lucide-react'
import { OrderStatusSelect } from './order-status-select'

const statusConfig: Record<string, { label: string; color: string }> = {
    pending: { label: 'Cần xử lý', color: 'bg-amber-100 text-amber-700 border border-amber-200' },
    received: { label: 'Tiếp nhận', color: 'bg-indigo-100 text-indigo-700 border border-indigo-200' },
    confirmed: { label: 'Xác nhận đơn', color: 'bg-blue-100 text-blue-700 border border-blue-200' },
    inventory_check: { label: 'Báo cáo kho', color: 'bg-purple-100 text-purple-700 border border-purple-200' },
    completed: { label: 'Đặt hàng thành công', color: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
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

export function OrdersTableClient({
    orders,
}: {
    orders: any[]
}) {
    const columns: ColumnDef<any>[] = [
        {
            accessorKey: 'order_number',
            header: 'Mã đơn',
            cell: ({ row }) => {
                const order = row.original
                return (
                    <div className="flex flex-col gap-1">
                        <Link href={`/admin/orders/${order.id}`} className="font-mono text-xs font-bold text-[#2E7A96] hover:underline">
                            {order.order_number}
                        </Link>
                        <Link href={`/admin/orders/${order.id}`} className="inline-flex items-center gap-1 text-[11px] text-stone-400 hover:text-stone-600 transition-colors">
                            <Eye className="w-3 h-3" />
                            Chi tiết
                        </Link>
                    </div>
                )
            },
        },
        {
            accessorKey: 'customer_name',
            header: 'Khách hàng',
            cell: ({ row }) => {
                const order = row.original
                return (
                    <div>
                        <p className="text-sm font-semibold text-stone-800">{order.customer_name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{order.customer_phone}</p>
                        {order.note && (
                            <p className="text-[11px] text-amber-600 mt-1 italic truncate max-w-[150px]" title={order.note}>
                                Ghi chú: {order.note}
                            </p>
                        )}
                    </div>
                )
            },
        },
        {
            id: 'products',
            header: 'Sản phẩm',
            cell: ({ row }) => {
                const order = row.original
                const totalItems = order._count?.order_items || 0
                const previewItems: any[] = order.order_items || []
                
                return previewItems.length > 0 ? (
                    <div className="flex flex-col gap-1.5 min-w-[150px]">
                        {previewItems.map((item: any) => (
                            <div key={item.id} className="flex items-center justify-between gap-2 text-xs bg-stone-50/50 p-1.5 rounded-md border border-stone-100">
                                <div className="flex items-center gap-1.5 overflow-hidden">
                                    <Package className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                                    <span className="font-mono font-medium text-stone-700 truncate" title={item.product_name}>
                                        {item.product_sku !== 'N/A' && item.product_sku ? item.product_sku : item.product_name}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0 text-stone-500">
                                    <span>x{item.quantity}</span>
                                </div>
                            </div>
                        ))}
                        {totalItems > 3 && (
                            <p className="text-[11px] text-stone-400 text-center bg-stone-50 rounded py-1">+{totalItems - 3} sản phẩm khác</p>
                        )}
                    </div>
                ) : (
                    <span className="text-xs text-muted-foreground">{totalItems} sản phẩm</span>
                )
            },
        },
        {
            accessorKey: 'total',
            header: () => <div className="text-right">Tổng tiền</div>,
            cell: ({ row }) => {
                return (
                    <div className="text-right text-sm font-bold text-stone-900">
                        {formatVND(row.getValue('total') as number)}
                    </div>
                )
            },
        },
        {
            accessorKey: 'status',
            header: 'Trạng thái',
            cell: ({ row }) => {
                const statusStr = row.getValue('status') as string
                const status = statusConfig[statusStr] || { label: statusStr, color: 'bg-neutral-100 text-neutral-600' }
                return (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.color}`}>
                        {status.label}
                    </span>
                )
            },
        },
        {
            accessorKey: 'payment_status',
            header: 'Thanh toán',
            cell: ({ row }) => {
                const paymentStr = row.getValue('payment_status') as string
                const payment = paymentConfig[paymentStr] || { label: paymentStr, color: 'bg-neutral-100' }
                return (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${payment.color}`}>
                        {payment.label}
                    </span>
                )
            },
        },
        {
            accessorKey: 'created_at',
            header: 'Ngày đặt',
            cell: ({ row }) => {
                const date = new Date(row.getValue('created_at') as Date | string)
                return (
                    <div>
                        <span className="text-xs text-muted-foreground">
                            {date.toLocaleDateString('vi-VN')}
                        </span>
                        <p className="text-[11px] text-stone-400 mt-0.5">
                            {date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>
                )
            },
        },
        {
            id: 'actions',
            header: 'Cập nhật',
            cell: ({ row }) => {
                const order = row.original
                return (
                    <div className="w-[150px]">
                        <OrderStatusSelect id={order.id} currentStatus={order.status} />
                    </div>
                )
            },
        },
    ]

    return (
        <div className="bg-white rounded-xl border border-border/60 overflow-hidden">
            <DataTable columns={columns} data={orders} hidePagination />
        </div>
    )
}
