'use client'

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useCallback, useState } from "react"
import { Filter, X } from "lucide-react"
import { SmartFilterSango } from "./smart-filter-sango"

interface FilterOption { name: string; slug: string; id?: number }

interface FilterDrawerSangoProps {
    colors: FilterOption[]
    origins: FilterOption[]
    productCount: number
}

export function FilterDrawerSango({ colors, origins, productCount }: FilterDrawerSangoProps) {
    const [isOpen, setIsOpen] = useState(false)
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const activeFilterCount = [
        searchParams.get("color"),
        searchParams.get("origin"),
        searchParams.get("thickness")
    ].filter(Boolean).length

    const clearFilters = useCallback(() => {
        const params = new URLSearchParams()
        const activeType = searchParams.get("type")
        if (activeType) {
            params.set("type", activeType)
        }
        const qs = params.toString()
        router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
        setIsOpen(false)
    }, [router, pathname, searchParams])

    return (
        <>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 h-10 px-4 rounded-xl border border-[#e5e7eb] bg-white text-[#374151] font-medium text-[14px] hover:bg-[#f9fafb] hover:border-[#d1d5db] transition-all active:scale-95 shadow-sm"
            >
                <div className="relative">
                    <Filter className="w-4 h-4" />
                    {activeFilterCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-[#15803d] rounded-full border-2 border-white" />
                    )}
                </div>
                <span>Bộ lọc</span>
                {activeFilterCount > 0 && (
                    <span className="flex items-center justify-center bg-[#f0fdf4] text-[#15803d] font-bold px-1.5 min-w-[20px] h-5 rounded-md text-[12px]">
                        {activeFilterCount}
                    </span>
                )}
            </button>

            {/* Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity lg:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Drawer */}
            <div
                className={`fixed inset-y-0 right-0 w-[85%] max-w-[320px] bg-white z-50 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out lg:hidden ${isOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
            >
                {/* Header */}
                <div className="h-[60px] flex items-center justify-between px-5 border-b border-[#e5e7eb] shrink-0 bg-white">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#111827] text-[16px]">Bộ lọc</span>
                        <span className="text-[#6b7280] text-[13px] font-normal">({productCount} SP)</span>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-5 py-6">
                    <SmartFilterSango colors={colors} origins={origins} />
                </div>

                {/* Footer Action */}
                <div className="p-5 border-t border-[#e5e7eb] bg-white shrink-0 grid grid-cols-2 gap-3">
                    <button
                        onClick={clearFilters}
                        disabled={activeFilterCount === 0}
                        className="h-11 flex items-center justify-center rounded-xl border border-[#e5e7eb] bg-white text-[#374151] font-medium text-[15px] hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white transition-colors"
                    >
                        Xóa lọc
                    </button>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="h-11 flex items-center justify-center rounded-xl bg-[#15803d] text-white font-medium text-[15px] hover:bg-[#166534] transition-colors shadow-sm"
                    >
                        Áp dụng
                    </button>
                </div>
            </div>
        </>
    )
}
