import { getAdminProducts, getProductStats } from '@/lib/public-api-products'
import { getCategories } from '@/lib/cache'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Plus, Package2, Sparkles, Star, AlertTriangle } from 'lucide-react'
import { ProductsFilters } from './products-filters'
import { ProductActions } from './product-actions'

export const dynamic = 'force-dynamic'

interface PageProps {
    searchParams: Promise<{ search?: string; category_id?: string; is_active?: string; page?: string }>
}

export default async function AdminProductsPage({ searchParams }: PageProps) {
    const params = await searchParams
    const page = Number(params.page || 1)
    const category_id = params.category_id ? Number(params.category_id) : undefined
    const is_active = params.is_active === 'true' ? true : params.is_active === 'false' ? false : undefined

    const [{ products, total, totalPages }, stats, categories] = await Promise.all([
        getAdminProducts({ search: params.search, category_id, is_active, page, pageSize: 50 }),
        getProductStats(),
        getCategories(),
    ])

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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Sản phẩm</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Quản lý toàn bộ sản phẩm trong 5 danh mục
                    </p>
                </div>
                <Link href="/admin/products/new">
                    <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Thêm sản phẩm
                    </Button>
                </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Tổng SP', value: stats.total, icon: Package2, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Đang bán', value: stats.active, icon: Sparkles, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Nổi bật', value: stats.featured, icon: Star, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: 'Hết hàng', value: stats.outOfStock, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
                ].map(({ label, value, icon: Icon, color, bg }) => (
                    <Card key={label} className="border-none shadow-sm">
                        <CardContent className="p-5 flex items-center gap-4">
                            <div className={`p-2.5 rounded-full ${bg}`}>
                                <Icon className={`h-5 w-5 ${color}`} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{value.toLocaleString()}</p>
                                <p className="text-xs text-muted-foreground">{label}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Filters */}
            <ProductsFilters categories={categories} />

            {/* Table */}
            <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-neutral-50 hover:bg-neutral-50">
                            <TableHead className="w-[80px]">Ảnh</TableHead>
                            <TableHead>Tên / SKU</TableHead>
                            <TableHead>Danh mục</TableHead>
                            <TableHead>Giá</TableHead>
                            <TableHead>Tồn kho</TableHead>
                            <TableHead>Trạng thái</TableHead>
                            <TableHead className="w-[100px]">Hành động</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {products.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                                    <Package2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                                    Chưa có sản phẩm nào
                                </TableCell>
                            </TableRow>
                        ) : products.map(product => (
                            <TableRow key={product.id} className="hover:bg-neutral-50/80 group">
                                <TableCell>
                                    <div className="w-14 h-14 rounded-lg border bg-neutral-100 overflow-hidden">
                                        {product.image_main_url ? (
                                            <img
                                                src={product.image_main_url}
                                                alt={product.name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Package2 className="h-5 w-5 text-neutral-300" />
                                            </div>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Link href={`/admin/products/${product.id}`} className="hover:text-[#2E7A96] transition-colors">
                                        <p className="font-medium text-sm line-clamp-2">{product.name}</p>
                                    </Link>
                                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">{product.sku}</p>
                                </TableCell>
                                <TableCell>
                                    <span className="text-sm text-neutral-600">{product.categories.name}</span>
                                    {product.brands && (
                                        <p className="text-xs text-muted-foreground mt-0.5">{product.brands.name}</p>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <div className="space-y-0.5">
                                        <span className={`text-sm font-medium ${product.original_price && product.original_price > (product.price || 0) ? 'text-red-600' : ''}`}>
                                            {product.price
                                                ? `${product.price.toLocaleString('vi-VN')}đ`
                                                : product.price_display || 'Liên hệ'}
                                        </span>
                                        {product.original_price && product.original_price > (product.price || 0) && (
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-xs text-muted-foreground line-through">
                                                    {product.original_price.toLocaleString('vi-VN')}đ
                                                </span>
                                                <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded">
                                                    -{Math.round(((product.original_price - (product.price || 0)) / product.original_price) * 100)}%
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[product.stock_status] || 'bg-neutral-100 text-neutral-600'}`}>
                                        {statusLabel[product.stock_status] || product.stock_status}
                                    </span>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-1">
                                        <Badge variant={product.is_active ? 'default' : 'secondary'} className="text-xs w-fit">
                                            {product.is_active ? 'Hiển thị' : 'Ẩn'}
                                        </Badge>
                                        {product.is_featured && (
                                            <Badge className="text-xs w-fit bg-amber-100 text-amber-700 hover:bg-amber-100">
                                                Nổi bật
                                            </Badge>
                                        )}
                                        {product.is_new && (
                                            <Badge className="text-xs w-fit bg-purple-100 text-purple-700 hover:bg-purple-100">
                                                Mới
                                            </Badge>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <ProductActions
                                        id={product.id}
                                        isActive={product.is_active}
                                        isFeatured={product.is_featured}
                                        productName={product.name}
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Hiển thị {products.length} / {total} sản phẩm</span>
                    <div className="flex gap-2">
                        {page > 1 && (
                            <Link href={`/admin/products?page=${page - 1}`}>
                                <Button variant="outline" size="sm">← Trước</Button>
                            </Link>
                        )}
                        <span className="flex items-center px-3 text-sm">Trang {page}/{totalPages}</span>
                        {page < totalPages && (
                            <Link href={`/admin/products?page=${page + 1}`}>
                                <Button variant="outline" size="sm">Tiếp →</Button>
                            </Link>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
