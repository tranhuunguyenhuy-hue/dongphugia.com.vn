'use client'

import { useState, useTransition } from 'react'
import { deleteSangoProduct } from '@/lib/sango-actions'
import { toast } from 'sonner'
import { Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function SangoProductDeleteButton({ id, name }: { id: number; name: string }) {
    const [isPending, startTransition] = useTransition()
    const [confirmed, setConfirmed] = useState(false)

    const handleClick = () => {
        if (!confirmed) {
            setConfirmed(true)
            setTimeout(() => setConfirmed(false), 3000)
            return
        }
        startTransition(async () => {
            const result = await deleteSangoProduct(id)
            if (result?.message) {
                toast.error(result.message)
            } else {
                toast.success(`Đã xóa: ${name}`)
            }
        })
    }

    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={handleClick}
            disabled={isPending}
            className={confirmed ? 'text-red-600 hover:text-red-700 hover:bg-red-50' : 'text-muted-foreground'}
            title={confirmed ? 'Nhấn lần nữa để xác nhận xóa' : 'Xóa sản phẩm'}
        >
            {isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Trash2 className="h-3.5 w-3.5" />}
            {confirmed ? 'Xác nhận?' : ''}
        </Button>
    )
}
