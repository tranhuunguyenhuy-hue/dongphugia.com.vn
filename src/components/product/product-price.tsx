'use client'

import { cn } from "@/lib/utils"
import { Sparkles, Gift, ShieldCheck, Award, Truck, Headphones } from 'lucide-react'
import { useState } from "react"
import { ProductOptionsContext } from "./product-options-context"

interface ProductPriceProps {
    price: number | null | undefined
    originalPrice: number | null | undefined
    priceDisplay: string | null | undefined
    onlineDiscountAmount?: number | null | undefined
    className?: string
    children?: React.ReactNode
}

export function ProductPrice({ price, originalPrice, priceDisplay, onlineDiscountAmount, className, children }: ProductPriceProps) {
    const [installOption, setInstallOption] = useState<'none' | 'install' | 'replace'>('none')

    const installationFee = installOption === 'install' ? 200000 : installOption === 'replace' ? 350000 : 0;

    const numPrice = Number(price)
    const numOriginal = Number(originalPrice)
    const numOnlineDiscount = Number(onlineDiscountAmount)
    const hasDiscount = numOriginal > 0 && numPrice > 0 && numOriginal > numPrice

    const finalDisplayPrice = numPrice > 0 
        ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(numPrice)
        : (priceDisplay || "Liên hệ báo giá")

    return (
        <ProductOptionsContext.Provider value={{ installOption, setInstallOption, installationFee, onlineDiscountAmount: numOnlineDiscount }}>
        <div className={cn("relative rounded-[24px] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.06)] mb-6", className)}>
            <div className="flex flex-col p-5 lg:p-6 h-full">
                
                {/* === BLOCK 1: PRICING SECTION === */}
                <div className="flex flex-col gap-1.5 mb-5">
                    <h3 className="text-[10px] font-bold text-stone-400 tracking-widest uppercase flex items-center gap-1.5 mb-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                        Giá hiện tại
                    </h3>
                    
                    {/* Price Block */}
                    {hasDiscount ? (
                        <div className="flex items-center gap-3 flex-wrap mt-0.5">
                            <p className="text-[32px] font-black text-rose-600 tracking-tight leading-none">
                                {finalDisplayPrice}
                            </p>
                            <p className="text-[15px] font-semibold text-stone-400 line-through decoration-stone-300">
                                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(numOriginal)}
                            </p>
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700">
                                <span className="flex items-center gap-1 text-[12px] font-bold"><Sparkles className="w-3 h-3" /> Tiết kiệm {Math.round(((numOriginal - numPrice) / numOriginal) * 100)}%</span>
                            </div>
                        </div>
                    ) : (
                        <div className="mt-0.5">
                            <p className="text-[32px] font-black text-[#2E7A96] tracking-tight leading-none">
                                {finalDisplayPrice}
                            </p>
                        </div>
                    )}

                    {/* Online Discount Sub-Card (Shopee-style Voucher) */}
                    {numOnlineDiscount > 0 && numPrice > 0 && (
                        <div className="mt-4 flex relative rounded-xl bg-orange-50/60 border border-orange-200">
                            
                            {/* Left Stub */}
                            <div className="relative flex flex-col items-center justify-center pl-4 pr-3 border-r border-dashed border-orange-300">
                                <span className="text-[20px] leading-none flex items-center justify-center"><Gift className="w-5 h-5 text-orange-500" /></span>
                                
                                {/* Top Hole */}
                                <div className="absolute -right-2 -top-[9px] w-4 h-4 bg-white rounded-full border-b border-orange-200 z-10" />
                                {/* Bottom Hole */}
                                <div className="absolute -right-2 -bottom-[9px] w-4 h-4 bg-white rounded-full border-t border-orange-200 z-10" />
                            </div>

                            {/* Right Content */}
                            <div className="flex-1 py-2.5 px-3 flex flex-col justify-center">
                                <div className="text-[10px] font-bold text-orange-600/80 uppercase tracking-widest mb-0.5">
                                    Độc quyền đặt Online
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[13px] font-medium text-stone-600">Giá chỉ còn:</span>
                                    <span className="text-[16px] font-black text-[#d64a25] tracking-tight">
                                        {new Intl.NumberFormat('vi-VN').format(numPrice - numOnlineDiscount)}đ
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Divider */}
                <div className="h-px bg-stone-100 w-full mb-5" />

                {/* === BLOCK 2: ACTION SECTION (CTA) === */}
                {children && (
                    <div className="flex flex-col">
                        {children}
                    </div>
                )}

                
                {/* === CARD 2: INSTALLATION SERVICES SECTION (Demoted Hierarchy) === */}
                <div className="hidden bg-white/75 backdrop-blur-xl p-3.5 lg:p-4 rounded-[16px] border border-white/60 shadow-sm">
                    <div className="flex flex-col gap-2.5">
                        <div className="flex flex-col gap-0.5">
                            <h4 className="text-[11px] font-bold text-stone-500 uppercase tracking-widest">
                                Dịch vụ lắp đặt
                            </h4>
                            <p className="text-[10px] text-stone-500/90 italic font-medium">
                                *Áp dụng cho khu vực TP Hồ Chí Minh và các tỉnh lân cận
                            </p>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-2 relative z-10 mt-0.5">
                            {/* Option: None */}
                            <label className={cn(
                                "relative flex items-center gap-2.5 p-2.5 rounded-[10px] cursor-pointer transition-all duration-200 border",
                                installOption === 'none' 
                                    ? "bg-white border-sky-600 shadow-[0_2px_10px_-3px_rgba(2,132,199,0.15)] ring-1 ring-sky-600/20" 
                                    : "bg-transparent border-white hover:border-sky-300 hover:bg-sky-500/10"
                            )}>
                                <input 
                                    type="radio" 
                                    name="installOption" 
                                    className="sr-only"
                                    checked={installOption === 'none'}
                                    onChange={() => setInstallOption('none')}
                                />
                                <div className={cn(
                                    "w-3.5 h-3.5 rounded-full border-[1.5px] flex items-center justify-center shrink-0 transition-colors",
                                    installOption === 'none' ? "border-sky-600 bg-white" : "border-stone-400 bg-transparent"
                                )}>
                                    <div className={cn(
                                        "w-1.5 h-1.5 rounded-full bg-sky-600 transition-transform duration-200",
                                        installOption === 'none' ? "scale-100" : "scale-0"
                                    )} />
                                </div>
                                <span className={cn(
                                    "text-[12px] font-semibold transition-colors flex-1",
                                    installOption === 'none' ? "text-sky-900" : "text-stone-700"
                                )}>Không kèm lắp đặt</span>
                            </label>

                            {/* Option: Install */}
                            <label className={cn(
                                "relative flex items-center gap-2.5 p-2.5 rounded-[10px] cursor-pointer transition-all duration-200 border",
                                installOption === 'install' 
                                    ? "bg-white border-sky-600 shadow-[0_2px_10px_-3px_rgba(2,132,199,0.15)] ring-1 ring-sky-600/20" 
                                    : "bg-transparent border-white hover:border-sky-300 hover:bg-sky-500/10"
                            )}>
                                <input 
                                    type="radio" 
                                    name="installOption" 
                                    className="sr-only"
                                    checked={installOption === 'install'}
                                    onChange={() => setInstallOption('install')}
                                />
                                <div className={cn(
                                    "w-3.5 h-3.5 rounded-full border-[1.5px] flex items-center justify-center shrink-0 transition-colors",
                                    installOption === 'install' ? "border-sky-600 bg-white" : "border-stone-400 bg-transparent"
                                )}>
                                    <div className={cn(
                                        "w-1.5 h-1.5 rounded-full bg-sky-600 transition-transform duration-200",
                                        installOption === 'install' ? "scale-100" : "scale-0"
                                    )} />
                                </div>
                                <div className="flex flex-col flex-1">
                                    <span className={cn(
                                        "text-[12px] font-semibold transition-colors",
                                        installOption === 'install' ? "text-sky-900" : "text-stone-700"
                                    )}>Lắp đặt sản phẩm</span>
                                </div>
                                <span className={cn(
                                    "ml-auto text-[12px] font-bold transition-colors",
                                    installOption === 'install' ? "text-sky-700" : "text-stone-600"
                                )}>
                                    +200.000đ
                                </span>
                            </label>

                            {/* Option: Replace */}
                            <label className={cn(
                                "relative flex items-center gap-2.5 p-2.5 rounded-[10px] cursor-pointer transition-all duration-200 border",
                                installOption === 'replace' 
                                    ? "bg-white border-sky-600 shadow-[0_2px_10px_-3px_rgba(2,132,199,0.15)] ring-1 ring-sky-600/20" 
                                    : "bg-transparent border-white hover:border-sky-300 hover:bg-sky-500/10"
                            )}>
                                <input 
                                    type="radio" 
                                    name="installOption" 
                                    className="sr-only"
                                    checked={installOption === 'replace'}
                                    onChange={() => setInstallOption('replace')}
                                />
                                <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors", installOption === 'replace' ? "border-sky-600 bg-white" : "border-stone-400 bg-transparent")}>
                                    <div className={cn("w-2 h-2 rounded-full bg-sky-600 transition-transform duration-200", installOption === 'replace' ? "scale-100" : "scale-0")} />
                                </div>
                                <span className={cn("text-[12px] font-medium flex-1", installOption === 'replace' ? "text-sky-900" : "text-stone-600")}>Tháo dỡ & Lắp đặt</span>
                                <span className="text-[12px] font-bold text-sky-700">+350.000đ</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* === CARD 3: TRUST BADGES === */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-3 mt-5 px-1">
                    {[
                        { icon: ShieldCheck, text: "100% Chính hãng", sub: "Phân phối độc quyền" },
                        { icon: Award,       text: "Bảo hành 3–5 năm", sub: "Theo NSX" },
                        { icon: Truck,       text: "Giao toàn quốc",   sub: "Miễn phí nội thành" },
                        { icon: Headphones,  text: "Tư vấn 24/7",      sub: "Kỹ thuật chuyên sâu" },
                    ].map((feature, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                            <div className="mt-0.5 text-brand-600 shrink-0">
                                <feature.icon className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[11px] font-bold text-stone-700 leading-tight">
                                    {feature.text}
                                </span>
                                <span className="text-[10px] text-stone-500 leading-tight mt-0.5">
                                    {feature.sub}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* 
                    Bottom area showing the gradient edge.
                    The Add to Cart component or trust badges will be placed here later.
                */}
                <div className="h-1" />

            </div>
        </div>
        </ProductOptionsContext.Provider>
    )
}
