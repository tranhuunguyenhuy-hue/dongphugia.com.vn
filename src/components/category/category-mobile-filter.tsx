'use client'

import React, { Suspense } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetClose,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from '@/components/ui/sheet'
import { AdvancedSidebarFilter, AvailableFiltersData } from './advanced-sidebar-filter'
import type { SpecFilterDef } from './subcategory-spec-filter'
import { useSearchParams } from 'next/navigation'

// ── Filter count badge (needs Suspense boundary) ────────────────────────────────
function FilterCount() {
    const sp = useSearchParams()
    const keys = ['brand', 'features', 'material', 'origin', 'price', 'is_promotion', 'is_featured']
    // Also count spec filters (sf_*)
    let count = keys.filter(k => sp.get(k)).length
    sp.forEach((_v, k) => { if (k.startsWith('sf_')) count++ })
    if (count === 0) return null
    return (
        <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-[#2E7A96] text-white text-[9px] font-bold tabular-nums">
            {count}
        </span>
    )
}

interface CategoryMobileFilterProps {
    availableFilters: AvailableFiltersData
    specFilters?: SpecFilterDef[]
}

export function CategoryMobileFilter({ availableFilters, specFilters }: CategoryMobileFilterProps) {
    return (
        <Sheet>
            {/* ── Trigger — ghost-style matching sort-by button ── */}
            <SheetTrigger asChild>
                <button
                    type="button"
                    className="
                        inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md
                        border border-neutral-200 bg-transparent
                        text-[11px] font-medium text-neutral-400
                        cursor-pointer select-none
                        transition-all duration-150
                        hover:border-neutral-300 hover:text-neutral-600 hover:bg-neutral-50
                        active:bg-neutral-100
                        lg:hidden
                    "
                >
                    <SlidersHorizontal className="size-3 opacity-50" />
                    <span>Bộ lọc</span>
                    <Suspense fallback={null}>
                        <FilterCount />
                    </Suspense>
                </button>
            </SheetTrigger>

            {/* ── Bottom Sheet ── */}
            <SheetContent
                side="bottom"
                showCloseButton={false}
                className="h-[85vh] px-0 pb-0 pt-0 bg-white rounded-t-2xl flex flex-col items-stretch"
            >
                {/* ── Handle bar — drag affordance ── */}
                <div className="flex justify-center pt-3 pb-1 shrink-0">
                    <div className="w-10 h-1 rounded-full bg-neutral-200" />
                </div>

                {/* ── Header ── */}
                <SheetHeader className="px-5 pb-3 border-b border-neutral-100 text-left shrink-0 flex flex-row items-center justify-between">
                    <div>
                        <SheetTitle className="text-[14px] font-bold tracking-tight text-neutral-800">
                            Lọc nâng cao
                        </SheetTitle>
                        <SheetDescription className="text-[11px] text-neutral-400 mt-0.5">
                            Chọn tiêu chí để lọc sản phẩm
                        </SheetDescription>
                    </div>
                    <SheetClose className="
                        flex items-center justify-center w-8 h-8 rounded-lg
                        bg-neutral-100 text-neutral-400
                        hover:bg-neutral-200 hover:text-neutral-600
                        transition-colors duration-150
                    ">
                        <X className="size-4" />
                        <span className="sr-only">Đóng</span>
                    </SheetClose>
                </SheetHeader>

                {/* ── Scrollable filter content ── */}
                <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain">
                    <AdvancedSidebarFilter
                        availableFilters={availableFilters}
                        hideTitle={true}
                        hideSubcategoryFilter={true}
                        specFilters={specFilters}
                    />
                </div>

                {/* ── Sticky footer — apply & clear ── */}
                <div className="shrink-0 border-t border-neutral-100 bg-white px-5 py-3 flex items-center gap-3">
                    <SheetClose asChild>
                        <button
                            type="button"
                            className="
                                flex-1 h-10 rounded-xl
                                bg-[#2E7A96] text-white
                                text-[13px] font-semibold
                                transition-colors duration-150
                                hover:bg-[#256880] active:bg-[#1d5668]
                                shadow-[0_2px_8px_-2px_rgba(46,122,150,0.3)]
                            "
                        >
                            Xem kết quả
                        </button>
                    </SheetClose>
                </div>
            </SheetContent>
        </Sheet>
    )
}
