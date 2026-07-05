'use client'

import Link from 'next/link'
import type { VariantSibling } from '@/lib/public-api-products'
import { getPreferredVariantLabel } from '@/lib/variant-labels'

// ─── UTILS ────────────────────────────────────────────────────────────────────

/**
 * Rút gọn tên sản phẩm để hiển thị gọn gàng trên Variant Selector
 * Định dạng chuẩn: [Loại nắp] (Giấu dây) [Mã Series W/T/E] hoặc rút gọn phụ kiện Sen tắm
 */
function getShortVariantName(fullName: string, sku: string, subcategorySlug?: string | null, variantGroup?: string | null): string {
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

function getDisplayVariantLabel({
    explicitLabel,
    name,
    sku,
    subcategorySlug,
    variantGroup,
}: {
    explicitLabel?: string | null
    name: string
    sku: string
    subcategorySlug?: string | null
    variantGroup?: string | null
}) {
    return getPreferredVariantLabel({
        explicitLabel,
        name,
        sku,
        fallbackLabel: getShortVariantName(name, sku, subcategorySlug, variantGroup),
    }) || sku
}

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface VariantSelectorProps {
    currentSku: string
    currentSlug: string
    currentName: string
    currentImageMainUrl?: string | null
    currentPriceDisplay: string | null
    currentPrice?: number | null
    currentOriginalPrice?: number | null
    currentColor?: { name: string; hex_code: string | null } | null
    currentStockStatus?: string | null
    currentVariantOptions?: unknown
    variantAxes?: unknown
    selectedSku?: string | null
    onPreviewVariant?: (variant: VariantPreview) => void
    /** variant_type of the current product (drives UI mode) */
    variantType?: string | null
    /** variant_label of the current product */
    variantLabel?: string | null
    variantGroup: string
    siblings: VariantSibling[]
    categorySlug: string
    subcategorySlug?: string | null
}

export interface VariantPreview {
    id?: number
    sku: string
    slug: string
    url?: string
    name: string
    price: number | null
    original_price: number | null
    list_price?: number | null
    sale_price?: number | null
    online_discount_amount?: number | null
    price_display: string | null
    image_main_url: string | null
    stock_status?: string | null
    sale_status?: string | null
    price_state?: string | null
    is_active?: boolean
    subcategory_slug?: string | null
    canonical_category_slug?: string | null
    canonical_subcategory_slug?: string | null
    variant_options?: VariantOption[]
}

type VariantAxis = { key: string; label: string }
type VariantOption = { axis: string; value: string; label?: string; image_url?: string; price_text?: string; product_id?: string }
type VariantHrefInput = {
    slug: string
    url?: string | null
    categorySlug: string
    subcategorySlug?: string | null
    canonicalCategorySlug?: string | null
    canonicalSubcategorySlug?: string | null
}

type AxisVariant = VariantPreview & {
    variant_label: string | null
    variant_options: VariantOption[]
    category_slug: string
}

function parseVariantAxes(value: unknown): VariantAxis[] {
    if (!Array.isArray(value)) return []
    return value
        .map((axis) => {
            const item = axis as Record<string, unknown>
            return {
                key: String(item.key || ''),
                label: String(item.label || item.key || ''),
            }
        })
        .filter((axis) => axis.key && axis.label)
}

function parseVariantOptions(value: unknown): VariantOption[] {
    if (!Array.isArray(value)) return []
    return value
        .map((option) => {
            const item = option as Record<string, unknown>
            return {
                axis: String(item.axis || ''),
                value: String(item.value || ''),
                label: item.label ? String(item.label) : undefined,
                image_url: item.image_url ? String(item.image_url) : undefined,
                price_text: item.price_text ? String(item.price_text) : undefined,
                product_id: item.product_id ? String(item.product_id) : undefined,
            }
        })
        .filter((option) => option.axis && option.value)
}

function optionValue(options: VariantOption[], axis: string) {
    return options.find((option) => option.axis === axis)?.value || null
}

function stableVariantSort(a: AxisVariant, b: AxisVariant) {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1

    const priceA = a.price ?? -1
    const priceB = b.price ?? -1
    if (priceA !== priceB) return priceB - priceA

    return a.sku.localeCompare(b.sku)
}

function resolveVariantHref({
    slug,
    url,
    categorySlug,
    subcategorySlug,
    canonicalCategorySlug,
    canonicalSubcategorySlug,
}: VariantHrefInput) {
    if (url) return url
    return `/${canonicalCategorySlug || categorySlug}/${canonicalSubcategorySlug || subcategorySlug || 'all'}/${slug}`
}

function inferVariantAxesFromOptions(options: VariantOption[]): VariantAxis[] {
    const labelsByAxis = new Map<string, string>()

    for (const option of options) {
        if (!option.axis || labelsByAxis.has(option.axis)) continue
        labelsByAxis.set(option.axis, option.label || option.axis)
    }

    return Array.from(labelsByAxis.entries())
        .map(([key, label]) => ({ key, label }))
        .sort((a, b) => {
            const order = ['config', 'color']
            const aIndex = order.indexOf(a.key)
            const bIndex = order.indexOf(b.key)
            return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex)
        })
}

