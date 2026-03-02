'use client'

import { useState, useTransition } from 'react'
import { deleteBlogPost } from '@/lib/blog-actions'
import { toast } from 'sonner'
import { Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function BlogPostDeleteButton({ id, title }: { id: number; title: string }) {
    const [confirm, setConfirm] = useState(false)
    const [isPending, startTransition] = useTransition()

    const handleDelete = () => {
        startTransition(async () => {
            const result = await deleteBlogPost(id)
            if (result?.message) {
                toast.error(result.message)
            } else {
                toast.success('Đã xóa bài viết')
            }
            setConfirm(false)
        })
    }

    if (confirm) {
        return (
            <div className="flex items-center gap-1">
                <Button size="sm" variant="destructive" className="h-7 px-2 text-xs gap-1" onClick={handleDelete} disabled={isPending}>
                    {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    Xóa
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setConfirm(false)}>
                    Huỷ
                </Button>
            </div>
        )
    }

    return (
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => setConfirm(true)}>
            <Trash2 className="h-3 w-3" />
        </Button>
    )
}
