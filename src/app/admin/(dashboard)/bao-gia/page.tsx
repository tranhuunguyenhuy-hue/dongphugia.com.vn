import prisma from "@/lib/prisma";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { QuoteDetailRow } from "./quote-components";
import { FileText, Clock, CheckCircle2, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function QuotesPage() {
    const [quotes, totalQuotes, pendingCount, contactedCount, doneCount] = await Promise.all([
        prisma.quoteRequest.findMany({
            orderBy: { createdAt: "desc" },
            take: 20,
            include: {
                items: {
                    include: {
                        product: {
                            select: { name: true, sku: true, slug: true },
                        },
                    },
                },
            },
        }),
        prisma.quoteRequest.count(),
        prisma.quoteRequest.count({ where: { status: "PENDING" } }),
        prisma.quoteRequest.count({ where: { status: "CONTACTED" } }),
        prisma.quoteRequest.count({ where: { status: "DONE" } }),
    ]) as [any[], number, number, number, number];

    // Stats are now fetched directly from DB


    return (
        <div className="space-y-6 fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Quản lý Báo giá</h2>
                    <p className="text-sm text-muted-foreground">
                        Yêu cầu báo giá từ khách hàng
                    </p>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tổng yêu cầu</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalQuotes}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Chờ xử lý</CardTitle>
                        <Clock className="h-4 w-4 text-yellow-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Đã liên hệ</CardTitle>
                        <MessageSquare className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{contactedCount}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Hoàn tất</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{doneCount}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="rounded-md border bg-white shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead className="w-[200px]">Khách hàng</TableHead>
                            <TableHead className="w-[250px]">Liên hệ</TableHead>
                            <TableHead className="w-[150px]">Sản phẩm</TableHead>
                            <TableHead className="w-[180px]">Thời gian</TableHead>
                            <TableHead>Trạng thái</TableHead>
                            <TableHead className="w-[60px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {quotes.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={7}
                                    className="text-center h-[300px]"
                                >
                                    <div className="flex flex-col items-center justify-center space-y-2">
                                        <div className="p-4 rounded-full bg-muted">
                                            <FileText className="h-8 w-8 text-muted-foreground" />
                                        </div>
                                        <p className="font-medium text-lg">Chưa có yêu cầu nào</p>
                                        <p className="text-sm text-muted-foreground">Yêu cầu báo giá từ khách hàng sẽ xuất hiện ở đây</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            quotes.map((quote) => (
                                <QuoteDetailRow key={quote.id} quote={quote} />
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