function buildFallbackCurrentOptions({
    axes,
    currentColor,
    variantLabel,
}: {
    axes: VariantAxis[]
    currentColor?: { name: string; hex_code: string | null } | null
    variantLabel?: string | null
}): VariantOption[] {
    const options: VariantOption[] = []

    for (const axis of axes) {
        if (axis.key === 'config' && variantLabel) {
            options.push({
                axis: 'config',
                label: axis.label || 'Cấu hình',
                value: variantLabel,
            })
        }

        if (axis.key === 'color' && currentColor?.name) {
            options.push({
                axis: 'color',
                label: axis.label || 'Màu sắc',
                value: currentColor.name,
            })
        }
    }

    return options
}

// ─── COLOR SWATCH MODE ────────────────────────────────────────────────────────

interface SwatchVariant {
    id?: number
    sku: string
    slug: string
    name: string
    label: string | null
    priceDisplay: string | null
    price: number | null
    originalPrice: number | null
    imageMainUrl: string | null
    color: { name: string; hex_code: string | null } | null | undefined
    isCurrent: boolean
    subcategorySlug: string | null | undefined
    variantOptions?: VariantOption[]
    stockStatus?: string | null
}

interface ColorSwatchesProps {
    variants: SwatchVariant[]
    onPreviewVariant?: (variant: VariantPreview) => void
}

function formatVariantPrice(price: number | null, priceDisplay: string | null) {
    if (price && price > 0) return `${new Intl.NumberFormat('vi-VN').format(price)}đ`
    return priceDisplay || 'Liên hệ'
}

