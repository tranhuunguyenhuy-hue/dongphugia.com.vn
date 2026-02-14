"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitQuoteRequest } from "@/lib/quote-actions";
import { toast } from "sonner";
import { FileText, Loader2, CheckCircle2 } from "lucide-react";

interface QuoteDialogProps {
    productId: string;
    productName: string;
    trigger?: React.ReactNode;
}

export function QuoteDialog({ productId, productName, trigger }: QuoteDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [form, setForm] = useState({
        customerName: "",
        customerPhone: "",
        customerEmail: "",
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validate = () => {
        const errs: Record<string, string> = {};
        if (!form.customerName || form.customerName.trim().length < 2) {
            errs.customerName = "Vui lòng nhập họ tên";
        }
        const phoneClean = form.customerPhone.replace(/\s/g, "");
        if (!phoneClean || !/^(0|\+84)[0-9]{8,10}$/.test(phoneClean)) {
            errs.customerPhone = "Số điện thoại không hợp lệ";
        }
        if (form.customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customerEmail)) {
            errs.customerEmail = "Email không hợp lệ";
        }
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        setLoading(true);
        const result = await submitQuoteRequest({
            customerName: form.customerName,
            customerPhone: form.customerPhone,
            customerEmail: form.customerEmail || undefined,
            productId,
        });

        setLoading(false);

        if (result.success) {
            setSuccess(true);
            toast.success("Gửi yêu cầu báo giá thành công!", {
                description: "Nhân viên sẽ liên hệ bạn trong thời gian sớm nhất.",
            });
            setTimeout(() => {
                setOpen(false);
                setSuccess(false);
                setForm({ customerName: "", customerPhone: "", customerEmail: "" });
            }, 2000);
        } else {
            toast.error(result.error || "Đã có lỗi xảy ra");
        }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setSuccess(false); setErrors({}); } }}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button className="bg-[#15803d] hover:bg-[#14532d] text-white rounded-xl px-8 h-14 text-lg font-medium gap-2">
                        <FileText className="h-5 w-5" />
                        Yêu cầu báo giá
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-xl">Yêu cầu báo giá</DialogTitle>
                    <DialogDescription className="text-sm text-gray-500">
                        Sản phẩm: <span className="font-medium text-gray-700">{productName}</span>
                    </DialogDescription>
                </DialogHeader>

                {success ? (
                    <div className="flex flex-col items-center gap-4 py-8">
                        <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                            <CheckCircle2 className="h-8 w-8 text-[#15803d]" />
                        </div>
                        <p className="text-lg font-semibold text-gray-900">Đã gửi thành công!</p>
                        <p className="text-sm text-gray-500 text-center">
                            Nhân viên Đông Phú Gia sẽ liên hệ bạn trong thời gian sớm nhất.
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label htmlFor="customerName">
                                Họ và tên <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="customerName"
                                placeholder="Nguyễn Văn A"
                                value={form.customerName}
                                onChange={(e) => setForm((p) => ({ ...p, customerName: e.target.value }))}
                                className={errors.customerName ? "border-red-500" : ""}
                            />
                            {errors.customerName && (
                                <p className="text-xs text-red-500">{errors.customerName}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="customerPhone">
                                Số điện thoại <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="customerPhone"
                                type="tel"
                                placeholder="0912 345 678"
                                value={form.customerPhone}
                                onChange={(e) => setForm((p) => ({ ...p, customerPhone: e.target.value }))}
                                className={errors.customerPhone ? "border-red-500" : ""}
                            />
                            {errors.customerPhone && (
                                <p className="text-xs text-red-500">{errors.customerPhone}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="customerEmail">Email (không bắt buộc)</Label>
                            <Input
                                id="customerEmail"
                                type="email"
                                placeholder="email@example.com"
                                value={form.customerEmail}
                                onChange={(e) => setForm((p) => ({ ...p, customerEmail: e.target.value }))}
                                className={errors.customerEmail ? "border-red-500" : ""}
                            />
                            {errors.customerEmail && (
                                <p className="text-xs text-red-500">{errors.customerEmail}</p>
                            )}
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#15803d] hover:bg-[#14532d] text-white h-12 text-base font-medium rounded-xl"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Đang gửi...
                                </>
                            ) : (
                                "Xác nhận gửi yêu cầu"
                            )}
                        </Button>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
