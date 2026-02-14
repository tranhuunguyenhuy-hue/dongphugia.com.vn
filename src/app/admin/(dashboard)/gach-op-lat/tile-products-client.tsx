"use client"

import { useState, useTransition } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Layers, ChevronRight, Plus, MoreVertical, Pencil, Trash2, Package, BrickWall } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { ProductTypeDialog } from "./product-type-dialog"
import { deleteProductType } from "@/lib/actions"
import { toast } from "sonner"

// Visual styles per sub-category
const SUB_CATEGORY_META: Record<string, { gradient: string; iconBg: string; description: string }> = {
    "gach-van-da-marble": {
        gradient: "from-amber-50 to-orange-50",
        iconBg: "bg-amber-100 text-amber-700",
        description: "Vân đá cẩm thạch cao cấp, sang trọng",
    },
    "gach-van-da-tu-nhien": {
        gradient: "from-stone-50 to-slate-50",
        iconBg: "bg-stone-100 text-stone-700",
        description: "Vẻ đẹp tự nhiên của đá nguyên bản",
    },
    "gach-van-go": {
        gradient: "from-yellow-50 to-amber-50",
        iconBg: "bg-yellow-100 text-yellow-700",
        description: "Vân gỗ tự nhiên, ấm áp",
    },
    "gach-thiet-ke-xi-mang": {
        gradient: "from-slate-50 to-zinc-50",
        iconBg: "bg-slate-100 text-slate-700",
        description: "Phong cách công nghiệp hiện đại",
    },
    "gach-trang-tri": {
        gradient: "from-pink-50 to-purple-50",
        iconBg: "bg-pink-100 text-pink-700",
        description: "Điểm nhấn trang trí độc đáo",
    },
}

interface SubCategory {
    id: string
    name: string
    slug: string
    image: string | null
    _count: {
        products: number
        collections: number
    }
}

interface TileProductsClientProps {
    categoryId: string
    subCategories: SubCategory[]
    totalProducts: number
    totalCollections: number
}

export function TileProductsClient({
    categoryId,
    subCategories,
    totalProducts,
    totalCollections,
}: TileProductsClientProps) {
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingType, setEditingType] = useState<SubCategory | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<SubCategory | null>(null)
    const [isPending, startTransition] = useTransition()

    const handleEdit = (sub: SubCategory) => {
        setEditingType(sub)
        setDialogOpen(true)
    }

    const handleCreate = () => {
        setEditingType(null)
        setDialogOpen(true)
    }

    const handleDelete = () => {
        if (!deleteTarget) return
        startTransition(async () => {
            const result = await deleteProductType(deleteTarget.id)
            if (result?.message && !result?.success) {
                toast.error(result.message)
            } else {
                toast.success("Đã xóa loại sản phẩm")
            }
            setDeleteTarget(null)
        })
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Gạch ốp lát</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {totalProducts} sản phẩm · {totalCollections} bộ sưu tập · {subCategories.length} loại
                    </p>
                </div>
                <Button onClick={handleCreate} size="sm" className="press-effect">
                    <Plus className="mr-1.5 h-4 w-4" />
                    Thêm loại gạch
                </Button>
            </div>

            {/* Sub-category cards grid */}
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {subCategories.map((sub) => {
                    const meta = SUB_CATEGORY_META[sub.slug] || {
                        gradient: "from-gray-50 to-gray-50",
                        iconBg: "bg-gray-100 text-gray-700",
                        description: "",
                    }

                    return (
                        <Card
                            key={sub.id}
                            className="group card-hover overflow-hidden border hover:border-primary/30 transition-all duration-300"
                        >
                            {/* Image / Gradient header */}
                            <div className={`relative h-32 bg-gradient-to-br ${meta.gradient} overflow-hidden`}>
                                {sub.image ? (
                                    <Image
                                        src={sub.image}
                                        alt={sub.name}
                                        fill
                                        className="object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <BrickWall className="h-12 w-12 text-slate-300/60" />
                                    </div>
                                )}

                                {/* Actions overlay */}
                                <div className="absolute top-2 right-2">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="secondary"
                                                size="icon"
                                                className="h-7 w-7 bg-white/80 backdrop-blur-sm hover:bg-white shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <MoreVertical className="h-3.5 w-3.5" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => handleEdit(sub)}>
                                                <Pencil className="mr-2 h-4 w-4" />
                                                Sửa thông tin
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                className="text-destructive focus:text-destructive"
                                                onClick={() => setDeleteTarget(sub)}
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Xóa
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>

                            {/* Content */}
                            <CardContent className="p-4">
                                <Link
                                    href={`/admin/gach-op-lat/type/${sub.slug}`}
                                    className="group/link"
                                >
                                    <h3 className="font-semibold text-sm group-hover/link:text-primary transition-colors flex items-center gap-1.5">
                                        {sub.name}
                                        <ChevronRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 group-hover/link:opacity-100 group-hover/link:translate-x-0 transition-all" />
                                    </h3>
                                </Link>
                                {meta.description && (
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                        {meta.description}
                                    </p>
                                )}

                                {/* Stats row */}
                                <div className="flex items-center gap-3 mt-3 pt-3 border-t">
                                    <div className="flex items-center gap-1.5">
                                        <div className={`flex h-6 w-6 items-center justify-center rounded-md ${meta.iconBg}`}>
                                            <Layers className="h-3 w-3" />
                                        </div>
                                        <span className="text-xs">
                                            <span className="font-semibold">{sub._count.collections}</span>
                                            <span className="text-muted-foreground ml-0.5">BST</span>
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className={`flex h-6 w-6 items-center justify-center rounded-md ${meta.iconBg}`}>
                                            <Package className="h-3 w-3" />
                                        </div>
                                        <span className="text-xs">
                                            <span className="font-semibold">{sub._count.products}</span>
                                            <span className="text-muted-foreground ml-0.5">SP</span>
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}

                {/* Add new card */}
                <Card
                    className="group cursor-pointer border-2 border-dashed hover:border-primary/40 hover:bg-green-50/30 transition-all duration-300 flex items-center justify-center min-h-[200px]"
                    onClick={handleCreate}
                >
                    <div className="text-center py-8">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-green-700 group-hover:scale-110 transition-transform">
                            <Plus className="h-6 w-6" />
                        </div>
                        <p className="mt-3 text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                            Thêm loại gạch mới
                        </p>
                    </div>
                </Card>
            </div>

            {subCategories.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                    <BrickWall className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p className="text-lg font-medium">Chưa có loại gạch nào</p>
                    <p className="text-sm mt-1">Nhấn &quot;Thêm loại gạch&quot; để bắt đầu.</p>
                </div>
            )}

            {/* Create/Edit Dialog */}
            <ProductTypeDialog
                open={dialogOpen}
                onOpenChange={(open) => {
                    setDialogOpen(open)
                    if (!open) setEditingType(null)
                }}
                categoryId={categoryId}
                initialData={editingType}
            />

            {/* Delete Confirmation */}
            <AlertDialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Xóa loại sản phẩm?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Bạn sắp xóa <strong>{deleteTarget?.name}</strong>.
                            {deleteTarget && deleteTarget._count.products > 0
                                ? ` Loại này đang có ${deleteTarget._count.products} sản phẩm, cần chuyển hoặc xóa sản phẩm trước.`
                                : " Các bộ sưu tập liên quan cũng sẽ bị xóa. Hành động này không thể hoàn tác."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Huỷ</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isPending}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 press-effect"
                        >
                            {isPending ? "Đang xóa..." : "Xóa"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
