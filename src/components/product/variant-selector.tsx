'use client'

import Link from 'next/link'
import type { VariantSibling } from '@/lib/public-api-products'

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface VariantSelectorProps {
    currentSku: string
    currentSlug: string
    currentName: string
    currentPriceDisplay: string | null
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
            isCurrent: true,
            subcategorySlug,
        },
        ...siblings.map(s => ({
            sku: s.sku,
            slug: s.slug,
            name: s.name,
            priceDisplay: s.price_display,
            isCurrent: false,
            subcategorySlug: s.subcategories?.slug || subcategorySlug,
        })),
    ].sort((a, b) => a.sku.localeCompare(b.sku))

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

            {/* Grid — 2 cols always, scrollable if many rows */}
            <div className="grid grid-cols-2 gap-2 max-h-[320px] overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-stone-200 scrollbar-track-transparent">
                {allVariants.map((variant) => {
                    const href = `/${categorySlug}/${variant.subcategorySlug || subcategorySlug}/${variant.slug}`
                    const price = variant.priceDisplay || 'Liên hệ'

                    if (variant.isCurrent) {
                        return (
                            <div
                                key={variant.sku}
                                className="
                                    relative flex flex-col justify-between gap-2
                                    p-3 rounded-xl h-full min-h-[84px]
                                    bg-brand-50 border-2 border-brand-500
                                    cursor-default select-none
                                    ring-2 ring-brand-200/60 ring-offset-1
                                "
                                aria-current="true"
                            >
                                {/* Active top-bar accent */}
                                <div className="absolute top-0 left-3 right-3 h-[2px] rounded-b-full bg-brand-400 opacity-60" />

                                {/* Name */}
                                <p className="text-[12px] font-semibold text-brand-800 leading-snug line-clamp-3 mt-1">
                                    {variant.name}
                                </p>

                                {/* Price + SKU row */}
                                <div className="flex items-end justify-between gap-1 mt-auto">
                                    <p className="text-[10px] text-brand-400 font-mono truncate max-w-[50%]">
                                        {variant.sku}
                                    </p>
                                    <p className="text-[12px] font-bold text-brand-600 whitespace-nowrap leading-none">
                                        {price}
                                    </p>
                                </div>
                            </div>
                        )
                    }

                    return (
                        <Link
                            key={variant.sku}
                            href={href}
                            className="
                                group relative flex flex-col justify-between gap-2
                                p-3 rounded-xl h-full min-h-[84px]
                                bg-white border border-stone-200
                                hover:border-brand-300 hover:bg-brand-50/40 hover:shadow-sm
                                active:scale-[0.98]
                                transition-all duration-150 cursor-pointer
                            "
                        >
                            {/* Name */}
                            <p className="text-[12px] font-medium text-stone-700 leading-snug line-clamp-3 group-hover:text-brand-700 transition-colors">
                                {variant.name}
                            </p>

                            {/* Price + SKU row */}
                            <div className="flex items-end justify-between gap-1 mt-auto">
                                <p className="text-[10px] text-stone-350 font-mono truncate max-w-[50%] text-stone-400">
                                    {variant.sku}
                                </p>
                                <p className="text-[12px] font-semibold text-stone-600 whitespace-nowrap leading-none group-hover:text-brand-600 transition-colors">
                                    {price}
                                </p>
                            </div>
                        </Link>
                    )
                })}
            </div>
        </div>
    )
}