function ColorSwatches({ variants, onPreviewVariant }: ColorSwatchesProps) {
    return (
        <div className="flex flex-col gap-3" role="group" aria-label="Chọn màu sắc">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-widest">Màu sắc</p>
            <div className="flex flex-wrap gap-2">
                {variants.map((variant) => {
                    const swatchLabel = variant.label || variant.color?.name || variant.name
                    const priceDisplay = formatVariantPrice(variant.price, variant.priceDisplay)
                    const cardClassName = [
                        'group relative flex min-h-[62px] w-[150px] items-center gap-2 rounded-lg bg-white px-2 py-2 pl-3 text-left transition-all duration-200',
                        variant.isCurrent
                            ? 'border border-brand-500 cursor-default shadow-sm'
                            : 'border border-stone-200 hover:border-brand-500 hover:bg-brand-50 hover:shadow-sm',
                    ].join(' ')

                    return (
                        <button
                            key={variant.sku}
                            type="button"
                            title={swatchLabel}
                            aria-current={variant.isCurrent ? 'true' : undefined}
                            aria-pressed={variant.isCurrent}
                            className={cardClassName}
                            onClick={() => {
                                if (variant.isCurrent) return
                                onPreviewVariant?.({
                                    id: variant.id,
                                    sku: variant.sku,
                                    slug: variant.slug,
                                    name: variant.name,
                                    price: variant.price,
                                    original_price: variant.originalPrice,
                                    price_display: variant.priceDisplay,
                                    image_main_url: variant.imageMainUrl,
                                    stock_status: variant.stockStatus,
                                    variant_options: variant.variantOptions,
                                })
                                window.dispatchEvent(new CustomEvent('product-variant-selection', {
                                    detail: {
                                        sku: variant.sku,
                                        color: swatchLabel,
                                        variantOptions: variant.variantOptions,
                                    },
                                }))
                                if (variant.imageMainUrl) {
                                    window.dispatchEvent(new CustomEvent('product-variant-preview', {
                                        detail: { imageUrl: variant.imageMainUrl },
                                    }))
                                }
                            }}
                        >
                            {variant.isCurrent && (
                                <span className="absolute left-0 top-0 flex h-4 w-4 items-start justify-start overflow-hidden rounded-tl-lg">
                                    <span className="h-0 w-0 border-l-[16px] border-t-[16px] border-l-brand-500 border-t-brand-500 border-r-transparent border-b-transparent" />
                                    <svg className="absolute left-[2px] top-[2px] size-2.5 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="2">
                                        <path d="M2 6.5 4.7 9 10 3" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </span>
                            )}
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-stone-100 bg-stone-50">
                                {variant.imageMainUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={variant.imageMainUrl} alt={swatchLabel} className="h-full w-full object-contain" loading="lazy" />
                                ) : (
                                    <span
                                        className="h-7 w-7 rounded-full border border-stone-200"
                                        style={{ backgroundColor: variant.color?.hex_code || '#e5e7eb' }}
                                    />
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <span className={`line-clamp-1 text-[12px] font-bold leading-tight ${variant.isCurrent ? 'text-brand-700' : 'text-stone-800 group-hover:text-brand-700'}`}>
                                    {swatchLabel}
                                </span>
                                <span className={`mt-1 block text-[12px] font-semibold leading-none ${variant.isCurrent ? 'text-brand-600' : 'text-stone-600 group-hover:text-brand-600'}`}>
                                    {priceDisplay}
                                </span>
                            </div>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

// ─── HITA-LIKE CARD GRID MODE ─────────────────────────────────────────────────

interface CardGridVariant {
    sku: string
    slug: string
    url?: string | null
    name: string
    label: string | null
    imageMainUrl: string | null
    priceDisplay: string | null
    price: number | null
    originalPrice: number | null
    color: { name: string; hex_code: string | null } | null | undefined
    isActive: boolean
    isCurrent: boolean
    subcategorySlug: string | null | undefined
    canonicalCategorySlug?: string | null
    canonicalSubcategorySlug?: string | null
}

interface CardGridProps {
    variants: CardGridVariant[]
    categorySlug: string
    subcategorySlug?: string | null
    variantGroup: string
    headingLabel?: string | null
}

function stableCardVariantSort(a: CardGridVariant, b: CardGridVariant) {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1

    const priceA = a.price ?? -1
    const priceB = b.price ?? -1
    if (priceA !== priceB) return priceB - priceA

    return a.sku.localeCompare(b.sku)
}

function CardGrid({ variants, categorySlug, subcategorySlug, variantGroup, headingLabel }: CardGridProps) {
    const orderedVariants = [...variants].sort(stableCardVariantSort)
    const resolvedHeadingLabel = headingLabel?.trim() || 'Phiên bản'

    return (
        <div className="flex flex-col gap-3" role="group" aria-label="Chọn phiên bản sản phẩm">
            {/* Header */}
            <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-widest">
                    {resolvedHeadingLabel}
                </p>
                <span className="text-[11px] text-stone-400 font-medium tabular-nums">
                    {orderedVariants.length} mẫu
                </span>
            </div>

            {/* Grid */}
            <div className="flex flex-wrap gap-2">
                {orderedVariants.map((variant) => {
                    const href = resolveVariantHref({
                        slug: variant.slug,
                        url: variant.url,
                        categorySlug,
                        subcategorySlug: variant.subcategorySlug || subcategorySlug,
                        canonicalCategorySlug: variant.canonicalCategorySlug,
                        canonicalSubcategorySlug: variant.canonicalSubcategorySlug,
                    })
                    const originalPrice = Number(variant.originalPrice)
                    const sellingPrice = Number(variant.price)

                    let priceDisplay = 'Liên hệ'
                    if (sellingPrice > 0) {
                        priceDisplay = new Intl.NumberFormat('vi-VN').format(sellingPrice) + 'đ'
                    } else if (variant.priceDisplay) {
                        priceDisplay = variant.priceDisplay
                    }

                    const displayLabel = getDisplayVariantLabel({
                        explicitLabel: variant.label,
                        name: variant.name,
                        sku: variant.sku,
                        subcategorySlug: variant.subcategorySlug || subcategorySlug,
                        variantGroup,
                    })
                    const hasDiscount = originalPrice > 0 && sellingPrice > 0 && originalPrice > sellingPrice
                    const discountPercent = hasDiscount ? Math.round(((originalPrice - sellingPrice) / originalPrice) * 100) : 0
                    const image = variant.imageMainUrl
                    const cardClassName = [
                        'group relative flex min-h-[62px] w-[170px] items-center gap-2 rounded-lg bg-white px-2 py-2 pl-3 transition-all duration-200',
                        variant.isCurrent
                            ? 'border border-brand-500 cursor-default select-none shadow-sm'
                            : 'border border-stone-200 cursor-pointer hover:border-brand-500 hover:bg-brand-50 hover:shadow-sm active:scale-[0.98]',
                    ].join(' ')
                    const cardInner = (
                        <>
                            {variant.isCurrent && (
                                <span className="absolute left-0 top-0 flex h-4 w-4 items-start justify-start overflow-hidden rounded-tl-lg">
                                    <span className="h-0 w-0 border-l-[16px] border-t-[16px] border-l-brand-500 border-t-brand-500 border-r-transparent border-b-transparent" />
                                    <svg className="absolute left-[2px] top-[2px] size-2.5 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="2">
                                        <path d="M2 6.5 4.7 9 10 3" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </span>
                            )}
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-stone-50 border border-stone-100">
                                {image ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={image} alt={displayLabel} className="h-full w-full object-contain" loading="lazy" />
                                ) : (
                                    <span className="text-[10px] font-semibold text-stone-400">{variant.sku}</span>
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-start gap-1">
                                    <span
                                        className={`line-clamp-1 text-[12px] font-bold leading-tight ${variant.isCurrent ? 'text-brand-700' : 'text-stone-800 group-hover:text-brand-700'}`}
                                        title={displayLabel}
                                    >
                                        {displayLabel}
                                    </span>
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-1">
                                    <span className={`text-[12px] font-semibold leading-none ${variant.isCurrent ? 'text-brand-600' : 'text-stone-600 group-hover:text-brand-600'}`}>
                                        {priceDisplay}
                                    </span>
                                    {hasDiscount && (
                                        <span className="rounded-[3px] bg-rose-500 px-1 py-[1.5px] text-[8px] font-bold leading-none text-white">
                                            -{discountPercent}%
                                        </span>
                                    )}
                                </div>
                            </div>
                        </>
                    )

                    return (
                        <Link
                            key={variant.sku}
                            href={href}
                            aria-current={variant.isCurrent ? 'true' : undefined}
                            className={cardClassName}
                            onClick={variant.isCurrent ? (event) => event.preventDefault() : undefined}
                        >
                            {cardInner}
                        </Link>
                    )
                })}
            </div>
        </div>
    )
}

function MultiAxisSelector({
    axes,
    variants,
    selectedSku,
    categorySlug,
    subcategorySlug,
    variantGroup,
    onPreviewVariant,
}: {
    axes: VariantAxis[]
    variants: AxisVariant[]
    selectedSku: string
    categorySlug: string
    subcategorySlug?: string | null
    variantGroup: string
    onPreviewVariant?: (variant: VariantPreview) => void
}) {
    const configAxis = axes.find((axis) => axis.key === 'config') || axes[0]
    const colorAxis = axes.find((axis) => axis.key === 'color')
    const orderedVariants = [...variants].sort(stableVariantSort)
    const selectedVariant = orderedVariants.find((variant) => variant.sku === selectedSku) || orderedVariants[0]
    const selectedConfig = optionValue(selectedVariant.variant_options, configAxis.key)

    const configVariants = orderedVariants
        .filter((variant) => variant.is_active)
        .filter((variant) => optionValue(variant.variant_options, configAxis.key))
        .filter((variant, index, all) => {
            const value = optionValue(variant.variant_options, configAxis.key)
            return all.findIndex((other) => optionValue(other.variant_options, configAxis.key) === value) === index
        })

    const colorVariants = colorAxis
        ? orderedVariants.filter((variant) => optionValue(variant.variant_options, configAxis.key) === selectedConfig && optionValue(variant.variant_options, colorAxis.key))
        : []

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3" role="group" aria-label={`Chọn ${configAxis.label}`}>
                <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-stone-500 uppercase tracking-widest">{configAxis.label}</p>
                    <span className="text-[11px] text-stone-400 font-medium tabular-nums">{configVariants.length} mẫu</span>
                </div>
                <div className="flex flex-wrap gap-2">
                    {configVariants.map((variant) => {
                        const href = resolveVariantHref({
                            slug: variant.slug,
                            url: variant.url,
                            categorySlug,
                            subcategorySlug: variant.subcategory_slug || subcategorySlug,
                            canonicalCategorySlug: variant.canonical_category_slug,
                            canonicalSubcategorySlug: variant.canonical_subcategory_slug,
                        })
                        const isSelectedConfig = optionValue(variant.variant_options, configAxis.key) === selectedConfig
                        const priceDisplay = variant.price && variant.price > 0
                            ? new Intl.NumberFormat('vi-VN').format(variant.price) + 'đ'
                            : variant.price_display || 'Liên hệ'
                        const displayLabel = getDisplayVariantLabel({
                            explicitLabel: optionValue(variant.variant_options, configAxis.key) || variant.variant_label,
                            name: variant.name,
                            sku: variant.sku,
                            subcategorySlug: variant.subcategory_slug || subcategorySlug,
                            variantGroup,
                        })
                        const cardClassName = [
                            'group relative flex min-h-[62px] w-[180px] items-center gap-2 rounded-lg bg-white px-2 py-2 pl-3 transition-all duration-200',
                            isSelectedConfig
                                ? 'border border-brand-500 shadow-sm'
                                : 'border border-stone-200 hover:border-brand-500 hover:bg-brand-50 hover:shadow-sm',
                        ].join(' ')

                        return (
                            <Link
                                key={variant.sku}
                                href={href}
                                aria-current={isSelectedConfig ? 'true' : undefined}
                                className={cardClassName}
                            >
                                {isSelectedConfig && (
                                    <span className="absolute left-0 top-0 flex h-4 w-4 items-start justify-start overflow-hidden rounded-tl-lg">
                                        <span className="h-0 w-0 border-l-[16px] border-t-[16px] border-l-brand-500 border-t-brand-500 border-r-transparent border-b-transparent" />
                                        <svg className="absolute left-[2px] top-[2px] size-2.5 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="2">
                                            <path d="M2 6.5 4.7 9 10 3" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </span>
                                )}
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-stone-100 bg-stone-50">
                                    {variant.image_main_url ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={variant.image_main_url} alt={displayLabel} className="h-full w-full object-contain" loading="lazy" />
                                    ) : (
                                        <span className="text-[10px] font-semibold text-stone-400">{variant.sku}</span>
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <span className={`line-clamp-2 text-[12px] font-bold leading-tight ${isSelectedConfig ? 'text-brand-700' : 'text-stone-800 group-hover:text-brand-700'}`}>
                                        {displayLabel}
                                    </span>
                                    <span className={`mt-1 block text-[12px] font-semibold leading-none ${isSelectedConfig ? 'text-brand-600' : 'text-stone-600 group-hover:text-brand-600'}`}>
                                        {priceDisplay}
                                    </span>
                                </div>
                            </Link>
                        )
                    })}
                </div>
            </div>

            {colorAxis && colorVariants.length > 0 && (
                <div className="flex flex-col gap-3" role="group" aria-label={`Chọn ${colorAxis.label}`}>
                    <p className="text-xs font-semibold text-stone-500 uppercase tracking-widest">{colorAxis.label}</p>
                    <div className="flex flex-wrap gap-2">
                        {colorVariants.map((variant) => {
                            const colorLabel = getDisplayVariantLabel({
                                explicitLabel: optionValue(variant.variant_options, colorAxis.key) || variant.variant_label,
                                name: variant.name,
                                sku: variant.sku,
                                subcategorySlug: variant.subcategory_slug || subcategorySlug,
                                variantGroup,
                            })
                            const isSelected = variant.sku === selectedVariant.sku
                            const isUnavailable = !variant.sku

                            return (
                                <button
                                    key={variant.sku}
                                    type="button"
                                    disabled={isUnavailable}
                                    onClick={() => {
                                        onPreviewVariant?.(variant)
                                        window.dispatchEvent(new CustomEvent('product-variant-selection', {
                                            detail: {
                                                sku: variant.sku,
                                                color: colorLabel,
                                                variantOptions: variant.variant_options,
                                            },
                                        }))
                                        if (variant.image_main_url) {
                                            window.dispatchEvent(new CustomEvent('product-variant-preview', { detail: { imageUrl: variant.image_main_url } }))
                                        }
                                    }}
                                    title={colorLabel}
                                    aria-pressed={isSelected}
                                    className={`group flex min-w-[96px] items-center gap-2 rounded-lg border bg-white px-2 py-2 text-left transition-all ${isSelected ? 'border-brand-500 shadow-sm ring-1 ring-brand-500/10' : 'border-stone-200 hover:border-brand-400 hover:bg-brand-50'} ${isUnavailable ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
                                >
                                    <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md border border-stone-100 bg-stone-50">
                                        {variant.image_main_url ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={variant.image_main_url} alt={colorLabel} className="h-full w-full object-contain" loading="lazy" />
                                        ) : (
                                            <span className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-stone-400">{colorLabel.slice(0, 2)}</span>
                                        )}
                                    </span>
                                    <span className="flex min-w-0 flex-col">
                                        <span className={`text-[12px] font-bold leading-tight ${isSelected ? 'text-brand-700' : 'text-stone-800 group-hover:text-brand-700'}`}>
                                            {colorLabel}
                                        </span>
                                        <span className="text-[11px] font-medium text-stone-500">
                                            {variant.price && variant.price > 0 ? new Intl.NumberFormat('vi-VN').format(variant.price) + 'đ' : variant.price_display || 'Liên hệ'}
                                        </span>
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}

            {colorAxis && colorVariants.length === 0 && (
                <div className="rounded-lg border border-dashed border-stone-200 bg-stone-50 px-3 py-2 text-xs font-medium text-stone-500">
                    Cấu hình này chưa có tuỳ chọn {colorAxis.label.toLowerCase()} trên Hita.
                </div>
            )}
        </div>
    )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export function VariantSelector({
    currentSku,
    currentSlug,
    currentName,
    currentImageMainUrl,
    currentPriceDisplay,
    currentPrice,
    currentOriginalPrice,
    currentColor,
    currentStockStatus,
    currentVariantOptions,
    variantAxes,
    selectedSku,
    onPreviewVariant,
    variantType,
    variantLabel,
    variantGroup,
    siblings,
    categorySlug,
    subcategorySlug,
}: VariantSelectorProps) {
    // Type C/D: no variant_group → render nothing
    if (!siblings || siblings.length === 0) return null

    const parsedCurrentOptions = parseVariantOptions(currentVariantOptions)
    const siblingOptions = siblings.flatMap((s) => parseVariantOptions(s.variant_options))
    const axes = parseVariantAxes(variantAxes)
    const effectiveAxes = axes.length > 0
        ? axes
        : inferVariantAxesFromOptions([...parsedCurrentOptions, ...siblingOptions])
    const currentOptions = parsedCurrentOptions.length > 0
        ? parsedCurrentOptions
        : buildFallbackCurrentOptions({
            axes: effectiveAxes,
            currentColor,
            variantLabel,
        })
    const primaryAxisLabel = currentOptions[0]?.label || effectiveAxes[0]?.label || null
    const hasMultiAxis = effectiveAxes.length > 1 && effectiveAxes.some((axis) => axis.key === 'config') && effectiveAxes.some((axis) => axis.key === 'color')

    if (hasMultiAxis) {
        const allVariants: AxisVariant[] = [
            {
                sku: currentSku,
                slug: currentSlug,
                name: currentName,
                price: currentPrice ?? null,
                original_price: currentOriginalPrice ?? null,
                online_discount_amount: null,
                price_display: currentPriceDisplay,
                image_main_url: currentImageMainUrl ?? null,
                stock_status: currentStockStatus ?? null,
                is_active: true,
                variant_label: variantLabel ?? null,
                variant_options: currentOptions,
                url: resolveVariantHref({
                    slug: currentSlug,
                    categorySlug,
                    subcategorySlug,
                }),
                category_slug: categorySlug,
                subcategory_slug: subcategorySlug,
            },
            ...siblings.map((s) => ({
                id: s.id,
                sku: s.sku,
                slug: s.slug,
                name: s.name,
                price: s.price,
                original_price: s.original_price,
                online_discount_amount: s.online_discount_amount ?? null,
                price_display: s.price_display,
                image_main_url: s.image_main_url,
                stock_status: s.stock_status ?? null,
                is_active: s.is_active,
                variant_label: s.variant_label,
                variant_options: parseVariantOptions(s.variant_options),
                url: s.url,
                canonical_category_slug: s.canonical_category_slug,
                canonical_subcategory_slug: s.canonical_subcategory_slug,
                category_slug: s.categories.slug,
                subcategory_slug: s.subcategories?.slug ?? subcategorySlug,
            })),
        ].filter((variant) => variant.variant_options.length > 0)

        return (
            <MultiAxisSelector
                axes={effectiveAxes}
                variants={allVariants}
                selectedSku={selectedSku || currentSku}
                categorySlug={categorySlug}
                subcategorySlug={subcategorySlug}
                variantGroup={variantGroup}
                onPreviewVariant={onPreviewVariant}
            />
        )
    }

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
                imageMainUrl: currentImageMainUrl ?? null,
                color: currentColor,
                isCurrent: (selectedSku || currentSku) === currentSku,
                subcategorySlug,
                variantOptions: currentOptions,
                stockStatus: currentStockStatus ?? null,
                url: resolveVariantHref({
                    slug: currentSlug,
                    categorySlug,
                    subcategorySlug,
                }),
                canonical_category_slug: categorySlug,
                canonical_subcategory_slug: subcategorySlug,
            },
            ...siblings.map(s => ({
                id: s.id,
                sku: s.sku,
                slug: s.slug,
                name: s.name,
                label: s.variant_label ?? null,
                priceDisplay: s.price_display,
                price: s.price,
                originalPrice: s.original_price,
                imageMainUrl: s.image_main_url,
                color: s.colors,
                isCurrent: s.sku === (selectedSku || currentSku),
                subcategorySlug: s.subcategories?.slug ?? subcategorySlug,
                variantOptions: parseVariantOptions(s.variant_options),
                stockStatus: s.stock_status ?? null,
                url: s.url,
                canonical_category_slug: s.canonical_category_slug,
                canonical_subcategory_slug: s.canonical_subcategory_slug,
            })),
        ].sort((a, b) => a.sku.localeCompare(b.sku))

        return (
            <ColorSwatches
                variants={allVariants}
                onPreviewVariant={onPreviewVariant}
            />
        )
    }

    // ── Mode: Hita-like cards (seat_type/configuration/size) ──────────────────
    if (effectiveVariantType !== null) {
        const activeSiblings = siblings.filter(s => s.is_active)
        if (activeSiblings.length === 0) return null

        const allCardVariants: CardGridVariant[] = [
            {
                sku: currentSku,
                slug: currentSlug,
                name: currentName,
                label: variantLabel ?? null,
                imageMainUrl: currentImageMainUrl ?? null,
                priceDisplay: currentPriceDisplay,
                price: currentPrice ?? null,
                originalPrice: currentOriginalPrice ?? null,
                color: currentColor,
                isActive: true,
                isCurrent: currentSku === selectedSku || !selectedSku,
                subcategorySlug,
                url: resolveVariantHref({
                    slug: currentSlug,
                    categorySlug,
                    subcategorySlug,
                }),
                canonicalCategorySlug: categorySlug,
                canonicalSubcategorySlug: subcategorySlug,
            },
            ...activeSiblings.map(s => ({
                sku: s.sku,
                slug: s.slug,
                url: s.url,
                name: s.name,
                label: s.variant_label ?? null,
                imageMainUrl: s.image_main_url,
                priceDisplay: s.price_display,
                price: s.price,
                originalPrice: s.original_price,
                color: s.colors,
                isActive: s.is_active,
                isCurrent: s.sku === currentSku,
                subcategorySlug: s.subcategories?.slug ?? subcategorySlug,
                canonicalCategorySlug: s.canonical_category_slug,
                canonicalSubcategorySlug: s.canonical_subcategory_slug,
            })),
        ].sort((a, b) => a.sku.localeCompare(b.sku))

        return (
            <CardGrid
                variants={allCardVariants}
                categorySlug={categorySlug}
                subcategorySlug={subcategorySlug}
                variantGroup={variantGroup}
                headingLabel={primaryAxisLabel}
            />
        )
    }

    // ── Mode: legacy card grid (variant_type = null, backwards-compatible) ─────
    const allCardVariants: CardGridVariant[] = [
            {
                sku: currentSku,
                slug: currentSlug,
                name: currentName,
                label: variantLabel ?? null,
                imageMainUrl: currentImageMainUrl ?? null,
                priceDisplay: currentPriceDisplay,
                price: currentPrice ?? null,
                originalPrice: currentOriginalPrice ?? null,
                color: currentColor,
                isActive: true,
                isCurrent: currentSku === selectedSku || !selectedSku,
                subcategorySlug,
                url: resolveVariantHref({
                    slug: currentSlug,
                    categorySlug,
                    subcategorySlug,
                }),
                canonicalCategorySlug: categorySlug,
                canonicalSubcategorySlug: subcategorySlug,
            },
            ...siblings
                .filter(s => s.is_active) // only active in card grid legacy mode
                .map(s => ({
                    sku: s.sku,
                    slug: s.slug,
                    url: s.url,
                    name: s.name,
                    label: s.variant_label ?? null,
                    imageMainUrl: s.image_main_url,
                    priceDisplay: s.price_display,
                    price: s.price,
                    originalPrice: s.original_price,
                    color: s.colors,
                    isActive: s.is_active,
                    isCurrent: s.sku === currentSku,
                    subcategorySlug: s.subcategories?.slug ?? subcategorySlug,
                    canonicalCategorySlug: s.canonical_category_slug,
                    canonicalSubcategorySlug: s.canonical_subcategory_slug,
                })),
    ].sort((a, b) => a.sku.localeCompare(b.sku))

    return (
        <CardGrid
            variants={allCardVariants}
            categorySlug={categorySlug}
            subcategorySlug={subcategorySlug}
            variantGroup={variantGroup}
            headingLabel={primaryAxisLabel}
        />
    )
}
