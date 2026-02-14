import prisma from "@/lib/prisma"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { PlusCircle, Package, ArrowLeft } from "lucide-react"
import TileProductActions from "../../tile-product-actions"
import CollectionDialog from "../../collection-dialog"
import CollectionActions from "../../collection-actions"

interface SubCategoryPageProps {
    params: Promise<{ slug: string }>
}

export default async function SubCategoryPage({ params }: SubCategoryPageProps) {
    const { slug } = await params

    // Find the product type (sub-category) by slug
    const productType = await prisma.productType.findUnique({
        where: { slug },
        include: { category: true },
    })

    if (!productType || productType.category.slug !== "gach-op-lat") {
        notFound()
    }

    // Get collections with products for this sub-category
    const collections = await prisma.collection.findMany({
        where: { productTypeId: productType.id },
        include: {
            products: {
                include: {
                    productType: { select: { name: true } },
                },
                orderBy: { name: "asc" },
            },
            _count: { select: { products: true } },
        },
        orderBy: { name: "asc" },
    })

    // Get uncollected products (products in this sub-category but no collection)
    const uncollectedProducts = await prisma.product.findMany({
        where: {
            productTypeId: productType.id,
            collectionId: null,
        },
        orderBy: { name: "asc" },
    })

    const totalProducts = collections.reduce((sum, c) => sum + c._count.products, 0) + uncollectedProducts.length

    return (
        <div className="space-y-6">
            {/* Header with breadcrumb */}
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Link href="/admin/gach-op-lat" className="hover:text-foreground transition-colors flex items-center gap-1">
                            <ArrowLeft className="h-3 w-3" />
                            Gạch ốp lát
                        </Link>
                        <span>/</span>
                        <span className="text-foreground font-medium">{productType.name}</span>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">{productType.name}</h1>
                    <p className="text-muted-foreground">
                        {collections.length} bộ sưu tập · {totalProducts} sản phẩm
                    </p>
                </div>
                <CollectionDialog productTypeId={productType.id} productTypeName={productType.name} />
            </div>

            {/* Collections with products */}
            {collections.map((col) => (
                <Card key={col.id}>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {col.image && (
                                    <img
                                        src={col.image}
                                        alt={col.name}
                                        className="h-10 w-10 rounded-lg object-cover"
                                    />
                                )}
                                <div>
                                    <CardTitle className="text-base">{col.name}</CardTitle>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {col._count.products} sản phẩm
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button asChild size="sm" variant="outline">
                                    <Link href={`/admin/gach-op-lat/new?collectionId=${col.id}&productTypeId=${productType.id}`}>
                                        <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
                                        Thêm sản phẩm
                                    </Link>
                                </Button>
                                <CollectionActions collectionId={col.id} collectionName={col.name} productTypeId={productType.id} productTypeName={productType.name} currentImage={col.image} />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {col.products.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[50px]">Ảnh</TableHead>
                                        <TableHead>Tên</TableHead>
                                        <TableHead>SKU</TableHead>
                                        <TableHead>Bề mặt</TableHead>
                                        <TableHead>Kích thước</TableHead>
                                        <TableHead>Xuất xứ</TableHead>
                                        <TableHead>Trạng thái</TableHead>
                                        <TableHead className="text-right">Thao tác</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {col.products.map((product) => (
                                        <TableRow key={product.id}>
                                            <TableCell>
                                                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                                                    {product.thumbnail ? (
                                                        <img
                                                            src={product.thumbnail}
                                                            alt={product.name}
                                                            className="h-full w-full object-cover"
                                                        />
                                                    ) : (
                                                        <Package className="h-4 w-4 text-muted-foreground" />
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-medium">{product.name}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{product.sku || "—"}</TableCell>
                                            <TableCell className="text-sm">{product.surface || "—"}</TableCell>
                                            <TableCell className="text-sm">{product.dimensions || "—"}</TableCell>
                                            <TableCell className="text-sm">{product.origin || "—"}</TableCell>
                                            <TableCell>
                                                <Badge variant={product.isPublished ? "default" : "secondary"}>
                                                    {product.isPublished ? "Hiển thị" : "Nháp"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <TileProductActions productId={product.id} />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                <Package className="h-8 w-8 text-muted-foreground mb-3" />
                                <p className="text-sm text-muted-foreground mb-3">
                                    Chưa có sản phẩm trong bộ sưu tập này
                                </p>
                                <Button asChild size="sm">
                                    <Link href={`/admin/gach-op-lat/new?collectionId=${col.id}&productTypeId=${productType.id}`}>
                                        <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
                                        Thêm sản phẩm cho bộ sưu tập
                                    </Link>
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            ))}

            {/* Uncollected products */}
            {uncollectedProducts.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base text-muted-foreground">
                            Chưa phân bộ sưu tập
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]">Ảnh</TableHead>
                                    <TableHead>Tên</TableHead>
                                    <TableHead>SKU</TableHead>
                                    <TableHead>Bề mặt</TableHead>
                                    <TableHead>Kích thước</TableHead>
                                    <TableHead>Xuất xứ</TableHead>
                                    <TableHead>Trạng thái</TableHead>
                                    <TableHead className="text-right">Thao tác</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {uncollectedProducts.map((product) => (
                                    <TableRow key={product.id}>
                                        <TableCell>
                                            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                                                <Package className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium">{product.name}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{product.sku || "—"}</TableCell>
                                        <TableCell className="text-sm">{product.surface || "—"}</TableCell>
                                        <TableCell className="text-sm">{product.dimensions || "—"}</TableCell>
                                        <TableCell className="text-sm">{product.origin || "—"}</TableCell>
                                        <TableCell>
                                            <Badge variant={product.isPublished ? "default" : "secondary"}>
                                                {product.isPublished ? "Hiển thị" : "Nháp"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <TileProductActions productId={product.id} />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* Empty state */}
            {collections.length === 0 && uncollectedProducts.length === 0 && (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <Package className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-1">Chưa có bộ sưu tập</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            Bắt đầu bằng cách tạo bộ sưu tập đầu tiên cho {productType.name}
                        </p>
                        <CollectionDialog productTypeId={productType.id} productTypeName={productType.name} />
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
