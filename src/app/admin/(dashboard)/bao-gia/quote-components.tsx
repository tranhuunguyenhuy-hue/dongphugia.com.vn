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
import { Trash2 } from "lucide-react";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
    PENDING: { label: "Chờ xử lý", color: "bg-yellow-100 text-yellow-800" },
    CONTACTED: { label: "Đã liên hệ", color: "bg-blue-100 text-blue-800" },
    DONE: { label: "Hoàn tất", color: "bg-green-100 text-green-800" },
};

export function QuoteStatusSelect({ id, currentStatus }: { id: string; currentStatus: string }) {
    const handleChange = async (value: string) => {
        const result = await updateQuoteStatus(id, value);
        if (result.success) {
            toast.success("Đã cập nhật trạng thái");
        } else {
            toast.error(result.error);
        }
    };

    return (
        <Select defaultValue={currentStatus} onValueChange={handleChange}>
            <SelectTrigger className="w-[140px]">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="PENDING">Chờ xử lý</SelectItem>
                <SelectItem value="CONTACTED">Đã liên hệ</SelectItem>
                <SelectItem value="DONE">Hoàn tất</SelectItem>
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
                <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Xóa yêu cầu báo giá?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Hành động này không thể hoàn tác. Yêu cầu báo giá sẽ bị xóa vĩnh viễn.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Hủy</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                        Xóa
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export function StatusBadge({ status }: { status: string }) {
    const s = STATUS_MAP[status] || STATUS_MAP.PENDING;
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
            {s.label}
        </span>
    );
}
