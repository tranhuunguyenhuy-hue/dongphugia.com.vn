'use client'

import { useTransition } from 'react'
import { deletePartner } from '@/lib/partner-actions'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export function PartnerDeleteButton({ id }: { id: number }) {
    const [isPending, startTransition] = useTransition()

    const handleDelete = () => {
        if (!confirm('Xác nhận xóa đối tác này?')) return
        startTransition(async () => {
            const result = await deletePartner(id)
            if (result.success) {
                toast.success('Đã xóa đối tác')
            } else {
                toast.error('Có lỗi xảy ra')
            }
        })
    }

    return (
        <button onClick={handleDelete} disabled={isPending}
            className="h-8 w-8 rounded-lg border border-[#E4EEF2] flex items-center justify-center text-muted-foreground hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors disabled:opacity-50"
            title="Xóa đối tác">
            <Trash2 className="h-3.5 w-3.5" />
        </button>
    )
}
