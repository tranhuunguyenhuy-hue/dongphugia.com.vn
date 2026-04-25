'use client'

import { useState, useTransition } from 'react'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { updatePaymentStatus } from '@/lib/order-actions'

const PAYMENT_OPTIONS = [
    { value: 'unpaid', label: 'Chưa thanh toán' },
    { value: 'paid', label: 'Đã thanh toán' },
    { value: 'refunded', label: 'Đã hoàn tiền' },
]

export function OrderPaymentSelect({ id, currentPaymentStatus }: { id: number; currentPaymentStatus: string }) {
    const [status, setStatus] = useState(currentPaymentStatus)
    const [isPending, startTransition] = useTransition()

    const handleChange = (newStatus: string) => {
        setStatus(newStatus)
        startTransition(async () => {
            const result = await updatePaymentStatus(id, newStatus)
            if (result?.message) {
                setStatus(currentPaymentStatus) // rollback on error
                console.error(result.message)
            }
        })
    }

    return (
        <Select value={status} onValueChange={handleChange} disabled={isPending}>
            <SelectTrigger className="h-8 text-xs w-full">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {PAYMENT_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}
