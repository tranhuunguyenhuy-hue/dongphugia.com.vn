'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { ChevronDown } from 'lucide-react'

// --- Types ---
type FilterOption = { name: string; slug: string; icon_name?: string | null; logo_url?: string | null }

export type AvailableFiltersData = {
    subcategories: FilterOption[]
    brands: FilterOption[]
    materials: FilterOption[]
    origins: FilterOption[]
    features: FilterOption[]
}

// ── Price constants ────────────────────────────────────────────────────────────
const PRICE_MIN = 0
const PRICE_MAX = 50_000_000
const PRICE_STEP = 500_000

function formatPrice(value: number): string {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}tr`
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`
    return `${value}`
}

function parsePriceParam(param: string): [number, number] {
    const [a, b] = param.split('-').map(Number)
    if (!isNaN(a) && !isNaN(b)) return [a, Math.min(b, PRICE_MAX)]
    return [PRICE_MIN, PRICE_MAX]
}

// ── Dual Range Slider ──────────────────────────────────────────────────────────
function DualRangeSlider({
    min, max, step, value, onChange,
}: {
    min: number; max: number; step: number
    value: [number, number]
    onChange: (v: [number, number]) => void
}) {
    const [lo, hi] = value
    const pct = (v: number) => ((v - min) / (max - min)) * 100

    const handleLo = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = Math.min(Number(e.target.value), hi - step)
        onChange([v, hi])
    }
    const handleHi = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = Math.max(Number(e.target.value), lo + step)
        onChange([lo, v])
    }

    const trackStyle = {
        background: `linear-gradient(to right,
            #e5e7eb ${pct(lo)}%,
            #2E7A96 ${pct(lo)}%,
            #2E7A96 ${pct(hi)}%,
            #e5e7eb ${pct(hi)}%)`
    }

    const thumbCls = `
        absolute w-full h-1.5 appearance-none bg-transparent cursor-pointer z-10
        [&::-webkit-slider-thumb]:appearance-none
        [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
        [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
        [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#2E7A96]
        [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-grab
        [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-100
        [&::-webkit-slider-thumb:active]:scale-110 [&::-webkit-slider-thumb:active]:cursor-grabbing
        [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4
        [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white
        [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[#2E7A96]
        [&::-moz-range-thumb]:shadow-sm [&::-moz-range-thumb]:cursor-grab
    `

    return (
        <div className="relative h-5 flex items-center" style={{ WebkitTapHighlightColor: 'transparent' }}>
            <div className="absolute w-full h-1.5 rounded-full" style={trackStyle} />
            <input type="range" min={min} max={max} step={step} value={lo}
                onChange={handleLo} className={thumbCls} />
            <input type="range" min={min} max={max} step={step} value={hi}
                onChange={handleHi}
                className={`${thumbCls} pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-moz-range-thumb]:pointer-events-auto`} />
        </div>
    )
}

// ── Collapsible Section ────────────────────────────────────────────────────────
function FilterSection({
    title, children, defaultOpen = true,
}: {
    title: string
    children: React.ReactNode
    defaultOpen?: boolean
}) {
    const [open, setOpen] = useState(defaultOpen)
    return (
        <div className="px-5 py-4 border-b border-neutral-100 last:border-0">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between mb-0 group"
            >
                <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                    {title}
                </p>
                <ChevronDown className={`h-3.5 w-3.5 text-neutral-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && <div className="mt-3">{children}</div>}
        </div>
    )
}

// ── CheckRow (matches CategoryFilterPanel brand button style) ──────────────────
function CheckRow({
    label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[12px] transition-all duration-150 text-left ${
                active
                    ? 'bg-[#2E7A96]/10 text-[#2E7A96] font-medium'
                    : 'text-neutral-600 hover:bg-neutral-50'
            }`}
        >
            <span className={`w-3.5 h-3.5 rounded-sm border flex-shrink-0 flex items-center justify-center transition-colors ${
                active ? 'bg-[#2E7A96] border-[#2E7A96]' : 'border-neutral-300'
            }`}>
                {active && (
                    <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                )}
            </span>
            {label}
        </button>
    )
}

