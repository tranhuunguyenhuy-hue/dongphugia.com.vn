'use client'

import { useTransition } from 'react'
import { deleteProduct } from '@/lib/actions'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export function ProductDeleteButton({ id }: { id: number }) {
    const [isPending, startTransition] = useTransition()

    const handleDelete = () => {
        if (!confirm('Xác nhận xóa sản phẩm này?')) return
        startTransition(async () => {
            const result = await deleteProduct(id)
            if (result.success) {
                toast.success('Đã xóa sản phẩm')
            } else {
                toast.error(result.message || 'Có lỗi xảy ra')
            }
        })
    }

    return (
        <button
            onClick={handleDelete}
            disabled={isPending}
            className="h-8 w-8 rounded-lg border border-[#E4EEF2] flex items-center justify-center text-muted-foreground hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors disabled:opacity-50"
            title="Xóa sản phẩm"
        >
            <Trash2 className="h-3.5 w-3.5" />
        </button>
    )
}
