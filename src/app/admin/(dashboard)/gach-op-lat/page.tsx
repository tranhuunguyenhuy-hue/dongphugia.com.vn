import prisma from "@/lib/prisma"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { PlusCircle, Search, Package, MoreHorizontal } from "lucide-react"
import TileProductActions from "./tile-product-actions"

interface TilePageProps {
    searchParams: Promise<{ search?: string; type?: string }>
}

export default async function TileProductsPage({ searchParams }: TilePageProps) {
    const params = await searchParams
    const search = params.search || ""
    const typeFilter = params.type || "all"

    // Get the Gạch ốp lát category
    const tileCategory = await prisma.category.findUnique({
        where: { slug: "gach-op-lat" },
    })

    if (!tileCategory) {
        return <div>Không tìm thấy danh mục Gạch ốp lát</div>
    }

    // Get all sub-categories for tabs
    const subCategories = await prisma.productType.findMany({
        where: { categoryId: tileCategory.id },
        orderBy: { name: "asc" },
    })

    // Build product query
    const whereClause: any = {
        categoryId: tileCategory.id,
    }

    if (search) {
        whereClause.OR = [
            { name: { contains: search } },
            { sku: { contains: search } },
        ]
    }

    if (typeFilter !== "all") {
        whereClause.productTypeId = typeFilter
    }

    // Get products grouped by collection
    const products = await prisma.product.findMany({
        where: whereClause,
        include: {
            productType: { select: { name: true } },
            collection: { select: { id: true, name: true } },
        },
        orderBy: [
            { collection: { name: "asc" } },
            { name: "asc" },
        ],
    })

    // Get collections with product counts (for the current filter)
    const collections = await prisma.collection.findMany({
        where: {
            productType: { categoryId: tileCategory.id },
            ...(typeFilter !== "all" ? { productTypeId: typeFilter } : {}),
        },
        include: {
            productType: { select: { name: true } },
            _count: { select: { products: true } },
        },
        orderBy: { name: "asc" },
    })

    // Group products by collection
    const grouped: Record<string, typeof products> = {}
    const uncollected: typeof products = []

    for (const product of products) {
        if (product.collection) {
            if (!grouped[product.collection.id]) {
                grouped[product.collection.id] = []
            }
            grouped[product.collection.id].push(product)
        } else {
            uncollected.push(product)
        }
    }

    // Parse specs safely
    function parseSpecs(specs: string | null): Record<string, string> {
        if (!specs) return {}
        try { return JSON.parse(specs) } catch { return {} }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Gạch ốp lát</h1>
                    <p className="text-muted-foreground">{products.length} sản phẩm</p>
                </div>
                <Button asChild>
                    <Link href="/admin/gach-op-lat/new">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Thêm sản phẩm
                    </Link>
                </Button>
            </div>

            {/* Search */}
            <form className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    name="search"
                    placeholder="Tìm theo tên hoặc SKU..."
                    defaultValue={search}
                    className="pl-9"
                />
                {typeFilter !== "all" && (
                    <input type="hidden" name="type" value={typeFilter} />
                )}
            </form>

            {/* Tabs for sub-categories */}
            <Tabs defaultValue={typeFilter}>
                <TabsList>
                    <TabsTrigger value="all" asChild>
                        <Link href={`/admin/gach-op-lat${search ? `?search=${search}` : ""}`}>
                            Tất cả
                        </Link>
                    </TabsTrigger>
                    {subCategories.map((sub) => (
                        <TabsTrigger key={sub.id} value={sub.id} asChild>
                            <Link href={`/admin/gach-op-lat?type=${sub.id}${search ? `&search=${search}` : ""}`}>
                                {sub.name.replace("Gạch ", "")}
                            </Link>
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>

            {/* Products grouped by BST */}
            {collections.map((col) => {
                const colProducts = grouped[col.id] || []
                if (colProducts.length === 0 && search) return null

                return (
                    <Card key={col.id}>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <CardTitle className="text-base">
                                        {col.name}
                                    </CardTitle>
                                    <Badge variant="secondary" className="text-xs">
                                        {colProducts.length} SP
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                        {col.productType?.name}
                                    </span>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {colProducts.length > 0 ? (
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
                                        {colProducts.map((product) => {
                                            const specs = parseSpecs(product.specs)
                                            return (
                                                <TableRow key={product.id}>
                                                    <TableCell>
                                                        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                                                            {product.images && product.images !== "[]" ? (
                                                                <img
                                                                    src={JSON.parse(product.images)[0]}
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
                                                    <TableCell className="text-sm">{specs.surface || "—"}</TableCell>
                                                    <TableCell className="text-sm">{specs.dimensions || "—"}</TableCell>
                                                    <TableCell className="text-sm">{specs.origin || "—"}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={product.isPublished ? "default" : "secondary"}>
                                                            {product.isPublished ? "Hiển thị" : "Nháp"}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <TileProductActions productId={product.id} />
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                    Chưa có sản phẩm trong bộ sưu tập này
                                </p>
                            )}
                        </CardContent>
                    </Card>
                )
            })}

            {/* Uncollected products */}
            {uncollected.length > 0 && (
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
                                {uncollected.map((product) => {
                                    const specs = parseSpecs(product.specs)
                                    return (
                                        <TableRow key={product.id}>
                                            <TableCell>
                                                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                                                    <Package className="h-4 w-4 text-muted-foreground" />
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-medium">{product.name}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{product.sku || "—"}</TableCell>
                                            <TableCell className="text-sm">{specs.surface || "—"}</TableCell>
                                            <TableCell className="text-sm">{specs.dimensions || "—"}</TableCell>
                                            <TableCell className="text-sm">{specs.origin || "—"}</TableCell>
                                            <TableCell>
                                                <Badge variant={product.isPublished ? "default" : "secondary"}>
                                                    {product.isPublished ? "Hiển thị" : "Nháp"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <TileProductActions productId={product.id} />
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* Empty state */}
            {products.length === 0 && (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <Package className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-1">Chưa có sản phẩm gạch</h3>
                        <p className="text-sm text-muted-foreground mb-4">Bắt đầu thêm sản phẩm gạch ốp lát đầu tiên</p>
                        <Button asChild>
                            <Link href="/admin/gach-op-lat/new">
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Thêm sản phẩm
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
