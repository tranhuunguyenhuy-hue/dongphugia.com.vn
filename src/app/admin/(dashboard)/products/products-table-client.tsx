'use client'

import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { Package2, CheckSquare, Square, Trash2, Eye, EyeOff, Star, StarOff, Loader2, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { ProductActions } from './product-actions'
import { toast } from 'sonner'
import { bulkDeleteProducts, bulkToggleActive, bulkToggleFeatured, updateProductSortOrders } from '@/lib/product-actions'
import { useSearchParams } from 'next/navigation'
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core'
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Category {
    name: string
}
interface Brand {
    name: string
    image_url?: string | null
}
interface Product {
    id: number
    name: string
    sku: string | null
    price: number | null
    original_price: number | null
    price_display: string | null
    image_main_url: string | null
    stock_status: string
    is_active: boolean
    is_featured: boolean
    is_promotion: boolean
    sort_order: number
    created_at: Date
    categories: Category
    subcategories: { name: string } | null
    brands: Brand | null
}

const statusColor: Record<string, string> = {
    in_stock: 'bg-emerald-100 text-emerald-700',
    out_of_stock: 'bg-red-100 text-red-700',
    preorder: 'bg-amber-100 text-amber-700',
}
const statusLabel: Record<string, string> = {
    in_stock: 'Còn hàng',
    out_of_stock: 'Hết hàng',
    preorder: 'Đặt trước',
}

export function ProductsTableClient({ products }: { products: Product[] }) {
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
    const [isPending, startTransition] = useTransition()
    const searchParams = useSearchParams()

    // Drag and drop state
    const [localProducts, setLocalProducts] = useState(products)
    
    // Sync local state when products prop changes
    useEffect(() => {
        setLocalProducts(products)
    }, [products])

    // Check if we can reorder: must be filtering by a specific subcategory, no search, default sort
    const subcategoryId = searchParams.get('subcategory_id')
    const canReorder = Boolean(
        subcategoryId && 
        subcategoryId !== 'all' && 
        (!searchParams.get('search') || searchParams.get('search') === '') && 
        (!searchParams.get('sort') || searchParams.get('sort') === 'default')
    )

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event
        
        if (active.id !== over?.id && over) {
            const oldIndex = localProducts.findIndex((item) => item.id === active.id)
            const newIndex = localProducts.findIndex((item) => item.id === over.id)
            
            const newOrder = arrayMove(localProducts, oldIndex, newIndex)
            setLocalProducts(newOrder)
            
            // Assign new sort_orders based on min sort_order of current view to keep them contiguous
            const minSortOrder = Math.min(...newOrder.map(p => p.sort_order ?? 0))
            const updates = newOrder.map((p, index) => ({
                id: p.id,
                sort_order: minSortOrder + index
            }))
            
            startTransition(async () => {
                const res = await updateProductSortOrders(updates)
                if (res.success) {
                    toast.success('Đã cập nhật vị trí')
                } else {
                    toast.error(res.message || 'Lỗi cập nhật vị trí')
                    setLocalProducts(products) // Revert on error
                }
            })
        }
    }

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(new Set(products.map(p => p.id)))
        } else {
            setSelectedIds(new Set())
        }
    }

    const handleSelectRow = (id: number, checked: boolean) => {
        const newSet = new Set(selectedIds)
        if (checked) {
            newSet.add(id)
        } else {
            newSet.delete(id)
        }
        setSelectedIds(newSet)
    }

    const handleBulkAction = (action: 'delete' | 'hide' | 'show' | 'feature' | 'unfeature') => {
        if (selectedIds.size === 0) return

        startTransition(async () => {
            const ids = Array.from(selectedIds)
            try {
                let res;
                if (action === 'delete') {
                    if (!confirm(`Bạn có chắc chắn muốn xoá ${ids.length} sản phẩm đã chọn?`)) return
                    res = await bulkDeleteProducts(ids)
                } else if (action === 'hide') {
                    res = await bulkToggleActive(ids, false)
                } else if (action === 'show') {
                    res = await bulkToggleActive(ids, true)
                } else if (action === 'feature') {
                    res = await bulkToggleFeatured(ids, true)
                } else if (action === 'unfeature') {
                    res = await bulkToggleFeatured(ids, false)
                }

                if (res?.success) {
                    toast.success('Thao tác thành công')
                    setSelectedIds(new Set()) // clear selection on success
                } else {
                    toast.error(res?.message || 'Có lỗi xảy ra')
                }
            } catch (error) {
                toast.error('Có lỗi xảy ra')
            }
        })
    }

    const isAllSelected = localProducts.length > 0 && selectedIds.size === localProducts.length

    return (
        <div className="space-y-4">
            {/* Bulk Actions Bar */}
            {selectedIds.size > 0 && (
                <div className="flex items-center justify-between p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg animate-in fade-in slide-in-from-top-4">
                    <span className="text-sm font-medium text-indigo-900 px-2">
                        Đã chọn {selectedIds.size} sản phẩm
                    </span>
                    <div className="flex items-center gap-2">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="bg-white hover:bg-red-50 hover:text-red-600 border-red-200 text-red-600"
                            onClick={() => handleBulkAction('delete')}
                            disabled={isPending}
                        >
                            <Trash2 className="h-4 w-4 mr-1.5" />
                            Xoá
                        </Button>
                        <div className="w-px h-4 bg-indigo-200 mx-1" />
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="bg-white"
                            onClick={() => handleBulkAction('show')}
                            disabled={isPending}
                        >
                            <Eye className="h-4 w-4 mr-1.5" />
                            Hiện
                        </Button>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="bg-white"
                            onClick={() => handleBulkAction('hide')}
                            disabled={isPending}
                        >
                            <EyeOff className="h-4 w-4 mr-1.5" />
                            Ẩn
                        </Button>
                        <div className="w-px h-4 bg-indigo-200 mx-1" />
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="bg-white text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-200"
                            onClick={() => handleBulkAction('feature')}
                            disabled={isPending}
                        >
                            <Star className="h-4 w-4 mr-1.5 fill-amber-600" />
                            Đặt nổi bật
                        </Button>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="bg-white"
                            onClick={() => handleBulkAction('unfeature')}
                            disabled={isPending}
                        >
                            <StarOff className="h-4 w-4 mr-1.5" />
                            Bỏ nổi bật
                        </Button>
                    </div>
                </div>
            )}

            <div className="border border-border/60 rounded-xl overflow-hidden bg-white relative">
                {isPending && (
                    <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                )}
                <Table>
                    <TableHeader>
                        <TableRow className="bg-neutral-50/50 hover:bg-neutral-50/50 border-b-border/60">
                            <TableHead className="w-[40px] text-center px-3">
                                <Checkbox 
                                    checked={isAllSelected}
                                    onCheckedChange={handleSelectAll}
                                    aria-label="Chọn tất cả"
                                />
                            </TableHead>
                            <TableHead className="w-[50px] px-2">Ảnh</TableHead>
                            <TableHead className="w-[280px] px-2">Tên / SKU</TableHead>
                            <TableHead className="w-[120px] px-2">Thương hiệu</TableHead>
                            <TableHead className="px-2">Danh mục</TableHead>
                            <TableHead className="px-2">Trạng thái</TableHead>
                            <TableHead className="px-2">Giá gốc</TableHead>
                            <TableHead className="px-2">Giá hiện tại</TableHead>
                            <TableHead className="px-2">Ngày tạo</TableHead>
                            <TableHead className="w-[80px] px-2 text-right">Hành động</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {localProducts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="text-center py-16 text-muted-foreground">
                                    <Package2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                                    Chưa có sản phẩm nào
                                </TableCell>
                            </TableRow>
                        ) : (
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}
                            >
                                <SortableContext
                                    items={localProducts.map(p => p.id)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    {localProducts.map(product => {
                                        const isSelected = selectedIds.has(product.id)
                                        return (
                                            <SortableProductRow
                                                key={product.id}
                                                product={product}
                                                isSelected={isSelected}
                                                canReorder={canReorder}
                                                handleSelectRow={handleSelectRow}
                                            />
                                        )
                                    })}
                                </SortableContext>
                            </DndContext>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}

function SortableProductRow({ product, isSelected, canReorder, handleSelectRow }: any) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: product.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
    }
    
    const isFeatured = product.is_featured

    return (
        <TableRow 
            ref={setNodeRef}
            style={style}
            className={`group transition-colors relative border-b-border/40 ${isSelected ? 'bg-indigo-50/40 hover:bg-indigo-50/60' : 'hover:bg-neutral-50/50'} ${isFeatured && !isSelected ? 'bg-gradient-to-r from-red-50/60 to-transparent hover:from-red-50 hover:to-transparent' : ''} ${isDragging ? 'shadow-lg bg-white border border-indigo-200 opacity-90' : ''}`}
        >
            <TableCell className="px-3 py-2">
                <div className="flex items-center gap-2">
                    {canReorder ? (
                        <div {...attributes} {...listeners} className="cursor-grab hover:bg-slate-100 p-1 rounded active:cursor-grabbing text-slate-400">
                            <GripVertical className="h-4 w-4" />
                        </div>
                    ) : null}
                    <Checkbox 
                        checked={isSelected}
                        onCheckedChange={(c) => handleSelectRow(product.id, !!c)}
                        aria-label={`Chọn sản phẩm ${product.name}`}
                    />
                </div>
            </TableCell>
            <TableCell className="px-2 py-2">
                <div className="w-10 h-10 rounded-md border bg-neutral-50 overflow-hidden relative flex-shrink-0">
                    {product.image_main_url && (
                        <img
                            src={product.image_main_url}
                            alt={product.name}
                            className="w-full h-full object-cover"
                        />
                    )}
                </div>
            </TableCell>
            <TableCell className="px-2 py-2 max-w-[280px]">
                <Link href={`/admin/products/${product.id}`} className="hover:text-[#2E7A96] transition-colors">
                    <p className="font-medium text-sm truncate leading-tight" title={product.name}>{product.name}</p>
                </Link>
                <p className="text-[11px] text-muted-foreground mt-0.5 font-mono truncate">{product.sku}</p>
            </TableCell>
            <TableCell className="px-2 py-2">
                {product.brands?.name ? (
                    <span className="text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 w-fit px-1.5 py-0.5 rounded-sm">
                        {product.brands.name}
                    </span>
                ) : (
                    <span className="text-muted-foreground/30 text-xs">-</span>
                )}
            </TableCell>
            <TableCell className="px-2 py-2">
                <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium text-neutral-700 bg-neutral-100 w-fit px-1.5 py-0.5 rounded">
                        {product.categories?.name || '-'}
                    </span>
                    {product.subcategories?.name && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <span className="text-neutral-400">↳</span> {product.subcategories.name}
                        </span>
                    )}
                </div>
            </TableCell>
            <TableCell className="px-2 py-2">
                <div className="flex flex-col gap-1 items-start">
                    <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${statusColor[product.stock_status] || 'bg-neutral-100 text-neutral-600'}`}>
                        {statusLabel[product.stock_status] || product.stock_status}
                    </span>
                    <div className="flex gap-1 flex-wrap">
                        <Badge variant={product.is_active ? 'default' : 'secondary'} className="text-[9px] px-1 py-0 h-4 rounded-sm">
                            {product.is_active ? 'Hiện' : 'Ẩn'}
                        </Badge>
                        {product.is_featured && (
                            <Badge className="text-[9px] px-1 py-0 h-4 rounded-sm bg-amber-100 text-amber-700 hover:bg-amber-100 border border-amber-200">
                                Nổi bật
                            </Badge>
                        )}
                        {(product.is_promotion || (product.original_price && product.original_price > (product.price || 0))) && (
                            <Badge className="text-[9px] px-1 py-0 h-4 rounded-sm bg-red-100 text-red-700 hover:bg-red-100 border border-red-200">
                                Khuyến mãi
                            </Badge>
                        )}
                    </div>
                </div>
            </TableCell>
            <TableCell className="px-2 py-2">
                {product.original_price ? (
                    <span className="text-xs text-muted-foreground line-through">
                        {product.original_price.toLocaleString('vi-VN')}đ
                    </span>
                ) : <span className="text-muted-foreground/30 text-xs">-</span>}
            </TableCell>
            <TableCell className="px-2 py-2">
                <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-semibold ${product.original_price && product.original_price > (product.price || 0) ? 'text-red-600' : ''}`}>
                        {product.price
                            ? `${product.price.toLocaleString('vi-VN')}đ`
                            : product.price_display || <span className="text-muted-foreground/30">-</span>}
                    </span>
                    {product.original_price && product.original_price > (product.price || 0) && (
                        <span className="text-[9px] font-bold text-white bg-red-500 px-1 py-0 rounded-sm">
                            -{Math.round(((product.original_price - (product.price || 0)) / product.original_price) * 100)}%
                        </span>
                    )}
                </div>
            </TableCell>
            <TableCell className="px-2 py-2">
                <div className="flex flex-col">
                    <span className="text-xs text-neutral-700">
                        {new Date(product.created_at).toLocaleDateString('vi-VN')}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                        {new Date(product.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>
            </TableCell>
            <TableCell className="px-2 py-2 text-right">
                <ProductActions
                    id={product.id}
                    isActive={product.is_active}
                    isFeatured={product.is_featured}
                    productName={product.name}
                />
            </TableCell>
        </TableRow>
    )
}
