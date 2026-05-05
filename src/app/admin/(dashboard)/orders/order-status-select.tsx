'use client'

import { useState, useTransition } from 'react'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { updateOrderStatus } from '@/lib/order-actions'

const STATUS_OPTIONS = [
    { value: 'pending', label: 'Cần xử lý' },
    { value: 'received', label: 'Tiếp nhận' },
    { value: 'confirmed', label: 'Xác nhận đơn' },
    { value: 'inventory_check', label: 'Báo cáo kho' },
    { value: 'completed', label: 'Đặt hàng thành công' },
    { value: 'cancelled', label: 'Đã hủy' },
]

export function OrderStatusSelect({ id, currentStatus }: { id: number; currentStatus: string }) {
    const [status, setStatus] = useState(currentStatus)
    const [isPending, startTransition] = useTransition()

    const handleChange = (newStatus: string) => {
        setStatus(newStatus)
        startTransition(async () => {
            const result = await updateOrderStatus(id, newStatus)
            if (result?.message) {
                setStatus(currentStatus) // rollback on error
                console.error(result.message)
            }
        })
    }

    return (
        <Select value={status} onValueChange={handleChange} disabled={isPending}>
            <SelectTrigger className="h-8 text-xs w-[140px]">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {STATUS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}
