'use client'

import React, { Suspense } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { AdvancedSidebarFilter, AvailableFiltersData } from './advanced-sidebar-filter'
import { useSearchParams } from 'next/navigation'

// Inner component that uses useSearchParams — must be wrapped in Suspense
function FilterCount() {
    const sp = useSearchParams()
    const count = [
        sp.get('brand'), sp.get('features'), sp.get('material'),
        sp.get('origin'), sp.get('price'), sp.get('is_new'), sp.get('is_featured'),
    ].filter(Boolean).length
    if (count === 0) return null
    return (
        <span className="min-w-[16px] h-4 rounded-full bg-[#2E7A96] text-white text-[10px] font-bold flex items-center justify-center px-1">
            {count}
        </span>
    )
}

export function CategoryMobileFilter({ availableFilters }: { availableFilters: AvailableFiltersData }) {
    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button
                    variant="outline"
                    className="flex items-center gap-1.5 h-10 px-3.5 bg-white border-neutral-200 lg:hidden shadow-sm rounded-lg min-w-[100px]"
                >
                    <SlidersHorizontal className="h-4 w-4 text-neutral-700 flex-shrink-0" />
                    <span className="text-sm font-medium text-neutral-700">Bộ lọc</span>
                    {/* Suspense required by Next.js 15 when using useSearchParams in a client component */}
                    <Suspense fallback={null}>
                        <FilterCount />
                    </Suspense>
                </Button>
            </SheetTrigger>
            <SheetContent
                side="bottom"
                className="h-[88vh] px-0 pb-0 pt-4 bg-white rounded-t-2xl flex flex-col items-stretch"
            >
                <SheetHeader className="px-5 pb-4 border-b border-neutral-100 text-left shrink-0">
                    <SheetTitle className="text-lg font-bold tracking-tight">Bộ lọc sản phẩm</SheetTitle>
                    <SheetDescription className="text-xs text-neutral-500">
                        Chọn nhiều tiêu chí để tìm sản phẩm chính xác nhất
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto min-h-0">
                    <AdvancedSidebarFilter availableFilters={availableFilters} hideTitle={true} />
                </div>
            </SheetContent>
        </Sheet>
    )
}
