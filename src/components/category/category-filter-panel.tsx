'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

interface Brand { id: number; name: string }

interface CategoryFilterPanelProps {
    brands: Brand[]
}

const PRICE_MIN = 0
const PRICE_MAX = 50_000_000  // 50 triệu
const PRICE_STEP = 500_000    // 500k mỗi bước

function formatPrice(value: number): string {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}tr`
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`
    return `${value}`
}

// Parse URL price param → [min, max]
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

    return (
        <div className="relative h-5 flex items-center" style={{ WebkitTapHighlightColor: 'transparent' }}>
            {/* Track */}
            <div className="absolute w-full h-1.5 rounded-full" style={trackStyle} />

            {/* Low handle */}
            <input
                type="range"
                min={min} max={max} step={step}
                value={lo}
                onChange={handleLo}
                className="
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
                "
            />

            {/* High handle */}
            <input
                type="range"
                min={min} max={max} step={step}
                value={hi}
                onChange={handleHi}
                className="
                    absolute w-full h-1.5 appearance-none bg-transparent cursor-pointer z-10
                    pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto
                    [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
                    [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#2E7A96]
                    [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-grab
                    [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-100
                    [&::-webkit-slider-thumb:active]:scale-110 [&::-webkit-slider-thumb:active]:cursor-grabbing
                    [&::-moz-range-thumb]:pointer-events-auto
                    [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4
                    [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white
                    [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[#2E7A96]
                    [&::-moz-range-thumb]:shadow-sm [&::-moz-range-thumb]:cursor-grab
                "
            />
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

    // Sync slider with URL on external navigation
    useEffect(() => {
        setLocalPrice(priceParam ? parsePriceParam(priceParam) : [PRICE_MIN, PRICE_MAX])
    }, [priceParam])

    // Debounced URL push
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const commitPrice = useCallback(
        (value: [number, number]) => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
            debounceRef.current = setTimeout(() => {
                const [lo, hi] = value
                const params = new URLSearchParams(searchParams.toString())
                // Reset if full range selected
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

    return (
        <div className="bg-white rounded-md border border-neutral-200 overflow-hidden">
            {/* Header */}
            <div className="px-5 py-3 border-b border-neutral-100 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400">
                    Lọc sản phẩm nổi bật
                </span>
                {hasFilters && (
                    <button onClick={clearAll} className="text-[10px] text-[#2E7A96] hover:underline font-medium">
                        Xoá lọc
                    </button>
                )}
            </div>

            <div className="divide-y divide-neutral-100">
                {/* Brands */}
                {brands.length > 0 && (
                    <div className="px-5 py-4">
                        <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-3">
                            Thương hiệu
                        </p>
                        <div className="space-y-1.5">
                            {brands.map((b) => {
                                const active = activeBrands.includes(b.name)
                                return (
                                    <button
                                        key={b.id}
                                        onClick={() => toggleBrand(b.name)}
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
                                        {b.name}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Price Range Slider */}
                <div className="px-5 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
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

                    {/* Price labels */}
                    <div className="flex items-center justify-between mt-3">
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
        </div>
    )
}
