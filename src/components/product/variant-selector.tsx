'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { VariantSibling } from '@/lib/public-api-products'
import { siteConfig } from '@/config/site'

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
        let seriesCode = ''
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
        let tech = ''
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
    /** variant_type of the current product (drives UI mode) */
    variantType?: string | null
    /** variant_label of the current product */
    variantLabel?: string | null
    variantGroup: string
    siblings: VariantSibling[]
    categorySlug: string
    subcategorySlug?: string | null
}

// ─── COLOR SWATCH MODE ────────────────────────────────────────────────────────

interface SwatchVariant {
    sku: string
    slug: string
    name: string
    label: string | null
    priceDisplay: string | null
    price: number | null
    originalPrice: number | null
    color: { name: string; hex_code: string | null } | null | undefined
    isActive: boolean
    isCurrent: boolean
    subcategorySlug: string | null | undefined
}

interface ColorSwatchesProps {
    variants: SwatchVariant[]
    categorySlug: string
    subcategorySlug?: string | null
}

function ColorSwatches({ variants, categorySlug, subcategorySlug }: ColorSwatchesProps) {
    return (
        <div className="flex flex-col gap-3" role="group" aria-label="Chọn màu sắc">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-widest">Màu sắc</p>
            <div className="flex flex-wrap gap-2">
                {variants.map((variant) => {
                    const swatchColor = variant.color?.hex_code || '#e5e7eb'
                    const swatchLabel = variant.label || variant.color?.name || variant.name
                    const href = `/${categorySlug}/${variant.subcategorySlug || subcategorySlug}/${variant.slug}`

                    if (variant.isCurrent) {
                        return (
                            <div
                                key={variant.sku}
                                title={swatchLabel}
                                aria-current="true"
                                aria-label={`Màu hiện tại: ${swatchLabel}`}
                                className="relative w-8 h-8 rounded-full ring-2 ring-offset-2 ring-brand-500 cursor-default shadow"
                                style={{ backgroundColor: swatchColor }}
                            >
                                {/* Active checkmark */}
                                <span className="absolute inset-0 flex items-center justify-center">
                                    <svg className="w-3 h-3 text-white drop-shadow" fill="currentColor" viewBox="0 0 12 12">
                                        <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                                    </svg>
                                </span>
                            </div>
                        )
                    }

                    // Stub swatch: is_active=false — show as dashed, open mailto on click
                    if (!variant.isActive) {
                        const subject = encodeURIComponent(`Yêu cầu báo giá: ${variant.name}`)
                        const body = encodeURIComponent(`Kính gửi Đông Phú Gia,\n\nTôi muốn hỏi về sản phẩm:\nMã SKU: ${variant.sku}\nMàu: ${swatchLabel}\n\nVui lòng báo giá cho tôi.\n\nXin cảm ơn.`)
                        const mailtoHref = `mailto:${siteConfig.contact.email}?subject=${subject}&body=${body}`

                        return (
                            <a
                                key={variant.sku}
                                href={mailtoHref}
                                title={`${swatchLabel} — Liên hệ báo giá`}
                                aria-label={`Màu ${swatchLabel} (liên hệ để đặt hàng)`}
                                className="relative w-8 h-8 rounded-full border-2 border-dashed border-stone-400 opacity-60 hover:opacity-90 cursor-pointer transition-opacity shadow-sm"
                                style={{ backgroundColor: swatchColor }}
                            >
                                {/* Question mark indicator for stub */}
                                <span className="absolute inset-0 flex items-center justify-center">
                                    <svg className="w-3 h-3 text-white/80 drop-shadow-sm" fill="currentColor" viewBox="0 0 12 12">
                                        <text x="2" y="10" fontSize="10" fontWeight="bold">?</text>
                                    </svg>
                                </span>
                            </a>
                        )
                    }

                    // Active sibling — navigate to product page
                    return (
                        <Link
                            key={variant.sku}
                            href={href}
                            title={swatchLabel}
                            aria-label={`Màu: ${swatchLabel}`}
                            className="w-8 h-8 rounded-full border-2 border-stone-200 hover:ring-2 hover:ring-offset-1 hover:ring-brand-400 transition-all cursor-pointer shadow-sm"
                            style={{ backgroundColor: swatchColor }}
                        />
                    )
                })}
            </div>
        </div>
    )
}

// ─── DROPDOWN MODE ────────────────────────────────────────────────────────────

interface DropdownVariant {
    sku: string
    slug: string
    name: string
    label: string | null
    isCurrent: boolean
    subcategorySlug: string | null | undefined
}

interface DropdownSelectorProps {
    variants: DropdownVariant[]
    categorySlug: string
    subcategorySlug?: string | null
    label?: string
}

function DropdownSelector({ variants, categorySlug, subcategorySlug, label = 'Phiên bản' }: DropdownSelectorProps) {
    const router = useRouter()
    const currentVariant = variants.find(v => v.isCurrent)

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selected = variants.find(v => v.sku === e.target.value)
        if (!selected || selected.isCurrent) return
        const href = `/${categorySlug}/${selected.subcategorySlug || subcategorySlug}/${selected.slug}`
        router.push(href)
    }

    return (
        <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-widest">{label}</p>
            <select
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors cursor-pointer"
                value={currentVariant?.sku ?? ''}
                onChange={handleChange}
                aria-label={`Chọn ${label.toLowerCase()}`}
            >
                {variants.map((variant) => (
                    <option key={variant.sku} value={variant.sku}>
                        {variant.label || variant.name}
                    </option>
                ))}
            </select>
        </div>
    )
}

