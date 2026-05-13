"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Phone, CheckCircle2, Minus, Plus, ShoppingCart, MessageSquareText, ShoppingBag, Wrench, ArrowRight } from "lucide-react";
import Link from "next/link";
import { formatPrice } from "@/lib/utils";
import { useCartStore } from "@/lib/cart-store";
import { useProductOptions } from "./product-options-context";
import { toast } from "sonner";
import { siteConfig } from "@/config/site";

interface ProductCTAProps {
    productId: number;
    productSku: string;
    productName: string;
    price: number | null;
    priceDisplay?: string | null;
    originalPrice?: number | null;
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
    originalPrice,
    priceDisplay,
    imageUrl,
    categorySlug,
    subcategorySlug,
    brandName,
    slug,
}: ProductCTAProps) {
    const hasPrice = price !== null && price > 0;
    
    const productOptions = useProductOptions();
    const installOption = productOptions?.installOption || 'none';
    const installationFee = productOptions?.installationFee || 0;
    const onlineDiscountAmount = productOptions?.onlineDiscountAmount || 0;

    const [isOpen, setIsOpen] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [quantity, setQuantity] = useState(1);

    const addItem = useCartStore((s) => s.addItem);

    const handleAddToCart = () => {
        const finalPrice = hasPrice ? (price! - onlineDiscountAmount + installationFee) : undefined;
        
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
            installOption,
            installationFee,
            onlineDiscountAmount,
            finalPrice,
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
                    message: `Yêu cầu tư vấn/đặt hàng cho sản phẩm: ${productName} (SKU: ${productSku})${installOption !== 'none' ? ` - Có kèm yêu cầu ${installOption === 'install' ? 'Lắp đặt' : 'Tháo dỡ & Lắp đặt'}` : ''}`,
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

    const finalItemPrice = hasPrice ? (price! - onlineDiscountAmount + installationFee) : 0;
    const totalPrice = finalItemPrice * quantity;

    return (
        <div className="flex flex-col gap-3">
            {/* Row 1: Add to Cart + Quote/Order */}
            <div className="flex gap-3">
                {/* Add to Cart — primary if has price */}
                {hasPrice && (
                    <Button
                        onClick={handleAddToCart}
                        className="group flex-1 h-[48px] bg-gradient-to-r from-[#2E7A96] to-[#1e586e] hover:brightness-110 !text-white text-[15px] font-semibold rounded-xl shadow-[0_8px_20px_rgba(46,122,150,0.25)] transition-all duration-300 gap-2 border-0"
                    >
                        <ShoppingBag className="w-[18px] h-[18px] transition-transform duration-300 group-hover:translate-x-1" />
                        Thêm vào giỏ hàng
                    </Button>
                )}

                {/* Quote / Order Dialog */}
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        {hasPrice ? (
                            <Button
                                variant="outline"
                                className="flex-[0.6] h-[48px] border-stone-300 text-stone-700 hover:bg-stone-50 hover:text-stone-900 font-semibold text-[14px] rounded-xl gap-2 transition-all shadow-sm"
                            >
                                <MessageSquareText className="w-[18px] h-[18px]" />
                                Báo giá
                            </Button>
                        ) : (
                            <Button className="group flex-1 h-[48px] bg-gradient-to-r from-[#2E7A96] to-[#1e586e] hover:brightness-110 text-white font-semibold text-[15px] rounded-xl shadow-[0_8px_20px_rgba(46,122,150,0.25)] transition-all duration-300 gap-2 border-0">
                                <MessageSquareText className="w-[18px] h-[18px] transition-transform duration-300 group-hover:translate-x-1" />
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

            <div className="mt-3 flex justify-center">
                <a
                    href={`tel:${siteConfig.contact.businessRoom}`}
                    className="group flex items-center justify-center gap-2 text-[#2E7A96] font-semibold text-[13px] hover:text-[#1e586e] transition-colors"
                >
                    <div className="relative flex items-center justify-center">
                        <span className="absolute w-6 h-6 rounded-full bg-[#2E7A96]/20 group-hover:animate-ping" />
                        <Phone className="w-4 h-4 relative z-10" />
                    </div>
                    <span>Cần tư vấn ngay? <span className="underline decoration-[#2E7A96]/30 underline-offset-4 group-hover:decoration-[#2E7A96] transition-colors">Liên hệ Phòng kinh doanh: {siteConfig.contact.businessRoomLabel}</span></span>
                </a>
            </div>

            {/* Installation Service Link */}
            <Link href="/dich-vu-lap-dat" className="mt-2 group flex items-center justify-between p-3.5 bg-gradient-to-r from-blue-50/80 to-blue-50/30 border border-blue-100 rounded-[12px] hover:border-blue-200 transition-all duration-300 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white shadow-sm border border-blue-100 text-[#2E7A96]">
                        <Wrench className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[13px] font-bold text-slate-800 leading-tight group-hover:text-[#2E7A96] transition-colors">Bảng giá Dịch vụ Lắp đặt</span>
                        <span className="text-[11px] text-slate-500 mt-0.5">Công khai, chuyên nghiệp, bảo hành dài hạn</span>
                    </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#2E7A96] group-hover:translate-x-0.5 transition-all" />
            </Link>

            {/* Mobile Sticky Bottom Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-stone-200 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden z-[100] flex items-center justify-between gap-4 shadow-[0_-8px_30px_rgba(0,0,0,0.06)]">
                {hasPrice ? (
                    <div className="flex flex-col justify-center">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest leading-none mb-1">Tổng tạm tính</span>
                        <div className="flex items-end gap-1.5">
                            <span className="text-[20px] font-black text-rose-600 tracking-tight leading-none">{formatPrice(totalPrice)}</span>
                        </div>
                        {(originalPrice || onlineDiscountAmount > 0) && (
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                {originalPrice && originalPrice > price! && (
                                    <span className="text-[11px] font-medium text-stone-400 line-through decoration-stone-300">
                                        {formatPrice(originalPrice * quantity)}
                                    </span>
                                )}
                                {onlineDiscountAmount > 0 && (
                                    <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-[2px] rounded border border-orange-100">
                                        - {formatPrice(onlineDiscountAmount * quantity)} Online
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Tạm tính</span>
                        <span className="text-[18px] font-black text-[#2E7A96] tracking-tight leading-none mt-1">Liên hệ</span>
                    </div>
                )}
                
                <div className="flex-1 max-w-[200px]">
                    {hasPrice ? (
                        <Button
                            onClick={handleAddToCart}
                            className="w-full h-12 bg-gradient-to-r from-[#2E7A96] to-[#1e586e] hover:brightness-110 !text-white text-[15px] font-semibold rounded-xl shadow-[0_4px_14px_rgba(46,122,150,0.25)] transition-all duration-300 gap-2 border-0"
                        >
                            <ShoppingBag className="w-[18px] h-[18px]" />
                            Thêm vào giỏ
                        </Button>
                    ) : (
                        <Button 
                            onClick={() => setIsOpen(true)}
                            className="w-full h-12 bg-gradient-to-r from-[#2E7A96] to-[#1e586e] hover:brightness-110 !text-white text-[15px] font-semibold rounded-xl shadow-[0_4px_14px_rgba(46,122,150,0.25)] transition-all duration-300 gap-2 border-0"
                        >
                            <MessageSquareText className="w-[18px] h-[18px]" />
                            Nhận báo giá
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
