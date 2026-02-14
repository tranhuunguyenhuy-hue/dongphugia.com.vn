"use client";

import { updateQuoteStatus, deleteQuoteRequest } from "@/lib/quote-admin-actions";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Trash2, ChevronDown, ChevronUp, FileText, Phone, Mail, User, Calendar, Box } from "lucide-react";
import { useState } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_MAP: Record<string, { label: string; color: string; badge: string }> = {
    PENDING: {
        label: "Chờ xử lý",
        color: "bg-yellow-50 text-yellow-700 border-yellow-200",
        badge: "warning"
    },
    CONTACTED: {
        label: "Đã liên hệ",
        color: "bg-blue-50 text-blue-700 border-blue-200",
        badge: "info"
    },
    DONE: {
        label: "Hoàn tất",
        color: "bg-green-50 text-green-700 border-green-200",
        badge: "success"
    },
};

export function QuoteDetailRow({ quote }: { quote: any }) {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <>
            <TableRow className="group hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <TableCell>
                    <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-full transition-colors", isExpanded ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground group-hover:bg-background")}>
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                        <div className="font-medium">
                            <div className="flex items-center gap-2">
                                <User className="h-3 w-3 text-muted-foreground" />
                                {quote.customerName}
                            </div>
                        </div>
                    </div>
                </TableCell>
                <TableCell>
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {quote.customerPhone}
                        </div>
                        {quote.customerEmail && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                {quote.customerEmail}
                            </div>
                        )}
                    </div>
                </TableCell>
                <TableCell>
                    <div className="flex items-center gap-2">
                        <Box className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{quote.items.length}</span> sản phẩm
                    </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        {new Date(quote.createdAt).toLocaleDateString("vi-VN", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                        })}
                    </div>
                    <div className="text-xs opacity-70 mt-1 pl-5">
                        {new Date(quote.createdAt).toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                    <QuoteStatusSelect
                        id={quote.id}
                        currentStatus={quote.status}
                    />
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                    <QuoteDeleteButton id={quote.id} />
                </TableCell>
            </TableRow>

            {isExpanded && (
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={6} className="p-0">
                        <div className="p-4 pl-14 grid gap-4">
                            <div className="rounded-lg border bg-background mt-2 overflow-hidden">
                                <div className="bg-muted/50 px-4 py-2 border-b text-xs font-medium text-muted-foreground flex justify-between">
                                    <span>Chi tiết yêu cầu</span>
                                    <span>ID: {quote.id}</span>
                                </div>
                                <div className="p-0">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-muted-foreground bg-muted/20">
                                            <tr>
                                                <th className="px-4 py-2 font-medium">Sản phẩm</th>
                                                <th className="px-4 py-2 font-medium w-[150px]">SKU</th>
                                                <th className="px-4 py-2 font-medium w-[100px] text-center">Số lượng</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {quote.items.map((item: any, idx: number) => (
                                                <tr key={item.id} className="border-b last:border-0 hover:bg-muted/10">
                                                    <td className="px-4 py-3">
                                                        <span className="font-medium">{item.product.name}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                                                        {item.product.sku || "—"}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <Badge variant="outline" className="font-mono">
                                                            x{item.quantity}
                                                        </Badge>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {quote.items.length > 0 && (
                                    <div className="bg-muted/20 px-4 py-3 border-t text-sm flex justify-between items-center">
                                        <span className="text-muted-foreground">Tổng số lượng:</span>
                                        <span className="font-bold">
                                            {quote.items.reduce((sum: number, item: any) => sum + item.quantity, 0)}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Note section could go here in future */}
                        </div>
                    </TableCell>
                </TableRow>
            )}
        </>
    );
}

export function QuoteStatusSelect({ id, currentStatus }: { id: string; currentStatus: string }) {
    const handleChange = async (value: string) => {
        const result = await updateQuoteStatus(id, value);
        if (result.success) {
            toast.success("Đã cập nhật trạng thái");
        } else {
            toast.error(result.error);
        }
    };

    const statusStyle = STATUS_MAP[currentStatus] || STATUS_MAP.PENDING;

    return (
        <Select defaultValue={currentStatus} onValueChange={handleChange}>
            <SelectTrigger className={cn("w-[140px] h-8 text-xs font-medium border-0 shadow-sm", statusStyle.color)}>
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="PENDING">
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-yellow-500" />
                        Chờ xử lý
                    </div>
                </SelectItem>
                <SelectItem value="CONTACTED">
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                        Đã liên hệ
                    </div>
                </SelectItem>
                <SelectItem value="DONE">
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                        Hoàn tất
                    </div>
                </SelectItem>
            </SelectContent>
        </Select>
    );
}

export function QuoteDeleteButton({ id }: { id: string }) {
    const handleDelete = async () => {
        const result = await deleteQuoteRequest(id);
        if (result.success) {
            toast.success("Đã xóa yêu cầu báo giá");
        } else {
            toast.error(result.error);
        }
    };

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Xóa yêu cầu báo giá?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Hành động này không thể hoàn tác. Yêu cầu báo giá sẽ bị xóa vĩnh viễn khỏi hệ thống.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Hủy</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                        Xóa vĩnh viễn
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export function StatusBadge({ status }: { status: string }) {
    const s = STATUS_MAP[status] || STATUS_MAP.PENDING;
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${s.color}`}>
            {s.label}
        </span>
    );
}
