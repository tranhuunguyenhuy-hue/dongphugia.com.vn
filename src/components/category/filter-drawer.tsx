'use client'

import { useState, useEffect, useCallback } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { SmartFilter } from './smart-filter'

interface FilterItem {
    slug: string
    name: string
}

interface FilterDrawerProps {
    colors: FilterItem[]
    surfaces: FilterItem[]
    sizes: FilterItem[]
    origins: FilterItem[]
    locations: FilterItem[]
    productCount: number
}

export function FilterDrawer({ colors, surfaces, sizes, origins, locations, productCount }: FilterDrawerProps) {
    const [isOpen, setIsOpen] = useState(false)
    const searchParams = useSearchParams()

    // Count active filters
    const activeFilterCount = ['color', 'surface', 'size', 'origin', 'location'].reduce((count, key) => {
        const val = searchParams.get(key)
        return val ? count + val.split(',').filter(Boolean).length : count
    }, 0)

    // Lock body scroll when drawer open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => { document.body.style.overflow = '' }
    }, [isOpen])

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false) }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    const hasFilterData = colors.length > 0 || surfaces.length > 0 || sizes.length > 0

    if (!hasFilterData) return null

    return (
        <>
            {/* ── Trigger Button (mobile/tablet only) ── */}
            <button
                onClick={() => setIsOpen(true)}
                className="lg:hidden flex items-center gap-2 h-[44px] px-5 rounded-full border border-[#22c55e] bg-white text-[#15803d] font-semibold text-[14px] shadow-sm hover:bg-[#f0fdf4] transition-colors"
            >
                <SlidersHorizontal className="h-4 w-4" strokeWidth={2} />
                <span>Bộ lọc</span>
                {activeFilterCount > 0 && (
                    <span className="ml-1 bg-[#15803d] text-white text-[11px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                        {activeFilterCount}
                    </span>
                )}
            </button>

            {/* ── Backdrop ── */}
            {isOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/40 z-40 animate-in fade-in duration-200"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* ── Bottom Sheet Drawer ── */}
            <div
                className={`lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-[24px] shadow-2xl flex flex-col transition-transform duration-300 ease-out ${isOpen ? 'translate-y-0' : 'translate-y-full'
                    }`}
                style={{ maxHeight: '85dvh' }}
            >
                {/* Handle bar */}
                <div className="flex justify-center pt-3 pb-1 shrink-0">
                    <div className="w-10 h-1 rounded-full bg-[#e5e7eb]" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#f3f4f6] shrink-0">
                    <div className="flex items-center gap-3">
                        <h3 className="text-[18px] font-semibold text-[#111827]">Bộ lọc thông minh</h3>
                        {activeFilterCount > 0 && (
                            <span className="bg-[#f0fdf4] text-[#15803d] text-[12px] font-semibold px-2 py-0.5 rounded-full border border-[#bbf7d0]">
                                {activeFilterCount} đang dùng
                            </span>
                        )}
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f3f4f6] transition-colors"
                        aria-label="Đóng bộ lọc"
                    >
                        <X className="h-5 w-5 text-[#6b7280]" />
                    </button>
                </div>

                {/* Filter Content — scrollable */}
                <div className="flex-1 overflow-y-auto px-5 py-6">
                    <SmartFilter
                        colors={colors}
                        surfaces={surfaces}
                        sizes={sizes}
                        origins={origins}
                        locations={locations}
                    />
                </div>

                {/* Footer Actions */}
                <div className="shrink-0 border-t border-[#f3f4f6] px-5 py-4 flex items-center justify-between gap-3 pb-safe">
                    {activeFilterCount > 0 && (
                        <button
                            onClick={() => {
                                const url = new URL(window.location.href)
                                    ;['color', 'surface', 'size', 'origin', 'location'].forEach(k => url.searchParams.delete(k))
                                window.location.href = url.toString()
                            }}
                            className="text-[14px] font-medium text-[#6b7280] underline underline-offset-2 hover:text-[#374151]"
                        >
                            Xoá bộ lọc
                        </button>
                    )}
                    <button
                        onClick={() => setIsOpen(false)}
                        className="flex-1 h-[48px] rounded-full bg-[#15803d] text-white font-semibold text-[15px] hover:bg-[#166534] transition-colors shadow-sm"
                    >
                        Xem {productCount} sản phẩm
                    </button>
                </div>
            </div>
        </>
    )
}
