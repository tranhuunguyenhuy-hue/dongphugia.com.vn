import prisma from "@/lib/prisma";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { QuoteStatusSelect, QuoteDeleteButton, StatusBadge } from "./quote-components";
import { FileText } from "lucide-react";

export default async function QuotesPage() {
    const quotes = await prisma.quoteRequest.findMany({
        orderBy: { createdAt: "desc" },
        include: {
            items: {
                include: {
                    product: {
                        select: { name: true, sku: true, slug: true },
                    },
                },
            },
        },
    });

    const pendingCount = quotes.filter((q) => q.status === "PENDING").length;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Quản lý Báo giá</h1>
                    <p className="text-muted-foreground">
                        {pendingCount > 0
                            ? `${pendingCount} yêu cầu chờ xử lý`
                            : "Không có yêu cầu mới"}
                    </p>
                </div>
            </div>

            <div className="rounded-md border bg-white">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Khách hàng</TableHead>
                            <TableHead>Liên hệ</TableHead>
                            <TableHead>Sản phẩm</TableHead>
                            <TableHead>Ngày gửi</TableHead>
                            <TableHead>Trạng thái</TableHead>
                            <TableHead className="w-[60px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {quotes.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={6}
                                    className="text-center h-32 text-muted-foreground"
                                >
                                    <div className="flex flex-col items-center gap-2">
                                        <FileText className="h-8 w-8 text-gray-300" />
                                        Chưa có yêu cầu báo giá nào.
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            quotes.map((quote) => (
                                <TableRow key={quote.id}>
                                    <TableCell>
                                        <p className="font-medium">{quote.customerName}</p>
                                    </TableCell>
                                    <TableCell>
                                        <p className="text-sm">{quote.customerPhone}</p>
                                        {quote.customerEmail && (
                                            <p className="text-xs text-muted-foreground">
                                                {quote.customerEmail}
                                            </p>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {quote.items.map((item) => (
                                            <div key={item.id} className="text-sm">
                                                <span className="font-medium">{item.product.sku || "—"}</span>
                                                <span className="text-muted-foreground ml-1">
                                                    {item.product.name}
                                                </span>
                                            </div>
                                        ))}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {new Date(quote.createdAt).toLocaleDateString("vi-VN", {
                                            day: "2-digit",
                                            month: "2-digit",
                                            year: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </TableCell>
                                    <TableCell>
                                        <QuoteStatusSelect
                                            id={quote.id}
                                            currentStatus={quote.status}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <QuoteDeleteButton id={quote.id} />
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
