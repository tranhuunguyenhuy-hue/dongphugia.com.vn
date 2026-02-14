import prisma from "@/lib/prisma"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Package, FolderTree, FileText, ArrowRight } from "lucide-react"

export default async function AdminDashboard() {
    // Fetch Data
    const [productCount, pendingQuotes, categories, recentProducts] = await Promise.all([
        prisma.product.count(),
        prisma.quoteRequest.count({ where: { status: "PENDING" } }),
        prisma.category.findMany({
            where: { parentId: null },
            take: 5,
            orderBy: { name: 'asc' },
            include: {
                _count: { select: { products: true } },
                children: {
                    include: {
                        _count: { select: { products: true } }
                    }
                }
            }
        }),
        prisma.product.findMany({
            take: 5,
            orderBy: { updatedAt: "desc" },
            include: {
                category: { select: { name: true } },
                productType: { select: { name: true } },
                collection: { select: { name: true } },
            },
        }),
    ])

    // Construct Stats
    const stats: { label: string; value: number; icon: any; href: string; color: string }[] = [
        // 1. Total Products
        {
            label: "Tổng sản phẩm",
            value: productCount,
            icon: Package,
            href: "/admin/gach-op-lat",
            color: "text-blue-600"
        },
        // 2. Pending Quotes
        {
            label: "Yêu cầu báo giá",
            value: pendingQuotes,
            icon: FileText,
            href: "/admin/bao-gia", // Assuming quote route
            color: "text-orange-600"
        },
    ]

    // 3-7. Categories
    categories.forEach(cat => {
        // Calculate total products (direct + children)
        // Note: products usually belong to sub-categories (children), so we sum them up
        const childCount = cat.children.reduce((acc, child) => acc + child._count.products, 0)
        const total = cat._count.products + childCount

        stats.push({
            label: cat.name,
            value: total,
            icon: FolderTree,
            href: `/admin/${cat.slug}`,
            color: "text-emerald-600"
        })
    })

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
                    <p className="text-muted-foreground">Tổng quan hệ thống quản lý Đông Phú Gia</p>
                </div>
                {/* Removed Create Button as requested */}
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat, index) => {
                    const Icon = stat.icon
                    return (
                        <Link key={index} href={stat.href} className="block">
                            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground truncate" title={stat.label}>
                                        {stat.label}
                                    </CardTitle>
                                    <Icon className={`h-4 w-4 ${stat.color}`} />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{stat.value}</div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {stat.label === "Yêu cầu báo giá" ? "Đang chờ xử lý" : "Sản phẩm hiện có"}
                                    </p>
                                </CardContent>
                            </Card>
                        </Link>
                    )
                })}
            </div>

            {/* Recent products */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Cập nhật gần đây</CardTitle>
                        <CardDescription>5 sản phẩm được cập nhật mới nhất</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/admin/gach-op-lat">
                            Xem tất cả <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Sản phẩm</TableHead>
                                <TableHead>Danh mục</TableHead>
                                <TableHead>Phân loại</TableHead>
                                <TableHead>BST</TableHead>
                                <TableHead>Trạng thái</TableHead>
                                <TableHead className="text-right">Ngày</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {recentProducts.map((product) => (
                                <TableRow key={product.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                                                <Package className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm">{product.name}</p>
                                                {product.sku && (
                                                    <p className="text-xs text-muted-foreground">{product.sku}</p>
                                                )}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm">{product.category.name}</TableCell>
                                    <TableCell className="text-sm">{product.productType?.name || "—"}</TableCell>
                                    <TableCell className="text-sm">{product.collection?.name || "—"}</TableCell>
                                    <TableCell>
                                        <Badge variant={product.isPublished ? "default" : "secondary"}>
                                            {product.isPublished ? "Hiển thị" : "Nháp"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right text-sm text-muted-foreground">
                                        {product.updatedAt.toLocaleDateString("vi-VN")}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {recentProducts.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
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
