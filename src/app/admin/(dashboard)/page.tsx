import prisma from "@/lib/prisma"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
    Package, FolderOpen, Layers, ClipboardList, ArrowRight, Plus, TrendingUp,
} from "lucide-react"
import { QuoteStatusButton } from "./quote-requests/quote-status-button"

export default async function AdminDashboard() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [
        totalProducts,
        totalPatternTypes,
        pendingQuotes,
        todayQuotes,
        recentProducts,
        recentPendingQuotes,
    ] = await Promise.all([
        prisma.products.count({ where: { is_active: true } }),
        prisma.pattern_types.count({ where: { is_active: true } }),
        prisma.quote_requests.count({ where: { status: 'pending' } }),
        prisma.quote_requests.count({ where: { created_at: { gte: today } } }),
        prisma.products.findMany({
            take: 10,
            orderBy: { created_at: 'desc' },
            include: {
                pattern_types: { select: { name: true } },
                collections: { select: { name: true } },
                sizes: { select: { label: true } },
                surfaces: { select: { name: true } },
            },
        }),
        prisma.quote_requests.findMany({
            where: { status: 'pending' },
            take: 5,
            orderBy: { created_at: 'desc' },
            include: {
                products: { select: { id: true, name: true, slug: true } },
            },
        }),
    ])

    const stats = [
        { label: "Sản phẩm đang bán", value: totalProducts, href: "/admin/products", icon: Package, gradient: "stat-gradient-blue", iconColor: "text-blue-600", iconBg: "bg-blue-100" },
        { label: "Kiểu vân hoạt động", value: totalPatternTypes, href: "/admin/pattern-types", icon: Layers, gradient: "stat-gradient-emerald", iconColor: "text-emerald-600", iconBg: "bg-emerald-100" },
        { label: "Báo giá chờ xử lý", value: pendingQuotes, href: "/admin/quote-requests", icon: ClipboardList, gradient: "stat-gradient-rose", iconColor: "text-rose-600", iconBg: "bg-rose-100" },
        { label: "Báo giá hôm nay", value: todayQuotes, href: "/admin/quote-requests", icon: FolderOpen, gradient: "stat-gradient-amber", iconColor: "text-amber-600", iconBg: "bg-amber-100" },
    ]

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
                    <p className="text-sm text-muted-foreground mt-1">Tổng quan hệ thống quản lý Đông Phú Gia</p>
                </div>
                <Button size="sm" className="press-effect" asChild>
                    <Link href="/admin/products/new">
                        <Plus className="mr-1.5 h-4 w-4" /> Thêm sản phẩm
                    </Link>
                </Button>
            </div>

            {/* Stat Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat) => {
                    const Icon = stat.icon
                    return (
                        <Link key={stat.label} href={stat.href} className="block">
                            <Card className={`${stat.gradient} border-0 card-hover cursor-pointer h-full`}>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium text-slate-600">{stat.label}</CardTitle>
                                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${stat.iconBg}`}>
                                        <Icon className={`h-4 w-4 ${stat.iconColor}`} />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl font-bold text-slate-800 tabular-nums">{stat.value}</div>
                                    <div className="flex items-center gap-1 mt-2">
                                        <TrendingUp className="h-3 w-3 text-emerald-600" />
                                        <p className="text-xs text-slate-500">Hiện tại</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    )
                })}
            </div>

            {/* Recent Products */}
            <Card className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between bg-slate-50/50 border-b">
                    <div>
                        <CardTitle className="text-base">Sản phẩm mới thêm</CardTitle>
                        <p className="text-sm text-muted-foreground mt-0.5">10 sản phẩm gần nhất</p>
                    </div>
                    <Button variant="outline" size="sm" className="press-effect" asChild>
                        <Link href="/admin/products">Xem tất cả <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link>
                    </Button>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/30 hover:bg-slate-50/30">
                                <TableHead>SKU</TableHead>
                                <TableHead>Tên sản phẩm</TableHead>
                                <TableHead>Kiểu vân</TableHead>
                                <TableHead>Bộ sưu tập</TableHead>
                                <TableHead>Trạng thái</TableHead>
                                <TableHead className="text-right">Ngày thêm</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {recentProducts.map((product) => (
                                <TableRow key={product.id} className="table-row-hover">
                                    <TableCell className="font-mono text-xs text-muted-foreground">{product.sku}</TableCell>
                                    <TableCell>
                                        <Link href={`/admin/products/${product.id}`} className="font-medium hover:text-primary transition-colors">
                                            {product.name}
                                        </Link>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{product.pattern_types?.name || '—'}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{product.collections?.name || '—'}</TableCell>
                                    <TableCell>
                                        <Badge variant={product.is_active ? "default" : "secondary"}
                                            className={product.is_active ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : ""}>
                                            {product.is_active ? "Hiển thị" : "Ẩn"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                                        {product.created_at?.toLocaleDateString('vi-VN') || '—'}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {recentProducts.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                                        Chưa có sản phẩm nào
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Pending Quotes */}
            {recentPendingQuotes.length > 0 && (
                <Card className="overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between bg-slate-50/50 border-b">
                        <div>
                            <CardTitle className="text-base flex items-center gap-2">
                                Báo giá chờ xử lý
                                {pendingQuotes > 0 && (
                                    <Badge variant="destructive" className="badge-pulse">{pendingQuotes}</Badge>
                                )}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground mt-0.5">5 yêu cầu mới nhất</p>
                        </div>
                        <Button variant="outline" size="sm" className="press-effect" asChild>
                            <Link href="/admin/quote-requests">Xem tất cả <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link>
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50/30 hover:bg-slate-50/30">
                                    <TableHead>Khách hàng</TableHead>
                                    <TableHead>SĐT</TableHead>
                                    <TableHead>Sản phẩm</TableHead>
                                    <TableHead>Thời gian</TableHead>
                                    <TableHead className="text-right">Thao tác</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recentPendingQuotes.map((q) => (
                                    <TableRow key={q.id} className="table-row-hover">
                                        <TableCell className="font-medium">{q.name}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{q.phone}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {q.products ? (
                                                <Link href={`/admin/products/${q.products.id}`} className="hover:text-primary transition-colors">
                                                    {q.products.name}
                                                </Link>
                                            ) : '—'}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {q.created_at?.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) || '—'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <QuoteStatusButton id={q.id} currentStatus="pending" />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
