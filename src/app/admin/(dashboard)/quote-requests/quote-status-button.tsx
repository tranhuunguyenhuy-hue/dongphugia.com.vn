'use client'

import { useTransition } from 'react'
import { updateQuoteRequestStatus } from '@/lib/actions'
import { Check, X } from 'lucide-react'
import { toast } from 'sonner'

interface QuoteStatusButtonProps {
    id: number
    currentStatus: string
}

export function QuoteStatusButton({ id, currentStatus }: QuoteStatusButtonProps) {
    const [isPending, startTransition] = useTransition()

    const markResolved = () => {
        startTransition(async () => {
            const result = await updateQuoteRequestStatus(id, 'resolved')
            if (result.success) toast.success('Đã đánh dấu đã xử lý')
            else toast.error(result.message || 'Có lỗi xảy ra')
        })
    }

    const markCancelled = () => {
        startTransition(async () => {
            const result = await updateQuoteRequestStatus(id, 'cancelled')
            if (result.success) toast.success('Đã huỷ báo giá')
            else toast.error(result.message || 'Có lỗi xảy ra')
        })
    }

    if (currentStatus !== 'pending') {
        return (
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${currentStatus === 'resolved' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {currentStatus === 'resolved' ? 'Đã xử lý' : 'Đã huỷ'}
            </span>
        )
    }

    return (
        <div className="flex items-center gap-1 justify-end">
            <button
                onClick={markResolved}
                disabled={isPending}
                title="Đánh dấu đã xử lý"
                className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center justify-center transition-colors disabled:opacity-50"
            >
                <Check className="h-3.5 w-3.5" />
            </button>
            <button
                onClick={markCancelled}
                disabled={isPending}
                title="Huỷ"
                className="h-7 w-7 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center transition-colors disabled:opacity-50"
            >
                <X className="h-3.5 w-3.5" />
            </button>
        </div>
    )
}
