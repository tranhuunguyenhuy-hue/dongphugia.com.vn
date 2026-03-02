'use client'

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useCallback, useMemo, useState } from "react"
import { X, ChevronUp, ChevronDown, Check } from "lucide-react"

interface FilterOption { name: string; slug: string; id?: number }

interface SmartFilterSangoProps {
    colors: FilterOption[]
    origins: FilterOption[]
}

const THICKNESS_RANGES = [
    { name: "Dưới 8mm", min: 0, max: 7.9, slug: "duoi-8" },
    { name: "8mm", min: 8, max: 8.9, slug: "8mm" },
    { name: "10mm", min: 10, max: 10.9, slug: "10mm" },
    { name: "12mm", min: 12, max: 12.9, slug: "12mm" },
    { name: "Trên 12mm", min: 13, max: 100, slug: "tren-12" }
]

function FilterSection({
    title,
    options,
    activeValue,
    onChange
}: {
    title: string;
    options: FilterOption[];
    activeValue: string;
    onChange: (val: string) => void;
}) {
    const [isOpen, setIsOpen] = useState(true);

    if (!options || options.length === 0) return null;

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center justify-between pr-5 w-full text-left"
                >
                    <span className="font-semibold text-lg text-[#1f2937]">{title}</span>
                    {isOpen ? (
                        <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                </button>
                <div className="h-px bg-gray-200 w-full" />
            </div>

            {isOpen && (
                <div className="flex flex-col">
                    {options.map((item) => {
                        // For Colors and origins, we might match by ID or Slug. 
                        // The URL uses slug typically, but API accepts id. We will use slug for URL, id for API.
                        // Here we just use slug for active selection.
                        const isSelected = activeValue === item.slug;
                        return (
                            <button
                                key={item.slug}
                                onClick={() => onChange(item.slug)}
                                className="flex items-center justify-between h-[44px] w-full text-left group"
                            >
                                <span
                                    className={`font-medium text-[16px] leading-[24px] ${isSelected ? 'text-[#15803d]' : 'text-[#4b5563] group-hover:text-[#374151]'}`}
                                >
                                    {item.name}
                                </span>
                                <div
                                    className={`w-[18px] h-[18px] rounded-full flex items-center justify-center border-[1.5px] shrink-0 transition-colors ${isSelected
                                        ? 'bg-[#15803d] border-[#15803d]'
                                        : 'bg-white border-[#d1d5db] group-hover:border-[#9ca3af]'
                                        }`}
                                >
                                    {isSelected && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export function SmartFilterSango({
    colors,
    origins,
}: SmartFilterSangoProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const activeColor = searchParams.get("color") || ""
    const activeOrigin = searchParams.get("origin") || ""
    const activeThickness = searchParams.get("thickness") || ""
    const activeType = searchParams.get("type") || ""

    const activeFilterCount = useMemo(() => {
        let count = 0
        if (activeColor) count++
        if (activeOrigin) count++
        if (activeThickness) count++
        return count
    }, [activeColor, activeOrigin, activeThickness])

    const handleFilterChange = useCallback((key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString())

        if (params.get(key) === value) {
            params.delete(key)
        } else {
            params.set(key, value)
        }

        params.delete("page")

        const qs = params.toString()
        router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }, [router, pathname, searchParams])

    const clearFilters = useCallback(() => {
        const params = new URLSearchParams()
        if (activeType) {
            params.set("type", activeType)
        }
        const qs = params.toString()
        router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }, [router, pathname, activeType])

    return (
        <div className="flex flex-col gap-6 w-full">
            <div className="flex items-center justify-between pb-4 border-b border-[#e5e7eb]">
                <div className="flex items-center gap-2">
                    <h2 className="text-[18px] font-semibold text-[#111827]">Bộ lọc thông minh</h2>
                    {activeFilterCount > 0 && (
                        <span className="flex items-center justify-center bg-[#15803d] text-white text-[12px] font-bold w-6 h-6 rounded-full leading-none">
                            {activeFilterCount}
                        </span>
                    )}
                </div>
                {activeFilterCount > 0 && (
                    <button
                        onClick={clearFilters}
                        className="flex items-center gap-1.5 text-[14px] font-medium text-[#6b7280] hover:text-[#15803d] transition-colors"
                    >
                        <X className="w-4 h-4" />
                        <span>Xóa lọc</span>
                    </button>
                )}
            </div>

            <div className="flex flex-col gap-5">
                <FilterSection
                    title="Độ dày (Thickness)"
                    options={THICKNESS_RANGES}
                    activeValue={activeThickness}
                    onChange={(val) => handleFilterChange("thickness", val)}
                />

                {colors && colors.length > 0 && (
                    <FilterSection
                        title="Màu sắc"
                        options={colors}
                        activeValue={activeColor}
                        onChange={(val) => handleFilterChange("color", val)}
                    />
                )}

                {origins && origins.length > 0 && (
                    <FilterSection
                        title="Xuất xứ"
                        options={origins}
                        activeValue={activeOrigin}
                        onChange={(val) => handleFilterChange("origin", val)}
                    />
                )}
            </div>
        </div>
    )
}
