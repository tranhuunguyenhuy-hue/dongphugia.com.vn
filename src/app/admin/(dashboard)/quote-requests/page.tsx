import prisma from "@/lib/prisma"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { ClipboardList } from "lucide-react"
import { QuoteStatusButton } from "./quote-status-button"

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
    searchParams: Promise<{ status?: string }>
}

const STATUS_LABELS: Record<string, string> = {
    all: 'Tất cả',
    pending: 'Chờ xử lý',
    resolved: 'Đã xử lý',
    cancelled: 'Đã huỷ',
}

export default async function QuoteRequestsPage({ searchParams }: PageProps) {
    const sp = await searchParams
    const statusFilter = sp.status && sp.status !== 'all' ? sp.status : undefined

    const quotes = await prisma.quote_requests.findMany({
        where: statusFilter ? { status: statusFilter } : undefined,
        orderBy: { created_at: 'desc' },
        include: {
            quote_items: {
                include: { products: { select: { id: true, name: true } } },
            },
        },
    })

    const counts = await prisma.quote_requests.groupBy({
        by: ['status'],
        _count: { id: true },
    })
    const countMap = counts.reduce((acc, c) => ({ ...acc, [c.status]: c._count.id }), {} as Record<string, number>)
    const totalCount = quotes.length

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Quản lý báo giá</h1>
                <p className="text-sm text-muted-foreground mt-1">Danh sách yêu cầu báo giá từ khách hàng</p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 flex-wrap">
                {['all', 'pending', 'resolved', 'cancelled'].map((s) => {
                    const count = s === 'all'
                        ? Object.values(countMap).reduce((a, b) => a + b, 0)
                        : (countMap[s] || 0)
                    const isActive = (sp.status || 'all') === s
                    return (
                        <Link
                            key={s}
                            href={`/admin/quote-requests?status=${s}`}
                            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${isActive ? 'bg-primary text-white shadow-sm' : 'bg-white border border-[#E4EEF2] text-muted-foreground hover:bg-muted'}`}
                        >
                            {STATUS_LABELS[s]}
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'}`}>
                                {count}
                            </span>
                        </Link>
                    )
                })}
            </div>

            <Card className="overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b">
                    <CardTitle className="text-base flex items-center gap-2">
                        <ClipboardList className="h-4 w-4" />
                        {statusFilter ? STATUS_LABELS[statusFilter] : 'Tất cả'}
                        <span className="text-muted-foreground font-normal text-sm">({totalCount})</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/30 hover:bg-slate-50/30">
                                <TableHead>Khách hàng</TableHead>
                                <TableHead>SĐT</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Sản phẩm</TableHead>
                                <TableHead>Ghi chú</TableHead>
                                <TableHead>Ngày gửi</TableHead>
                                <TableHead>Trạng thái</TableHead>
                                <TableHead className="text-right">Thao tác</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {quotes.map((q) => (
                                <TableRow key={q.id} className="table-row-hover">
                                    <TableCell className="font-medium">{q.name}</TableCell>
                                    <TableCell>
                                        <a href={`tel:${q.phone}`} className="text-sm text-[#2E7A96] hover:underline font-medium">
                                            {q.phone}
                                        </a>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{q.email || '—'}</TableCell>
                                    <TableCell className="text-sm">
                                    {q.quote_items.length > 0 ? (
                            <span className="text-sm">
                                {q.quote_items.map(qi => qi.products.name).join(', ')}
                                {q.quote_items.length > 1 && (
                                    <span className="ml-1 text-xs text-muted-foreground">+{q.quote_items.length} SP</span>
                                )}
                            </span>
                        ) : '—'}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground max-w-[180px]">
                                        <span className="line-clamp-2">{q.message || '—'}</span>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground tabular-nums whitespace-nowrap">
                                        {q.created_at?.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) || '—'}
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant="secondary"
                                            className={
                                                q.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                                q.status === 'resolved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                                'bg-slate-100 text-slate-500'
                                            }
                                        >
                                            {STATUS_LABELS[q.status] || q.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <QuoteStatusButton id={q.id} currentStatus={q.status} />
                                    </TableCell>
                                </TableRow>
                            ))}
                            {quotes.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center text-muted-foreground py-16">
                                        <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                        <p>Không có yêu cầu báo giá nào</p>
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
