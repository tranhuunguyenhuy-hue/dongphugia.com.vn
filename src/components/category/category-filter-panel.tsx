'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

interface Brand { id: number; name: string; slug?: string }

interface CategoryFilterPanelProps {
    brands: Brand[]
}

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

// ── Dual Range Slider ─────────────────────────────────────────────────────────
function DualRangeSlider({
    min, max, step, value, onChange
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
            #e5e7eb ${pct(hi)}%
        )`
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

// ── Brand Tag with Logo ───────────────────────────────────────────────────────
function BrandTag({ brand, active, onToggle }: { brand: Brand; active: boolean; onToggle: () => void }) {
    const slug = brand.slug || brand.name.toLowerCase().replace(/\s+/g, '-')
    const [imgFailed, setImgFailed] = useState(false)

    return (
        <button
            type="button"
            onClick={onToggle}
            className={`
                relative h-8 px-2.5 rounded-lg border flex items-center justify-center gap-1.5
                transition-all duration-200 cursor-pointer select-none group/tag
                ${active
                    ? 'bg-[#2E7A96]/8 border-[#2E7A96]/30 shadow-[0_0_0_1px_rgba(46,122,150,0.12)]'
                    : 'bg-white border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                }
            `}
            title={brand.name}
        >
            {/* Logo or text fallback */}
            {!imgFailed ? (
                <img
                    src={`/images/brands/${slug}.png`}
                    alt={brand.name}
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
                    {brand.name}
                </span>
            )}

            {/* Active check indicator */}
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

// ── Brand Section (compact tags) ──────────────────────────────────────────────
function BrandSection({
    brands, activeBrands, onToggle, activeCount,
}: {
    brands: Brand[]
    activeBrands: string[]
    onToggle: (name: string) => void
    activeCount: number
}) {
    const [open, setOpen] = useState(true)
    return (
        <div className="px-5 py-4 border-b border-neutral-100">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between group"
            >
                <div className="flex items-center gap-2">
                    <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                        Thương hiệu
                    </p>
                    {activeCount > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-[#2E7A96]/15 text-[#2E7A96] text-[9px] font-bold tabular-nums">
                            {activeCount}
                        </span>
                    )}
                </div>
                <svg
                    className={`h-3.5 w-3.5 text-neutral-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
            </button>

            {open && (
                <div className="mt-3 flex flex-wrap gap-2">
                    {brands.map((b) => (
                        <BrandTag
                            key={b.id}
                            brand={b}
                            active={activeBrands.includes(b.name)}
                            onToggle={() => onToggle(b.name)}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

// ── Main Component ────────────────────────────────────────────────────────────
export function CategoryFilterPanel({ brands }: CategoryFilterPanelProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const activeBrands = searchParams.get('brands')?.split(',').filter(Boolean) ?? []
    const priceParam = searchParams.get('price') ?? ''
    const [localPrice, setLocalPrice] = useState<[number, number]>(() =>
        priceParam ? parsePriceParam(priceParam) : [PRICE_MIN, PRICE_MAX]
    )
    const isPriceActive = priceParam !== ''
    const [advOpen, setAdvOpen] = useState(true)

    useEffect(() => {
        setLocalPrice(priceParam ? parsePriceParam(priceParam) : [PRICE_MIN, PRICE_MAX])
    }, [priceParam])

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const commitPrice = useCallback(
        (value: [number, number]) => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
            debounceRef.current = setTimeout(() => {
                const [lo, hi] = value
                const params = new URLSearchParams(searchParams.toString())
                if (lo <= PRICE_MIN && hi >= PRICE_MAX) params.delete('price')
                else params.set('price', `${lo}-${hi}`)
                router.push(`${pathname}?${params.toString()}`, { scroll: false })
            }, 400)
        },
        [router, pathname, searchParams]
    )

    const handleSliderChange = (value: [number, number]) => {
        setLocalPrice(value)
        commitPrice(value)
    }

    const updateParam = useCallback(
        (key: string, value: string | null) => {
            const params = new URLSearchParams(searchParams.toString())
            if (value) params.set(key, value)
            else params.delete(key)
            router.push(`${pathname}?${params.toString()}`, { scroll: false })
        },
        [router, pathname, searchParams]
    )

    const toggleBrand = (brandName: string) => {
        const next = activeBrands.includes(brandName)
            ? activeBrands.filter((b) => b !== brandName)
            : [...activeBrands, brandName]
        updateParam('brands', next.length ? next.join(',') : null)
    }

    const clearAll = () => {
        setLocalPrice([PRICE_MIN, PRICE_MAX])
        const params = new URLSearchParams(searchParams.toString())
        params.delete('brands')
        params.delete('price')
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const hasFilters = activeBrands.length > 0 || isPriceActive
    const totalActiveCount = activeBrands.length + (isPriceActive ? 1 : 0)

    return (
        <div className="bg-white rounded-md border border-neutral-200 [overflow:clip]">
            {/* Header */}
            <div className="px-5 py-3 border-b border-neutral-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400">
                        Lọc sản phẩm
                    </span>
                    {totalActiveCount > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-[#2E7A96] text-white text-[10px] font-bold tabular-nums">
                            {totalActiveCount}
                        </span>
                    )}
                </div>
                {hasFilters && (
                    <button
                        onClick={clearAll}
                        className="text-[10px] text-[#2E7A96] hover:text-[#2E7A96]/70 font-medium transition-colors flex items-center gap-1"
                    >
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                        Xoá lọc
                    </button>
                )}
            </div>

            {/* ── Lọc nâng cao — collapsible group ── */}
            <div className="px-5 py-4">
                <button
                    type="button"
                    onClick={() => setAdvOpen(!advOpen)}
                    className="w-full flex items-center justify-between mb-0 group"
                >
                    <div className="flex items-center gap-2">
                        <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                            Lọc nâng cao
                        </p>
                        {totalActiveCount > 0 && (
                            <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-[#2E7A96]/15 text-[#2E7A96] text-[9px] font-bold tabular-nums">
                                {totalActiveCount}
                            </span>
                        )}
                    </div>
                    <svg
                        className={`h-3.5 w-3.5 text-neutral-400 transition-transform duration-200 ${advOpen ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                </button>

                {advOpen && (
                    <div className="mt-4 space-y-5">
                        {/* ── Brands — logo tags ── */}
                        {brands.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                                    Thương hiệu
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {brands.map((b) => (
                                        <BrandTag
                                            key={b.id}
                                            brand={b}
                                            active={activeBrands.includes(b.name)}
                                            onToggle={() => toggleBrand(b.name)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── Price — dual range slider ── */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                                    Khoảng giá
                                </p>
                                {isPriceActive && (
                                    <button
                                        onClick={() => {
                                            setLocalPrice([PRICE_MIN, PRICE_MAX])
                                            updateParam('price', null)
                                        }}
                                        className="text-[10px] text-neutral-400 hover:text-neutral-600 transition-colors"
                                    >
                                        Reset
                                    </button>
                                )}
                            </div>
                            <DualRangeSlider
                                min={PRICE_MIN}
                                max={PRICE_MAX}
                                step={PRICE_STEP}
                                value={localPrice}
                                onChange={handleSliderChange}
                            />
                            <div className="flex items-center justify-between">
                                <span className={`text-[12px] font-semibold tabular-nums transition-colors ${
                                    isPriceActive ? 'text-[#2E7A96]' : 'text-neutral-500'
                                }`}>
                                    {formatPrice(localPrice[0])}
                                </span>
                                <span className="text-[10px] text-neutral-300 mx-1">—</span>
                                <span className={`text-[12px] font-semibold tabular-nums transition-colors ${
                                    isPriceActive ? 'text-[#2E7A96]' : 'text-neutral-500'
                                }`}>
                                    {localPrice[1] >= PRICE_MAX ? `${formatPrice(PRICE_MAX)}+` : formatPrice(localPrice[1])}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
