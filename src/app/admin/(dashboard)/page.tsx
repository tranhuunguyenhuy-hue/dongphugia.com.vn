import prisma from "@/lib/prisma"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
    Package, FolderTree, FileText, ArrowRight, Plus,
    TrendingUp, ClipboardList, BrickWall, ShowerHead,
    CookingPot, Droplets, TreePine,
} from "lucide-react"
import Image from "next/image"

// Stat card configurations with unique styles
const statStyles = [
    { gradient: "stat-gradient-blue", iconColor: "text-blue-600", iconBg: "bg-blue-100", icon: Package },
    { gradient: "stat-gradient-orange", iconColor: "text-orange-600", iconBg: "bg-orange-100", icon: ClipboardList },
    { gradient: "stat-gradient-emerald", iconColor: "text-emerald-600", iconBg: "bg-emerald-100", icon: BrickWall },
    { gradient: "stat-gradient-cyan", iconColor: "text-cyan-600", iconBg: "bg-cyan-100", icon: TreePine },
    { gradient: "stat-gradient-purple", iconColor: "text-purple-600", iconBg: "bg-purple-100", icon: Droplets },
    { gradient: "stat-gradient-rose", iconColor: "text-rose-600", iconBg: "bg-rose-100", icon: CookingPot },
    { gradient: "stat-gradient-amber", iconColor: "text-amber-600", iconBg: "bg-amber-100", icon: ShowerHead },
]

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
            take: 8,
            orderBy: { updatedAt: "desc" },
            include: {
                category: { select: { name: true } },
                productType: { select: { name: true } },
                collection: { select: { name: true } },
            },
        }),
    ])

    // Construct Stats
    const stats: { label: string; value: number; href: string; subtitle: string }[] = [
        {
            label: "Tổng sản phẩm",
            value: productCount,
            href: "/admin/gach-op-lat",
            subtitle: "Sản phẩm hiện có"
        },
        {
            label: "Yêu cầu báo giá",
            value: pendingQuotes,
            href: "/admin/bao-gia",
            subtitle: "Đang chờ xử lý"
        },
    ]

    categories.forEach(cat => {
        const childCount = cat.children.reduce((acc, child) => acc + child._count.products, 0)
        const total = cat._count.products + childCount
        stats.push({
            label: cat.name,
            value: total,
            href: `/admin/${cat.slug}`,
            subtitle: "Sản phẩm"
        })
    })

    return (
        <div className="space-y-8">
            {/* Page header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Tổng quan hệ thống quản lý Đông Phú Gia
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button size="sm" className="press-effect" asChild>
                        <Link href="/admin/gach-op-lat">
                            <Plus className="mr-1.5 h-4 w-4" />
                            Thêm sản phẩm
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Stats Grid — Gradient Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat, index) => {
                    const style = statStyles[index % statStyles.length]
                    const Icon = style.icon
                    return (
                        <Link key={index} href={stat.href} className="block">
                            <Card className={`${style.gradient} border-0 card-hover cursor-pointer h-full overflow-hidden relative`}>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium text-slate-600 truncate" title={stat.label}>
                                        {stat.label}
                                    </CardTitle>
                                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${style.iconBg}`}>
                                        <Icon className={`h-4 w-4 ${style.iconColor}`} />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl font-bold text-slate-800 tabular-nums">
                                        {stat.value}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-2">
                                        <TrendingUp className="h-3 w-3 text-emerald-600" />
                                        <p className="text-xs text-slate-500">
                                            {stat.subtitle}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    )
                })}
            </div>

            {/* Quick Actions */}
            <div className="grid gap-4 sm:grid-cols-3">
                <Link href="/admin/gach-op-lat" className="block">
                    <Card className="card-hover cursor-pointer border-dashed border-2 hover:border-primary/40 transition-colors">
                        <CardContent className="flex items-center gap-4 p-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-700">
                                <Package className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold">Quản lý sản phẩm</p>
                                <p className="text-xs text-muted-foreground">Thêm, sửa, xoá sản phẩm</p>
                            </div>
                        </CardContent>
                    </Card>
                </Link>
                <Link href="/admin/banners" className="block">
                    <Card className="card-hover cursor-pointer border-dashed border-2 hover:border-primary/40 transition-colors">
                        <CardContent className="flex items-center gap-4 p-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                                <FolderTree className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold">Quản lý Banner</p>
                                <p className="text-xs text-muted-foreground">Cập nhật hình ảnh trang chủ</p>
                            </div>
                        </CardContent>
                    </Card>
                </Link>
                <Link href="/admin/bao-gia" className="block">
                    <Card className="card-hover cursor-pointer border-dashed border-2 hover:border-primary/40 transition-colors">
                        <CardContent className="flex items-center gap-4 p-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
                                <FileText className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold">Yêu cầu báo giá</p>
                                <p className="text-xs text-muted-foreground">Xem và phản hồi báo giá</p>
                            </div>
                        </CardContent>
                    </Card>
                </Link>
            </div>

            {/* Recent products — Enhanced Table */}
            <Card className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between bg-slate-50/50 border-b">
                    <div>
                        <CardTitle className="text-base">Cập nhật gần đây</CardTitle>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {recentProducts.length} sản phẩm được cập nhật mới nhất
                        </p>
                    </div>
                    <Button variant="outline" size="sm" className="press-effect" asChild>
                        <Link href="/admin/gach-op-lat">
                            Xem tất cả <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                        </Link>
                    </Button>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/30 hover:bg-slate-50/30">
                                <TableHead className="w-[320px]">Sản phẩm</TableHead>
                                <TableHead>Danh mục</TableHead>
                                <TableHead>Phân loại</TableHead>
                                <TableHead>BST</TableHead>
                                <TableHead>Trạng thái</TableHead>
                                <TableHead className="text-right">Ngày</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {recentProducts.map((product) => (
                                <TableRow key={product.id} className="table-row-hover group">
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                                                {product.thumbnail ? (
                                                    <Image
                                                        src={product.thumbnail}
                                                        alt={product.name}
                                                        width={40}
                                                        height={40}
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <Package className="h-4 w-4 text-muted-foreground" />
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                                                    {product.name}
                                                </p>
                                                {product.sku && (
                                                    <p className="text-xs text-muted-foreground font-mono">{product.sku}</p>
                                                )}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{product.category.name}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{product.productType?.name || "—"}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{product.collection?.name || "—"}</TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={product.isPublished ? "default" : "secondary"}
                                            className={product.isPublished
                                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                                                : "bg-slate-100 text-slate-500"
                                            }
                                        >
                                            {product.isPublished ? "Hiển thị" : "Nháp"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                                        {product.updatedAt.toLocaleDateString("vi-VN")}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {recentProducts.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                                        <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                        <p>Chưa có sản phẩm nào</p>
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