// ── Brand Tag Chip (logo-based) ────────────────────────────────────────────────
function BrandTagChip({ slug, name, active, onClick }: {
    slug: string; name: string; active: boolean; onClick: () => void
}) {
    const [imgFailed, setImgFailed] = React.useState(false)
    return (
        <button
            type="button"
            onClick={onClick}
            className={`
                relative h-8 px-2.5 rounded-lg border flex items-center justify-center gap-1.5
                transition-all duration-200 cursor-pointer select-none group/tag
                ${active
                    ? 'bg-[#2E7A96]/8 border-[#2E7A96]/30 shadow-[0_0_0_1px_rgba(46,122,150,0.12)]'
                    : 'bg-white border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                }
            `}
            title={name}
        >
            {!imgFailed ? (
                <img
                    src={`/images/brands/${slug}.png`}
                    alt={name}
                    className={`h-[16px] max-w-[56px] object-contain transition-all duration-200 ${
                        active ? 'opacity-100' : 'opacity-50 grayscale group-hover/tag:opacity-80 group-hover/tag:grayscale-0'
                    }`}
                    loading="lazy"
                    onError={() => setImgFailed(true)}
                />
            ) : (
                <span className={`text-[11px] font-semibold whitespace-nowrap transition-colors ${
                    active ? 'text-[#2E7A96]' : 'text-neutral-500 group-hover/tag:text-neutral-700'
                }`}>
                    {name}
                </span>
            )}
            {active && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#2E7A96] flex items-center justify-center">
                    <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                </span>
            )}
        </button>
    )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function AdvancedSidebarFilter({
    availableFilters,
    hideSubcategoryFilter = false,
    hideTitle = false,
}: {
    availableFilters: AvailableFiltersData
    hideSubcategoryFilter?: boolean
    hideTitle?: boolean
}) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    // ── Helpers ──────────────────────────────────────────────────────────────
    const getArr = (key: string) => {
        const val = searchParams.get(key)
        return val ? val.split(',') : []
    }

    const subcategorySlugs = getArr('sub')
    const brandSlugs       = getArr('brand')
    const featureSlugs     = getArr('features')
    const materialSlugs    = getArr('material')
    const originSlugs      = getArr('origin')

    const priceParam = searchParams.get('price') ?? ''
    const [localPrice, setLocalPrice] = useState<[number, number]>(() =>
        priceParam ? parsePriceParam(priceParam) : [PRICE_MIN, PRICE_MAX]
    )
    const isPriceActive = priceParam !== ''

    useEffect(() => {
        setLocalPrice(priceParam ? parsePriceParam(priceParam) : [PRICE_MIN, PRICE_MAX])
    }, [priceParam])

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const commitPrice = useCallback((value: [number, number]) => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
            const [lo, hi] = value
            const params = new URLSearchParams(searchParams.toString())
            if (lo <= PRICE_MIN && hi >= PRICE_MAX) params.delete('price')
            else params.set('price', `${lo}-${hi}`)
            params.set('page', '1')
            router.push(`${pathname}?${params.toString()}`, { scroll: false })
        }, 400)
    }, [router, pathname, searchParams])

    const handleSlider = (value: [number, number]) => {
        setLocalPrice(value)
        commitPrice(value)
    }

    const toggle = (key: string, current: string[], slug: string) => {
        const next = current.includes(slug)
            ? current.filter(s => s !== slug)
            : [...current, slug]
        const params = new URLSearchParams(searchParams.toString())
        if (next.length) params.set(key, next.join(','))
        else params.delete(key)
        params.set('page', '1')
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const isNew      = searchParams.get('is_new') === 'true'
    const isFeatured = searchParams.get('is_featured') === 'true'

    const hasFilters =
        brandSlugs.length > 0 || featureSlugs.length > 0 ||
        materialSlugs.length > 0 || originSlugs.length > 0 ||
        isPriceActive || isNew || isFeatured

    const clearAll = () => {
        setLocalPrice([PRICE_MIN, PRICE_MAX])
        const params = new URLSearchParams(searchParams.toString())
        ;['brand', 'features', 'material', 'origin', 'price', 'is_new', 'is_featured', 'priceRange'].forEach(k => params.delete(k))
        params.set('page', '1')
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }

    return (
        <div className="bg-white rounded-md border border-neutral-200 [overflow:clip]">
            {/* Header */}
            <div className="px-5 py-3 border-b border-neutral-100 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400">
                    Lọc sản phẩm
                </span>
                {hasFilters && (
                    <button onClick={clearAll} className="text-[10px] text-[#2E7A96] hover:underline font-medium">
                        Xoá lọc
                    </button>
                )}
            </div>

            <div className="divide-y divide-neutral-100">
                {/* Subcategory (hidden on sub pages) */}
                {!hideSubcategoryFilter && availableFilters.subcategories.length > 0 && (
                    <FilterSection title="Loại sản phẩm">
                        <div className="space-y-1">
                            {availableFilters.subcategories.map(opt => (
                                <CheckRow
                                    key={opt.slug} label={opt.name}
                                    active={subcategorySlugs.includes(opt.slug)}
                                    onClick={() => toggle('sub', subcategorySlugs, opt.slug)}
                                />
                            ))}
                        </div>
                    </FilterSection>
                )}

                {/* Brands — logo tag chips */}
                {availableFilters.brands.length > 0 && (
                    <FilterSection title="Thương hiệu">
                        <div className="flex flex-wrap gap-2">
                            {availableFilters.brands.map(b => {
                                const active = brandSlugs.includes(b.slug)
                                return (
                                    <BrandTagChip
                                        key={b.slug}
                                        slug={b.slug}
                                        name={b.name}
                                        active={active}
                                        onClick={() => toggle('brand', brandSlugs, b.slug)}
                                    />
                                )
                            })}
                        </div>
                    </FilterSection>
                )}

                {/* Price — dual range slider */}
                <FilterSection title="Khoảng giá">
                    <div className="flex items-center justify-between mb-4">
                        <span />
                        {isPriceActive && (
                            <button
                                onClick={() => {
                                    setLocalPrice([PRICE_MIN, PRICE_MAX])
                                    const params = new URLSearchParams(searchParams.toString())
                                    params.delete('price')
                                    params.set('page', '1')
                                    router.push(`${pathname}?${params.toString()}`, { scroll: false })
                                }}
                                className="text-[10px] text-neutral-400 hover:text-neutral-600 transition-colors"
                            >
                                Reset
                            </button>
                        )}
                    </div>
                    <DualRangeSlider
                        min={PRICE_MIN} max={PRICE_MAX} step={PRICE_STEP}
                        value={localPrice} onChange={handleSlider}
                    />
                    <div className="flex items-center justify-between mt-3">
                        <span className={`text-[12px] font-semibold tabular-nums transition-colors ${isPriceActive ? 'text-[#2E7A96]' : 'text-neutral-500'}`}>
                            {formatPrice(localPrice[0])}
                        </span>
                        <span className="text-[10px] text-neutral-300 mx-1">—</span>
                        <span className={`text-[12px] font-semibold tabular-nums transition-colors ${isPriceActive ? 'text-[#2E7A96]' : 'text-neutral-500'}`}>
                            {localPrice[1] >= PRICE_MAX ? `${formatPrice(PRICE_MAX)}+` : formatPrice(localPrice[1])}
                        </span>
                    </div>
                </FilterSection>

                {/* Features */}
                {availableFilters.features.length > 0 && (
                    <FilterSection title="Chức năng" defaultOpen={false}>
                        <div className="space-y-1">
                            {availableFilters.features.map(opt => (
                                <CheckRow
                                    key={opt.slug} label={opt.name}
                                    active={featureSlugs.includes(opt.slug)}
                                    onClick={() => toggle('features', featureSlugs, opt.slug)}
                                />
                            ))}
                        </div>
                    </FilterSection>
                )}

                {/* Materials */}
                {availableFilters.materials.length > 0 && (
                    <FilterSection title="Chất liệu" defaultOpen={false}>
                        <div className="space-y-1">
                            {availableFilters.materials.map(opt => (
                                <CheckRow
                                    key={opt.slug} label={opt.name}
                                    active={materialSlugs.includes(opt.slug)}
                                    onClick={() => toggle('material', materialSlugs, opt.slug)}
                                />
                            ))}
                        </div>
                    </FilterSection>
                )}

                {/* Origins */}
                {availableFilters.origins.length > 0 && (
                    <FilterSection title="Xuất xứ" defaultOpen={false}>
                        <div className="space-y-1">
                            {availableFilters.origins.map(opt => (
                                <CheckRow
                                    key={opt.slug} label={opt.name}
                                    active={originSlugs.includes(opt.slug)}
                                    onClick={() => toggle('origin', originSlugs, opt.slug)}
                                />
                            ))}
                        </div>
                    </FilterSection>
                )}

                {/* Misc */}
                <FilterSection title="Tùy chọn khác" defaultOpen={false}>
                    <div className="space-y-1">
                        {[
                            { label: 'Sản phẩm mới', active: isNew, action: () => {
                                const params = new URLSearchParams(searchParams.toString())
                                isNew ? params.delete('is_new') : params.set('is_new', 'true')
                                params.set('page', '1')
                                router.push(`${pathname}?${params.toString()}`, { scroll: false })
                            }},
                            { label: 'Sản phẩm nổi bật', active: isFeatured, action: () => {
                                const params = new URLSearchParams(searchParams.toString())
                                isFeatured ? params.delete('is_featured') : params.set('is_featured', 'true')
                                params.set('page', '1')
                                router.push(`${pathname}?${params.toString()}`, { scroll: false })
                            }},
                        ].map(({ label, active, action }) => (
                            <CheckRow key={label} label={label} active={active} onClick={action} />
                        ))}
                    </div>
                </FilterSection>
            </div>
        </div>
    )
}
