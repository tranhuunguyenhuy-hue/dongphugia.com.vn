'use client'

import Link from 'next/link'
import type { VariantSibling } from '@/lib/public-api-products'

// ─── UTILS ────────────────────────────────────────────────────────────────────

/**
 * Rút gọn tên sản phẩm để hiển thị gọn gàng trên Variant Selector
 * Định dạng chuẩn: [Loại nắp] (Giấu dây) [Mã Series W/T/E] hoặc rút gọn phụ kiện Sen tắm
 */
function getShortVariantName(fullName: string, sku: string, subcategorySlug?: string | null, variantGroup?: string): string {
    const lowerName = fullName.toLowerCase();
    
    // 1. Áp dụng chuẩn [Công nghệ] (Giấu dây) [Series] cho Bồn Cầu và Nắp Bồn Cầu
    if (subcategorySlug === 'bon-cau' || subcategorySlug === 'nap-bon-cau') {
        const isConcealed = lowerName.includes('giấu dây');
        
        // Cố gắng tìm mã Series (W12, T8, E4...) trong SKU hoặc tên
        let seriesCode = '';
        const skuMatch = sku.split('/')[0].split('#')[0].match(/(T\d+|E\d+|W\d+)[A-Z]*$/i);
        if (skuMatch) {
            seriesCode = skuMatch[1].toUpperCase();
        } else {
            const nameSeriesMatch = fullName.match(/\((T\d+|E\d+|W\d+)\)/i);
            if (nameSeriesMatch) {
                seriesCode = nameSeriesMatch[1].toUpperCase();
            }
        }
        
        // Phân loại công nghệ
        let tech = '';
        if (lowerName.includes('washlet')) {
            const washletMatch = lowerName.match(/washlet\s+(c\d|s\d|g\d)/i);
            tech = washletMatch ? `Washlet ${washletMatch[1].toUpperCase()}` : 'Washlet';
        } else if (lowerName.includes('eco-washer') || lowerName.includes('ecowasher') || lowerName.includes('rửa cơ')) {
            tech = 'Nắp rửa cơ';
        } else if (lowerName.includes('đóng êm') || lowerName.includes('nắp êm')) {
            tech = 'Nắp đóng êm';
        } else if (lowerName.includes('neorest')) {
            tech = 'Neorest';
        } else if (lowerName.includes('kèm tc') || lowerName.match(/kèm.*tc\d/)) {
            tech = 'Nắp đóng êm'; // Các nắp mã TC... thường là nắp êm
        }
        
        if (tech) {
            const parts = [tech];
            if (isConcealed) parts.push('(Giấu dây)');
            if (seriesCode) parts.push(`(${seriesCode})`);
            return parts.join(' ').trim();
        }
    }
    
    // 2. Logic rút gọn riêng cho SEN TẮM
    if (subcategorySlug === 'sen-tam' || subcategorySlug?.includes('sen')) {
        let name = fullName;
        
        // Xoá mã Củ Sen (variantGroup) ra khỏi tên để tránh lặp lại vì mọi biến thể đều có nó
        if (variantGroup) {
            // Cẩn thận với các ký tự đặc biệt trong variantGroup (tuy mã TOTO thường chỉ có chữ và số)
            const regex = new RegExp(variantGroup, 'gi');
            name = name.replace(regex, '');
        }
        
        // Xoá từ rườm rà
        name = name.replace(/ TOTO /gi, ' ');
        name = name.replace(/Bộ sen tắm âm tường 1 đường nước nóng lạnh/gi, 'Âm tường 1 đường');
        name = name.replace(/Bộ sen tắm âm tường 2 đường nước nóng lạnh/gi, 'Âm tường 2 đường');
        name = name.replace(/Bộ sen tắm âm tường 2 đường nước nhiệt độ/gi, 'Âm tường nhiệt độ 2 đường');
        name = name.replace(/Bộ sen tắm âm tường 3 đường nước nhiệt độ/gi, 'Âm tường nhiệt độ 3 đường');
        name = name.replace(/Bộ sen tắm âm tường/gi, 'Âm tường');
        
        // Loại bỏ hẳn các tiền tố thừa vì tiêu đề trang đã hiển thị
        name = name.replace(/Bộ sen tắm nhiệt độ/gi, '');
        name = name.replace(/Bộ sen tắm nóng lạnh/gi, '');
        name = name.replace(/Bộ sen tắm/gi, '');
        name = name.replace(/Bộ sen cây nhiệt độ/gi, 'Sen cây');
        name = name.replace(/Sen cây nhiệt độ/gi, 'Sen cây');
        name = name.replace(/Bộ vòi sen tắm nóng lạnh/gi, 'Vòi sen');
        name = name.replace(/Van gật gù điều chỉnh nóng lạnh/gi, 'Củ sen');
        name = name.replace(/Van điều chỉnh nhiệt độ/gi, 'Van nhiệt độ');
        name = name.replace(/Bảng điều khiển nhiệt độ/gi, 'Bảng ĐK nhiệt độ');
        name = name.replace(/Củ sen tắm/gi, 'Củ sen');
        
        // Rút gọn các từ nối
        name = name.replace(/kèm nút chuyển hướng và phụ kiện âm tường/gi, '+ Chuyển hướng & Âm tường');
        name = name.replace(/kèm nút chuyển hướng/gi, '+ Chuyển hướng');
        name = name.replace(/và phụ kiện âm tường/gi, '& Âm tường');
        name = name.replace(/kèm phụ kiện âm tường/gi, '+ Phụ kiện âm');
        name = name.replace(/kèm bát sen/gi, '+');
        name = name.replace(/, bát sen/gi, '+');
        name = name.replace(/kèm tay sen/gi, '+');
        name = name.replace(/, tay sen/gi, '+');
        name = name.replace(/kèm van/gi, '+ Van');
        name = name.replace(/, van/gi, '+ Van');
        name = name.replace(/kèm vòi sen/gi, '+ Vòi');
        name = name.replace(/, vòi sen/gi, '+ Vòi');
        
        // Rút gọn tên phụ kiện đứng độc lập
        name = name.replace(/Bát sen cầm tay gắn tường/gi, 'Tay sen tường');
        name = name.replace(/Bát sen cầm tay/gi, 'Tay sen');
        name = name.replace(/Bát sen gắn trần tròn/gi, 'Bát trần tròn');
        name = name.replace(/Bát sen gắn trần vuông/gi, 'Bát trần vuông');
        name = name.replace(/Bát sen gắn trần/gi, 'Bát trần');
        name = name.replace(/Bát sen gắn tường/gi, 'Bát tường');
        
        // Dọn dẹp khoảng trắng thừa và dấu phẩy thừa do thay thế
        name = name.replace(/,\s*\+/g, ' +');
        name = name.replace(/\+\s*\+/g, '+');
        
        let trimmed = name.replace(/\s+/g, ' ').trim();
        trimmed = trimmed.replace(/^\+\s*/, ''); // Loại bỏ dấu '+' thừa ở đầu câu
        
        // Nếu tên quá ngắn (chỉ còn lại Củ sen)
        if (trimmed === 'Củ sen' || trimmed === 'Van nhiệt độ' || trimmed === '') {
            return trimmed === '' ? 'Tiêu chuẩn' : `${trimmed} (Tiêu chuẩn)`;
        }
        
        return trimmed;
    }
    
    // 3. Logic rút gọn chung (Fallback cho các SP không nhận diện được hoặc danh mục khác)
    let name = fullName;
    
    // Bỏ mã variantGroup nếu có
    if (variantGroup) {
        const groupRegex = new RegExp(`\\b${variantGroup}\\b`, 'gi');
        name = name.replace(groupRegex, '');
    }
    
    // Dọn dẹp các tiền tố phổ biến của các danh mục khác
    name = name.replace(/ TOTO /gi, ' ');
    name = name.replace(/Vòi lavabo cảm ứng/gi, 'Cảm ứng');
    name = name.replace(/Vòi chậu lavabo nóng lạnh/gi, 'Nóng lạnh');
    name = name.replace(/Vòi lavabo nóng lạnh/gi, 'Nóng lạnh');
    name = name.replace(/Vòi chậu/gi, 'Vòi');
    name = name.replace(/Chậu Lavabo Âm Bàn/gi, 'Âm bàn');
    name = name.replace(/Chậu Lavabo Đặt Bàn/gi, 'Đặt bàn');
    name = name.replace(/Chậu Lavabo Dương Vành/gi, 'Dương vành');
    name = name.replace(/Chậu Lavabo Treo Tường/gi, 'Treo tường');
    name = name.replace(/Chậu Lavabo Bán Âm Bàn/gi, 'Bán âm');
    name = name.replace(/Chậu Lavabo/gi, 'Lavabo');
    name = name.replace(/Bồn tắm đặt sàn/gi, 'Đặt sàn');
    name = name.replace(/Bồn tắm xây/gi, 'Bồn xây');
    name = name.replace(/Bồn tắm massage/gi, 'Massage');
    name = name.replace(/Bồn tắm yếm/gi, 'Bồn yếm');
    name = name.replace(/Bồn tắm/gi, 'Bồn tắm');
    name = name.replace(/Bồn cầu 1 khối/gi, '');
    name = name.replace(/Bồn cầu 2 khối/gi, '');
    name = name.replace(/Bồn cầu thông minh Neorest/gi, 'Neorest ');
    name = name.replace(/Bồn cầu treo tường/gi, 'Treo tường ');
    name = name.replace(/Nắp Bồn Cầu Điện Tử Washlet /gi, 'Washlet ');
    name = name.replace(/Nắp rửa cơ Eco-washer /gi, 'Rửa cơ ');
    name = name.replace(/Nắp rửa cơ Ecowasher /gi, 'Rửa cơ ');
    name = name.replace(/Nắp Bồn Cầu Đóng Êm /gi, 'Nắp êm ');
    name = name.replace(/Nắp Bồn Cầu /gi, 'Nắp ');
    
    // Rút gọn các cụm từ nối chung
    name = name.replace(/kèm nắp rửa điện tử Washlet /gi, '+ Washlet ');
    name = name.replace(/kèm nắp rửa cơ Ecowasher /gi, '+ Rửa cơ ');
    name = name.replace(/kèm nắp rửa cơ Eco-washer /gi, '+ Rửa cơ ');
    name = name.replace(/kèm nắp đóng êm /gi, '+ Nắp êm ');
    name = name.replace(/kèm bộ điều khiển/gi, '+ Điều khiển');
    name = name.replace(/kèm bộ xả/gi, '+ Bộ xả');
    name = name.replace(/kèm ống thải/gi, '+ Ống thải');
    name = name.replace(/kèm chân/gi, '+ Chân');
    
    name = name.replace(/dành cho bồn cầu giấu dây/gi, '(Giấu dây)');
    name = name.replace(/\s+giấu dây/gi, ' (Giấu dây)');
    name = name.replace(/\sTOTO\s/gi, ' ');
    
    let trimmed = name.replace(/\s+/g, ' ').trim();
    trimmed = trimmed.replace(/^\+\s*/, '');
    
    // Nếu rỗng hoặc chỉ còn lại tên cơ bản
    const basicNames = ['Cảm ứng', 'Nóng lạnh', 'Vòi', 'Âm bàn', 'Đặt bàn', 'Dương vành', 'Treo tường', 'Bán âm', 'Lavabo', 'Đặt sàn', 'Bồn xây', 'Massage', 'Bồn yếm', 'Bồn tắm'];
    if (trimmed === '' || basicNames.includes(trimmed)) {
        return trimmed === '' ? 'Tiêu chuẩn' : `${trimmed} (Tiêu chuẩn)`;
    }
    
    return trimmed;
}

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface VariantSelectorProps {
    currentSku: string
    currentSlug: string
    currentName: string
    currentPriceDisplay: string | null
    currentPrice?: number | null
    currentOriginalPrice?: number | null
    currentColor?: { name: string; hex_code: string | null } | null
    variantGroup: string
    siblings: VariantSibling[]
    categorySlug: string
    subcategorySlug?: string | null
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export function VariantSelector({
    currentSku,
    currentSlug,
    currentName,
    currentPriceDisplay,
    currentPrice,
    currentOriginalPrice,
    currentColor,
    variantGroup,
    siblings,
    categorySlug,
    subcategorySlug,
}: VariantSelectorProps) {
    if (!siblings || siblings.length === 0) return null

    // Stable sort by SKU — active card NEVER moves position
    const allVariants = [
        {
            sku: currentSku,
            slug: currentSlug,
            name: currentName,
            priceDisplay: currentPriceDisplay,
            price: currentPrice,
            originalPrice: currentOriginalPrice,
            color: currentColor,
            isCurrent: true,
            subcategorySlug,
        },
        ...siblings.map(s => ({
            sku: s.sku,
            slug: s.slug,
            name: s.name,
            priceDisplay: s.price_display,
            price: s.price,
            originalPrice: s.original_price,
            color: s.colors,
            isCurrent: false,
            subcategorySlug: s.subcategories?.slug || subcategorySlug,
        })),
    ].sort((a, b) => a.sku.localeCompare(b.sku))

    // Determine if we should show color dots
    const uniqueColors = new Set(
        allVariants
            .map(v => v.color?.hex_code?.toLowerCase())
            .filter(Boolean)
    )
    const hasMultipleColors = uniqueColors.size > 1

    return (
        <div
            className="flex flex-col gap-3"
            role="group"
            aria-label="Chọn phiên bản sản phẩm"
        >
            {/* Header */}
            <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-widest">
                    Phiên bản
                </p>
                <span className="text-[11px] text-stone-400 font-medium tabular-nums">
                    {allVariants.length} mẫu
                </span>
            </div>

            {/* Grid Layout — optimized for space, no internal scroll, ensuring text fits */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-1.5">
                {allVariants.map((variant) => {
                    const href = `/${categorySlug}/${variant.subcategorySlug || subcategorySlug}/${variant.slug}`
                    const originalPrice = Number(variant.originalPrice)
                    const sellingPrice = Number(variant.price)
                    
                    let priceDisplay = 'Liên hệ'
                    if (sellingPrice > 0) {
                        priceDisplay = new Intl.NumberFormat('vi-VN').format(sellingPrice) + 'đ'
                    } else if (variant.priceDisplay) {
                        priceDisplay = variant.priceDisplay
                    }

                    const shortName = getShortVariantName(variant.name, variant.sku, variant.subcategorySlug || subcategorySlug, variantGroup)
                    const hasDiscount = originalPrice > 0 && sellingPrice > 0 && originalPrice > sellingPrice
                    const discountPercent = hasDiscount ? Math.round(((originalPrice - sellingPrice) / originalPrice) * 100) : 0

                    if (variant.isCurrent) {
                        return (
                            <div
                                key={variant.sku}
                                className="
                                    relative flex flex-col justify-center gap-0.5
                                    px-2 py-1.5 rounded-lg
                                    bg-brand-50 ring-2 ring-inset ring-brand-500 border border-transparent
                                    cursor-default select-none shadow-sm
                                "
                                aria-current="true"
                            >
                                <div className="flex items-start gap-1">
                                    {hasMultipleColors && variant.color?.hex_code && (
                                        <div 
                                            className="w-2.5 h-2.5 mt-0.5 rounded-full border border-black/10 shrink-0 shadow-sm" 
                                            style={{ backgroundColor: variant.color.hex_code }}
                                            title={variant.color.name}
                                        />
                                    )}
                                    <span className="text-[11px] font-semibold text-brand-900 leading-[1.3] line-clamp-2" title={variant.name}>
                                        {shortName}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1 mt-0.5">
                                    <span className="text-[11px] font-bold text-brand-700 leading-none">
                                        {priceDisplay}
                                    </span>
                                    {hasDiscount && (
                                        <span className="px-1 py-[1.5px] text-[8px] font-bold text-white bg-rose-500 rounded-[3px] leading-none">
                                            -{discountPercent}%
                                        </span>
                                    )}
                                </div>
                            </div>
                        )
                    }

                    return (
                        <Link
                            key={variant.sku}
                            href={href}
                                className="
                                group relative flex flex-col justify-center gap-0.5
                                px-2 py-1.5 rounded-lg
                                bg-white border border-stone-200
                                hover:border-brand-500 hover:bg-brand-50 hover:shadow-sm
                                active:scale-[0.98] transition-all duration-200 cursor-pointer
                            "
                        >
                            <div className="flex items-start gap-1">
                                {hasMultipleColors && variant.color?.hex_code && (
                                    <div 
                                        className="w-2.5 h-2.5 mt-0.5 rounded-full border border-black/10 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity shadow-sm" 
                                        style={{ backgroundColor: variant.color.hex_code }}
                                        title={variant.color.name}
                                    />
                                )}
                                <span className="text-[11px] font-medium text-stone-700 group-hover:text-brand-900 leading-[1.3] line-clamp-2 transition-colors" title={variant.name}>
                                    {shortName}
                                </span>
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-[11px] font-medium text-stone-500 group-hover:text-brand-700 leading-none transition-colors">
                                    {priceDisplay}
                                </span>
                                {hasDiscount && (
                                    <span className="px-1 py-[1.5px] text-[8px] font-bold text-stone-500 bg-stone-100 group-hover:bg-rose-500 group-hover:text-white rounded-[3px] leading-none transition-colors">
                                        -{discountPercent}%
                                    </span>
                                )}
                            </div>
                        </Link>
                    )
                })}
            </div>
        </div>
    )
}

