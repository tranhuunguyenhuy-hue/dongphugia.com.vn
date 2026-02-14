import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { PlusCircle } from "lucide-react"
import Link from "next/link"
import prisma from "@/lib/prisma"
import ProductActions from "./product-actions"

export default async function ProductsPage() {
    const products = await prisma.product.findMany({
        include: {
            category: true,
            brand: true,
            productType: true,
            collection: true,
        },
        orderBy: {
            updatedAt: 'desc'
        }
    })

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">Sản phẩm</h1>
                <Button asChild>
                    <Link href="/admin/products/new">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Thêm sản phẩm
                    </Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Quản lý sản phẩm</CardTitle>
                    <CardDescription>
                        Xem và quản lý danh sách sản phẩm.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tên</TableHead>
                                <TableHead>SKU</TableHead>
                                <TableHead>Phân loại</TableHead>
                                <TableHead>Bộ sưu tập</TableHead>
                                <TableHead>Giá</TableHead>
                                <TableHead>Trạng thái</TableHead>
                                <TableHead className="text-right">Thao tác</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {products.map((product) => (
                                <TableRow key={product.id}>
                                    <TableCell className="font-medium max-w-[200px] truncate">{product.name}</TableCell>
                                    <TableCell className="text-muted-foreground text-sm">{product.sku || '—'}</TableCell>
                                    <TableCell className="text-sm">{product.productType?.name || product.category?.name || '—'}</TableCell>
                                    <TableCell className="text-sm">{product.collection?.name || '—'}</TableCell>
                                    <TableCell>
                                        {product.showPrice && product.price
                                            ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(product.price))
                                            : <span className="text-muted-foreground text-xs">Liên hệ</span>
                                        }
                                    </TableCell>
                                    <TableCell>
                                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${product.isPublished ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                            {product.isPublished ? 'Hiển thị' : 'Nháp'}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <ProductActions productId={product.id} />
                                    </TableCell>
                                </TableRow>
                            ))}
                            {products.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                        Chưa có sản phẩm nào
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
