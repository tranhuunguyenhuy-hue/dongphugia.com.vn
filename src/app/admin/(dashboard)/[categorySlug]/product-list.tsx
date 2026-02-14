'use client'

import { useState } from "react"
import { Product, Brand, ProductType } from "@prisma/client"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { MoreHorizontal, Pencil, Trash, Filter } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { deleteGenericProduct } from "@/lib/generic-product-actions"
import { toast } from "sonner"

interface ProductListProps {
    products: (Product & { brand: Brand; productType: ProductType; productGroup: any | null })[]
    brands: Brand[]
    productTypes: (ProductType & { productGroups: any[] })[]
    onEdit: (product: any) => void
}

export function ProductList({ products, brands, productTypes, onEdit }: ProductListProps) {
    const [search, setSearch] = useState("")
    const [filterBrand, setFilterBrand] = useState("all")
    const [filterType, setFilterType] = useState("all")

    // Filter Logic
    const filteredProducts = products.filter(item => {
        const matchSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
            item.brand.name.toLowerCase().includes(search.toLowerCase())

        const matchBrand = filterBrand === "all" || item.brandId === filterBrand
        const matchType = filterType === "all" || item.productTypeId === filterType

        return matchSearch && matchBrand && matchType
    })

    const handleDelete = async (id: string) => {
        if (!confirm("Xóa sản phẩm này?")) return
        const res = await deleteGenericProduct(id)
        if (res.success) toast.success("Đã xóa sản phẩm")
        else toast.error("Có lỗi xảy ra")
    }

    return (
        <div className="space-y-4">
            {/* Filters Row */}
            <div className="flex flex-col sm:flex-row gap-4">
                <Input
                    placeholder="Tìm kiếm tên sản phẩm..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="sm:max-w-[300px]"
                />

                <Select value={filterBrand} onValueChange={setFilterBrand}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Thương hiệu" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tất cả thương hiệu</SelectItem>
                        {brands.map(b => (
                            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Loại sản phẩm" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tất cả loại</SelectItem>
                        {productTypes.map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <div className="ml-auto text-sm text-muted-foreground self-center">
                    Hiển thị {filteredProducts.length} kết quả
                </div>
            </div>

            {/* Table */}
            <div className="rounded-md border bg-white">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[80px]">Ảnh</TableHead>
                            <TableHead>Tên sản phẩm</TableHead>
                            <TableHead>Thương hiệu</TableHead>
                            <TableHead>Loại / Nhóm</TableHead>
                            <TableHead>Giá</TableHead>
                            <TableHead className="text-right">Thao tác</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredProducts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">Không tìm thấy sản phẩm nào.</TableCell>
                            </TableRow>
                        ) : (
                            filteredProducts.map((item) => (
                                <TableRow key={item.id} className="group cursor-pointer hover:bg-slate-50">
                                    <TableCell>
                                        <div className="h-10 w-10 rounded-md overflow-hidden bg-slate-100 border relative">
                                            {item.thumbnail ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={item.thumbnail} alt={item.name} className="obect-cover h-full w-full" />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">No Img</div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-medium">{item.name}</div>
                                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                            {(item as any).shortDescription || item.sku}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="font-normal">
                                            {item.brand.name}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-sm font-medium">{item.productType.name}</span>
                                            {item.productGroup && (
                                                <span className="text-xs text-muted-foreground bg-slate-100 px-1.5 py-0.5 rounded w-fit">
                                                    {item.productGroup.name}
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {item.price ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(item.price)) : "Liên hệ"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <span className="sr-only">Open menu</span>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Thao tác</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => onEdit(item)}>
                                                    <Pencil className="mr-2 h-4 w-4" /> Chỉnh sửa
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleDelete(item.id)} className="text-red-600">
                                                    <Trash className="mr-2 h-4 w-4" /> Xóa
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
