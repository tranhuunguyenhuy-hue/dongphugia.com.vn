'use client'

import React from 'react'
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

export function CategoryMobileFilter({ availableFilters }: { availableFilters: AvailableFiltersData }) {
    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2 h-9 px-3 bg-white border-neutral-200 lg:hidden shadow-sm rounded-lg">
                    <SlidersHorizontal className="h-4 w-4 text-neutral-700" />
                    <span className="text-sm font-medium text-neutral-700">Lọc & Sắp xếp</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[85vh] px-0 pb-0 pt-4 bg-white rounded-t-xl flex flex-col items-stretch">
                <SheetHeader className="px-5 pb-4 border-b border-neutral-100 text-left shrink-0">
                    <SheetTitle className="text-lg font-bold tracking-tight">Bộ lọc sản phẩm</SheetTitle>
                    <SheetDescription className="text-xs text-neutral-500">
                        Chọn nhiều tiêu chí để tìm sản phẩm chính xác nhất
                    </SheetDescription>
                </SheetHeader>
                
                <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
                    <AdvancedSidebarFilter availableFilters={availableFilters} hideTitle={true} />
                </div>
            </SheetContent>
        </Sheet>
    )
}
