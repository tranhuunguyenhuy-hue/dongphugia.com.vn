"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Phone, CheckCircle2, Minus, Plus, ShoppingCart, MessageSquareText, ShoppingBag } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { useCartStore } from "@/lib/cart-store";
import { toast } from "sonner";

interface ProductCTAProps {
    productId: number;
    productSku: string;
    productName: string;
    price: number | null;
    priceDisplay?: string | null;
    imageUrl?: string | null;
    categorySlug: string;
    subcategorySlug?: string | null;
    brandName?: string | null;
    slug: string;
}

export function ProductCTA({
    productId,
    productSku,
    productName,
    price,
    priceDisplay,
    imageUrl,
    categorySlug,
    subcategorySlug,
    brandName,
    slug,
}: ProductCTAProps) {
    const hasPrice = price !== null && price > 0;

    const [isOpen, setIsOpen] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [quantity, setQuantity] = useState(1);

    const addItem = useCartStore((s) => s.addItem);

    const handleAddToCart = () => {
        addItem({
            productId,
            sku: productSku,
            name: productName,
            slug,
            categorySlug,
            subcategorySlug,
            price,
            priceDisplay: priceDisplay ?? null,
            imageUrl: imageUrl ?? null,
            brandName: brandName ?? null,
            quantity,
        });
        toast.success("Đã thêm vào giỏ hàng!", {
            description: productName,
            duration: 2500,
        });
    };

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        const form = e.currentTarget;
        const data = new FormData(form);

        try {
            const res = await fetch("/api/quote-requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: data.get("customerName"),
                    phone: data.get("customerPhone"),
                    message: `Yêu cầu tư vấn/đặt hàng cho sản phẩm: ${productName} (SKU: ${productSku})`,
                    products: [
                        {
                            product_id: productId,
                            quantity: hasPrice ? quantity : 1,
                        }
                    ]
                }),
            });

            const result = await res.json();
            if (result.success) {
                setIsSuccess(true);
            } else {
                toast.error("Không thể gửi yêu cầu", {
                    description: result.error || result.message || "Vui lòng kiểm tra lại thông tin."
                });
            }
        } catch (error) {
            toast.error("Lỗi kết nối", {
                description: "Đã có lỗi xảy ra. Vui lòng thử lại sau."
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetState = () => {
        setIsOpen(false);
        setTimeout(() => setIsSuccess(false), 300);
    };

    const handleQuantityChange = (delta: number) => {
        const newQty = quantity + delta;
        if (newQty >= 1 && newQty <= 99) {
            setQuantity(newQty);
        }
    };

    const totalPrice = (price || 0) * quantity;

    return (
        <div className="flex flex-col gap-3 pt-4">
            {/* Row 1: Add to Cart + Quote/Order */}
            <div className="flex gap-3">
                {/* Add to Cart — primary if has price */}
                {hasPrice && (
                    <Button
                        onClick={handleAddToCart}
                        className="flex-1 h-12 bg-brand-500 hover:bg-brand-600 text-white text-label-lg rounded-[var(--radius-btn)] shadow-sm gap-2"
                    >
                        <ShoppingBag className="w-4 h-4" />
                        Thêm vào giỏ hàng
                    </Button>
                )}

                {/* Quote / Order Dialog */}
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        {hasPrice ? (
                            <Button
                                variant="outline"
                                className="flex-[0.8] h-12 border-brand-500 text-brand-500 hover:bg-brand-500 hover:text-white font-semibold text-[14px] rounded-[var(--radius-btn)] gap-2 transition-all"
                            >
                                <MessageSquareText className="w-4 h-4" />
                                Yêu cầu báo giá
                            </Button>
                        ) : (
                            <Button className="flex-1 h-12 bg-brand-500 hover:bg-brand-600 text-white font-semibold text-[15px] rounded-[var(--radius-btn)] shadow-sm gap-2">
                                <MessageSquareText className="w-4 h-4" />
                                Yêu cầu báo giá
                            </Button>
                        )}
                    </DialogTrigger>

                    <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-white border-0 shadow-2xl rounded-2xl">
                        <div className="h-1.5 w-full bg-gradient-to-r from-brand-500 to-brand-400" />

                        {isSuccess ? (
                            <div className="p-10 flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 bg-success-50 rounded-full flex items-center justify-center mb-6">
                                    <CheckCircle2 className="w-8 h-8 text-success-500" />
                                </div>
                                <DialogTitle className="text-2xl font-bold text-stone-900 mb-3 tracking-tight">
                                    {hasPrice ? "Yêu cầu báo giá đã được gửi!" : "Yêu cầu báo giá thành công!"}
                                </DialogTitle>
                                <DialogDescription className="text-[15px] text-stone-600 mb-8 leading-relaxed">
                                    {hasPrice
                                        ? "Cảm ơn bạn đã lựa chọn Đông Phú Gia. Nhân viên của chúng tôi sẽ liên lạc xác nhận ngay."
                                        : "Nhân viên Đông Phú Gia đã nhận được yêu cầu và sẽ gọi điện tư vấn ngay cho bạn."}
                                </DialogDescription>
                                <Button
                                    onClick={resetState}
                                    className="w-full h-12 bg-brand-500 hover:bg-brand-600 text-white font-medium text-[15px] rounded-[var(--radius-btn)]"
                                >
                                    Đóng
                                </Button>
                            </div>
                        ) : (
                            <div className="p-6 sm:p-8">
                                <DialogHeader className="mb-6">
                                    <DialogTitle className="text-2xl font-bold text-stone-900 tracking-tight">
                                        Yêu cầu báo giá
                                    </DialogTitle>
                                    <DialogDescription className="text-stone-500 text-sm mt-1">
                                        Điền thông tin bên dưới để chúng tôi có thể hỗ trợ bạn nhanh nhất
                                    </DialogDescription>
                                </DialogHeader>

                                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                                    <div className="bg-stone-50 p-4 rounded-[12px] border border-stone-200 mb-2">
                                        <p className="text-xs text-stone-400 font-medium uppercase tracking-wider mb-1">Sản phẩm</p>
                                        <p className="text-sm font-semibold text-stone-800 leading-snug">{productName}</p>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <label htmlFor="customerName" className="text-[13px] font-medium text-stone-700">
                                            Họ và tên <span className="text-red-500">*</span>
                                        </label>
                                        <Input
                                            id="customerName"
                                            name="customerName"
                                            placeholder="Nguyễn Văn A"
                                            required
                                            className="h-11 bg-stone-50/50 border-stone-200 focus-visible:ring-brand-500 focus-visible:border-brand-500 rounded-[var(--radius-input)]"
                                        />
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <label htmlFor="customerPhone" className="text-[13px] font-medium text-stone-700">
                                            Số điện thoại <span className="text-red-500">*</span>
                                        </label>
                                        <Input
                                            id="customerPhone"
                                            name="customerPhone"
                                            type="tel"
                                            placeholder="09..."
                                            required
                                            className="h-11 bg-stone-50/50 border-stone-200 focus-visible:ring-brand-500 focus-visible:border-brand-500 rounded-[var(--radius-input)]"
                                        />
                                    </div>

                                    {hasPrice && (
                                        <div className="flex items-end justify-between gap-4 mt-2">
                                            <div className="flex flex-col gap-2">
                                                <label className="text-[13px] font-medium text-stone-700">Số lượng</label>
                                                <div className="flex items-center border border-stone-200 rounded-[var(--radius-input)] overflow-hidden h-11 bg-white">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleQuantityChange(-1)}
                                                        className="w-10 h-full flex items-center justify-center hover:bg-stone-50 text-stone-600 transition-colors"
                                                    >
                                                        <Minus className="w-3.5 h-3.5" />
                                                    </button>
                                                    <div className="w-12 h-full flex items-center justify-center text-[14px] font-semibold text-stone-900 border-x border-stone-200">
                                                        {quantity}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleQuantityChange(1)}
                                                        className="w-10 h-full flex items-center justify-center hover:bg-stone-50 text-stone-600 transition-colors"
                                                    >
                                                        <Plus className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <span className="text-[12px] font-medium text-stone-400">Tạm tính</span>
                                                <span className="text-xl font-bold text-accent-500 tracking-tight">{formatPrice(totalPrice)}</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="mt-4 pt-4 border-t border-stone-100">
                                        <Button
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="w-full h-12 bg-brand-500 hover:bg-brand-600 text-white font-semibold text-[15px] rounded-[var(--radius-btn)] shadow-md transition-all gap-2"
                                        >
                                            {isSubmitting ? "Đang xử lý..." : "Gửi yêu cầu báo giá"}
                                        </Button>
                                        <p className="text-[11px] text-center text-stone-400 mt-3">
                                            Thông tin của bạn sẽ được bảo mật tuyệt đối.
                                        </p>
                                    </div>
                                </form>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </div>

            {/* Row 2: Hotline */}
            <a
                href="tel:0855528688"
                className="flex items-center justify-center gap-2 px-6 h-11 rounded-[var(--radius-btn)] bg-brand-50 text-brand-700 font-medium text-[14px] hover:bg-brand-100 transition-all duration-200"
            >
                <Phone className="w-4 h-4 text-brand-500" />
                Gọi hotline tư vấn: 0855 528 688
            </a>
        </div>
    );
}
