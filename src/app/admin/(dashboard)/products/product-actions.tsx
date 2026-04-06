'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Pencil, Trash2, Star, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toggleProductFeatured, toggleProductActive, deleteProduct } from '@/lib/product-actions'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface Props {
    id: number
    isActive: boolean
    isFeatured: boolean
}

export function ProductActions({ id, isActive, isFeatured }: Props) {
    const [showDelete, setShowDelete] = useState(false)
    const [loading, setLoading] = useState<string | null>(null)

    const handle = async (action: string, fn: () => Promise<any>) => {
        setLoading(action)
        await fn()
        setLoading(null)
    }

    return (
        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
            {/* Edit */}
            <Link href={`/admin/products/${id}`}>
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Chỉnh sửa">
                    <Pencil className="h-3.5 w-3.5" />
                </Button>
            </Link>

            {/* Toggle Featured */}
            <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 ${isFeatured ? 'text-amber-500' : ''}`}
                title={isFeatured ? 'Bỏ nổi bật' : 'Đặt nổi bật'}
                disabled={loading === 'featured'}
                onClick={() => handle('featured', () => toggleProductFeatured(id, !isFeatured))}
            >
                <Star className={`h-3.5 w-3.5 ${isFeatured ? 'fill-amber-400' : ''}`} />
            </Button>

            {/* Toggle Active */}
            <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 ${isActive ? 'text-emerald-500' : 'text-neutral-400'}`}
                title={isActive ? 'Ẩn sản phẩm' : 'Hiển thị sản phẩm'}
                disabled={loading === 'active'}
                onClick={() => handle('active', () => toggleProductActive(id, !isActive))}
            >
                {isActive ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </Button>

            {/* Delete */}
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                title="Xóa"
                onClick={() => setShowDelete(true)}
            >
                <Trash2 className="h-3.5 w-3.5" />
            </Button>

            <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Xóa sản phẩm?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Hành động này không thể hoàn tác. Sản phẩm và toàn bộ ảnh liên quan sẽ bị xóa vĩnh viễn.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            onClick={() => deleteProduct(id)}
                        >
                            Xóa
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
