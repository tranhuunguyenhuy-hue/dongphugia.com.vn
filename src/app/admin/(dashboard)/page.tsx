import prisma from "@/lib/prisma"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
    ClipboardList, ArrowRight, TrendingUp, BookOpen, FolderKanban, Handshake, Image,
} from "lucide-react"
import { QuoteStatusButton } from "./quote-requests/quote-status-button"

export default async function AdminDashboard() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // LEO-366: Legacy product stats removed during DB restructure
    // Will be restored in Phase 3 with unified product schema
    const [
        pendingQuotes,
        todayQuotes,
        totalBlogPosts,
        totalPartners,
        recentPendingQuotes,
    ] = await Promise.all([
        prisma.quote_requests.count({ where: { status: 'pending' } }),
        prisma.quote_requests.count({ where: { created_at: { gte: today } } }),
        prisma.blog_posts.count().catch(() => 0),
        prisma.partners.count().catch(() => 0),
        prisma.quote_requests.findMany({
            where: { status: 'pending' },
            take: 5,
            orderBy: { created_at: 'desc' },
        }),
    ])

    const stats = [
        { label: "Báo giá chờ xử lý", value: pendingQuotes, href: "/admin/quote-requests", icon: ClipboardList, gradient: "stat-gradient-rose", iconColor: "text-rose-600", iconBg: "bg-rose-100" },
        { label: "Báo giá hôm nay", value: todayQuotes, href: "/admin/quote-requests", icon: ClipboardList, gradient: "stat-gradient-amber", iconColor: "text-amber-600", iconBg: "bg-amber-100" },
        { label: "Bài viết blog", value: totalBlogPosts, href: "/admin/blog/posts", icon: BookOpen, gradient: "stat-gradient-blue", iconColor: "text-blue-600", iconBg: "bg-blue-100" },
        { label: "Đối tác", value: totalPartners, href: "/admin/doi-tac", icon: Handshake, gradient: "stat-gradient-emerald", iconColor: "text-emerald-600", iconBg: "bg-emerald-100" },
    ]

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
                    <p className="text-sm text-muted-foreground mt-1">Tổng quan hệ thống quản lý Đông Phú Gia</p>
                </div>
            </div>

            {/* DB Restructure Notice */}
            <Card className="border-amber-200 bg-amber-50">
                <CardContent className="pt-6">
                    <p className="text-sm text-amber-800">
                        ⚠️ <strong>LEO-366:</strong> Hệ thống đang tái cấu trúc database. 
                        Quản lý sản phẩm tạm thời không khả dụng và sẽ được khôi phục sau khi migration hoàn tất.
                    </p>
                </CardContent>
            </Card>

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
                                    <TableHead>Email</TableHead>
                                    <TableHead>Thời gian</TableHead>
                                    <TableHead className="text-right">Thao tác</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recentPendingQuotes.map((q) => (
                                    <TableRow key={q.id} className="table-row-hover">
                                        <TableCell className="font-medium">{q.name}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{q.phone}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{q.email || '—'}</TableCell>
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
