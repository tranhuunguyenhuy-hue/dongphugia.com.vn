'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Pencil, Trash2, Star, Eye, EyeOff, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toggleProductFeatured, toggleProductActive, deleteProduct } from '@/lib/product-actions'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
    productName?: string
}

export function ProductActions({ id, isActive, isFeatured, productName }: Props) {
    const [showDelete, setShowDelete] = useState(false)
    const [loading, setLoading] = useState<string | null>(null)

    const handle = async (action: string, fn: () => Promise<any>) => {
        setLoading(action)
        await fn()
        setLoading(null)
    }

    return (
        <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
            {/* Toggle Featured */}
            <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 ${isFeatured ? 'text-amber-500' : ''}`}
                title={isFeatured ? 'Bỏ nổi bật' : 'Đặt nổi bật'}
                disabled={loading === 'featured'}
                onClick={() => handle('featured', () => toggleProductFeatured(id, !isFeatured))}
            >
                <Star className={`h-4 w-4 ${isFeatured ? 'fill-amber-400' : ''}`} />
            </Button>

            {/* More Actions Dropdown */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Mở menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[160px]">
                    <Link href={`/admin/products/${id}`}>
                        <DropdownMenuItem className="cursor-pointer">
                            <Pencil className="mr-2 h-4 w-4" />
                            <span>Chỉnh sửa</span>
                        </DropdownMenuItem>
                    </Link>
                    <DropdownMenuItem 
                        className="cursor-pointer"
                        disabled={loading === 'active'}
                        onClick={() => handle('active', () => toggleProductActive(id, !isActive))}
                    >
                        {isActive ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                        <span>{isActive ? 'Ẩn sản phẩm' : 'Hiện sản phẩm'}</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                        className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                        onClick={() => setShowDelete(true)}
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        <span>Xoá sản phẩm</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

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
