'use client'

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Filter } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { SmartFilterTBVS } from "@/components/category/smart-filter-tbvs"

interface FilterOption { name: string; slug: string }

interface FilterDrawerTBVSProps {
    brands: FilterOption[]
    subtypes: FilterOption[]
    productCount: number
}

export function FilterDrawerTBVS({
    brands,
    subtypes,
    productCount,
}: FilterDrawerTBVSProps) {
    const [open, setOpen] = useState(false)
    const searchParams = useSearchParams()

    // Count active filters
    const activeFilterCount = ["brand", "subtype"].filter(k => searchParams.has(k)).length

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <button className="flex items-center gap-2 border border-[#e5e7eb] rounded-full px-4 py-2 text-[14px] font-medium text-[#374151] bg-white hover:bg-gray-50 transition-colors">
                    <Filter className="w-4 h-4 text-[#6b7280]" />
                    <span>Bộ lọc {activeFilterCount > 0 && `(${activeFilterCount})`}</span>
                </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[320px] sm:w-[400px] bg-white p-0 border-l border-[#e5e7eb]" showCloseButton={false}>
                <SheetTitle className="sr-only">Bộ Lọc Thiết Bị Vệ Sinh</SheetTitle>
                <SheetDescription className="sr-only">Lọc sản phẩm trên di động</SheetDescription>
                <div className="flex flex-col h-full bg-[#fcfcfc]">
                    <div className="flex-1 overflow-y-auto px-5 py-6">
                        <SmartFilterTBVS
                            brands={brands}
                            subtypes={subtypes}
                        />
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}
