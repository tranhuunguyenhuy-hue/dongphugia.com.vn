'use client'

import { cn } from "@/lib/utils"
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
        <div className={cn("relative rounded-[24px] overflow-hidden shadow-2xl shadow-orange-900/10 mb-6 border border-orange-100", className)}>
            {/* Outer Mesh Background */}
            <div 
                className="absolute inset-0 bg-cover bg-center z-0" 
                style={{ backgroundImage: "url('/images/new-mesh-gradient.webp')", backgroundColor: "#F97316" }}
            />
            {/* Fallback solid color behind the image just in case it doesn't load immediately */}

            <div className="relative z-10 flex flex-col p-1.5 gap-1.5 h-full">
                
                {/* === CARD 1: PRICING SECTION === */}
                <div className="bg-white p-3.5 lg:p-4 rounded-[16px] shadow-sm border border-white/50">
                    <div className="flex flex-col gap-1.5">
                        {/* Eyebrow */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            <h3 className="text-[10px] font-bold text-stone-400 tracking-widest uppercase flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                                Giá hiện tại
                            </h3>
                        </div>
                        
                        {/* Price Block */}
                        {hasDiscount ? (
                            <div className="flex items-end gap-2 flex-wrap mt-0.5">
                                <p className="text-[26px] lg:text-[28px] font-bold text-red-600 tracking-tight leading-none">
                                    {finalDisplayPrice}
                                </p>
                                <div className="flex flex-col justify-end pb-0.5 gap-1">
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-[12px] font-medium text-stone-400 line-through decoration-stone-300">
                                            {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(numOriginal)}
                                        </p>
                                        <span className="px-1.5 py-0.5 text-[10px] font-bold text-white bg-[#E53935] rounded-sm shadow-sm leading-none">
                                            -{Math.round(((numOriginal - numPrice) / numOriginal) * 100)}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-0.5">
                                <p className="text-[26px] lg:text-[28px] font-bold text-[#2E7A96] tracking-tight leading-none">
                                    {finalDisplayPrice}
                                </p>
                            </div>
                        )}

                        {/* Online Discount Sub-Card */}
                        {numOnlineDiscount > 0 && (
                            <div className="relative mt-2 bg-gradient-to-r from-emerald-50 to-emerald-50/40 border border-emerald-100 p-2.5 rounded-[10px] flex flex-col gap-0.5 shadow-sm overflow-hidden group">
                                
                                {/* Shimmer / Slide Light Effect */}
                                <div className="absolute top-0 bottom-0 left-0 w-[70%] bg-gradient-to-r from-white/0 via-white to-white/0 animate-[shimmer_2.5s_infinite_ease-in-out] opacity-100 z-0 pointer-events-none" />
                                
                                <div className="relative z-10 flex items-center gap-1.5">
                                    <svg className="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                                    </svg>
                                    <p className="text-[13px] font-extrabold text-emerald-800 uppercase tracking-wide">
                                        Giảm thêm: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(numOnlineDiscount)}
                                    </p>
                                </div>
                                <p className="relative z-10 text-[10px] text-emerald-700/90 leading-relaxed font-medium">
                                    Ưu đãi đặc biệt khi đặt hàng Online. Chỉ áp dụng cho dongphugia.com.vn
                                </p>
                                
                                <style dangerouslySetInnerHTML={{__html: `
                                    @keyframes shimmer {
                                        0% { transform: translateX(-150%) skewX(-25deg); }
                                        100% { transform: translateX(250%) skewX(-25deg); }
                                    }
                                `}} />
                            </div>
                        )}
                        
                        {/* CTA Container */}
                        {children && (
                            <div className="mt-2 pt-2">
                                {children}
                            </div>
                        )}
                    </div>
                </div>

                
                {/* === CARD 2: INSTALLATION SERVICES SECTION (Demoted Hierarchy) === */}
                <div className="bg-white/75 backdrop-blur-xl p-3.5 lg:p-4 rounded-[16px] border border-white/60 shadow-sm">
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
                                <div className={cn(
                                    "w-3.5 h-3.5 rounded-full border-[1.5px] flex items-center justify-center shrink-0 transition-colors",
                                    installOption === 'replace' ? "border-sky-600 bg-white" : "border-stone-400 bg-transparent"
                                )}>
                                    <div className={cn(
                                        "w-1.5 h-1.5 rounded-full bg-sky-600 transition-transform duration-200",
                                        installOption === 'replace' ? "scale-100" : "scale-0"
                                    )} />
                                </div>
                                <div className="flex flex-col flex-1">
                                    <span className={cn(
                                        "text-[12px] font-semibold transition-colors",
                                        installOption === 'replace' ? "text-sky-900" : "text-stone-700"
                                    )}>Tháo dỡ & Lắp đặt</span>
                                </div>
                                <span className={cn(
                                    "ml-auto text-[12px] font-bold transition-colors",
                                    installOption === 'replace' ? "text-sky-700" : "text-stone-600"
                                )}>
                                    +350.000đ
                                </span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* === CARD 3: TRUST BADGES === */}
                <div className="grid grid-cols-2 gap-x-2 gap-y-2 mt-1.5 px-2">
                    {[
                        "100% Chính hãng",
                        "Bảo hành tiêu chuẩn",
                        "Giao hàng toàn quốc",
                        "Tư vấn kỹ thuật 24/7"
                    ].map((feature, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-white shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-[11px] font-semibold text-white leading-tight drop-shadow-sm">
                                {feature}
                            </span>
                        </div>
                    ))}
                </div>

                {/* 
                    Bottom area showing the gradient edge.
                    The Add to Cart component or trust badges will be placed here later.
                */}
                <div className="h-4 md:h-6" />

            </div>
        </div>
        </ProductOptionsContext.Provider>
    )
}