// ─── LEGACY CARD GRID MODE (original behavior for non-typed variants) ──────────

interface CardGridVariant {
    sku: string
    slug: string
    name: string
    priceDisplay: string | null
    price: number | null
    originalPrice: number | null
    color: { name: string; hex_code: string | null } | null | undefined
    isCurrent: boolean
    subcategorySlug: string | null | undefined
}

interface CardGridProps {
    variants: CardGridVariant[]
    categorySlug: string
    subcategorySlug?: string | null
    variantGroup: string
}

function CardGrid({ variants, categorySlug, subcategorySlug, variantGroup }: CardGridProps) {
    const uniqueColors = new Set(
        variants
            .map(v => v.color?.hex_code?.toLowerCase())
            .filter(Boolean)
    )
    const hasMultipleColors = uniqueColors.size > 1

    return (
        <div className="flex flex-col gap-3" role="group" aria-label="Chọn phiên bản sản phẩm">
            {/* Header */}
            <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-widest">
                    Phiên bản
                </p>
                <span className="text-[11px] text-stone-400 font-medium tabular-nums">
                    {variants.length} mẫu
                </span>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-1.5">
                {variants.map((variant) => {
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

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export function VariantSelector({
    currentSku,
    currentSlug,
    currentName,
    currentPriceDisplay,
    currentPrice,
    currentOriginalPrice,
    currentColor,
    variantType,
    variantLabel,
    variantGroup,
    siblings,
    categorySlug,
    subcategorySlug,
}: VariantSelectorProps) {
    // Type C/D: no variant_group → render nothing
    if (!siblings || siblings.length === 0) return null

    // Determine the effective variant_type by checking current product first,
    // then falling back to siblings (all should have the same type within a group)
    const effectiveVariantType = variantType
        ?? siblings.find(s => s.variant_type)?.variant_type
        ?? null

    // ── Mode: color swatches ──────────────────────────────────────────────────
    if (effectiveVariantType === 'color') {
        const allVariants: SwatchVariant[] = [
            {
                sku: currentSku,
                slug: currentSlug,
                name: currentName,
                label: variantLabel ?? null,
                priceDisplay: currentPriceDisplay,
                price: currentPrice ?? null,
                originalPrice: currentOriginalPrice ?? null,
                color: currentColor,
                isActive: true,
                isCurrent: true,
                subcategorySlug,
            },
            ...siblings.map(s => ({
                sku: s.sku,
                slug: s.slug,
                name: s.name,
                label: s.variant_label ?? null,
                priceDisplay: s.price_display,
                price: s.price,
                originalPrice: s.original_price,
                color: s.colors,
                isActive: s.is_active,
                isCurrent: false,
                subcategorySlug: s.subcategories?.slug ?? subcategorySlug,
            })),
        ].sort((a, b) => a.sku.localeCompare(b.sku))

        return (
            <ColorSwatches
                variants={allVariants}
                categorySlug={categorySlug}
                subcategorySlug={subcategorySlug}
            />
        )
    }

    // ── Mode: dropdown (seat_type or other non-null non-color type) ────────────
    if (effectiveVariantType !== null) {
        // Only include active siblings in dropdown (stub variants are not navigable)
        const activeSiblings = siblings.filter(s => s.is_active)
        if (activeSiblings.length === 0) return null

        const allVariants: DropdownVariant[] = [
            {
                sku: currentSku,
                slug: currentSlug,
                name: currentName,
                label: variantLabel ?? null,
                isCurrent: true,
                subcategorySlug,
            },
            ...activeSiblings.map(s => ({
                sku: s.sku,
                slug: s.slug,
                name: s.name,
                label: s.variant_label ?? null,
                isCurrent: false,
                subcategorySlug: s.subcategories?.slug ?? subcategorySlug,
            })),
        ].sort((a, b) => a.sku.localeCompare(b.sku))

        // Derive a human-readable label for the dropdown header from variant_type
        const dropdownLabel =
            effectiveVariantType === 'seat_type' ? 'Loại chỗ ngồi' : 'Phiên bản'

        return (
            <DropdownSelector
                variants={allVariants}
                categorySlug={categorySlug}
                subcategorySlug={subcategorySlug}
                label={dropdownLabel}
            />
        )
    }

    // ── Mode: legacy card grid (variant_type = null, backwards-compatible) ─────
    const allCardVariants: CardGridVariant[] = [
        {
            sku: currentSku,
            slug: currentSlug,
            name: currentName,
            priceDisplay: currentPriceDisplay,
            price: currentPrice ?? null,
            originalPrice: currentOriginalPrice ?? null,
            color: currentColor,
            isCurrent: true,
            subcategorySlug,
        },
        ...siblings
            .filter(s => s.is_active) // only active in card grid legacy mode
            .map(s => ({
                sku: s.sku,
                slug: s.slug,
                name: s.name,
                priceDisplay: s.price_display,
                price: s.price,
                originalPrice: s.original_price,
                color: s.colors,
                isCurrent: false,
                subcategorySlug: s.subcategories?.slug ?? subcategorySlug,
            })),
    ].sort((a, b) => a.sku.localeCompare(b.sku))

    return (
        <CardGrid
            variants={allCardVariants}
            categorySlug={categorySlug}
            subcategorySlug={subcategorySlug}
            variantGroup={variantGroup}
        />
    )
}
