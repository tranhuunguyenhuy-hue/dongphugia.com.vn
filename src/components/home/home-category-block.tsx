/* eslint-disable */
"use client"

import { useState, useEffect, useTransition } from 'react'
import { ProductCard } from '@/components/ui/product-card'
import { Button } from '@/components/ui/button'
import { ChevronRight, Filter } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { fetchFeaturedProductsAction } from '@/app/actions/home-products'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface Brand {
    name: string
    slug: string
}

interface Subcategory {
    name: string
    slug: string
}

interface HomeCategoryBlockProps {
    categoryData: {
        id: string
        label: string
        basePath: string
        products: any[]
        totalCount?: number
        availableBrands?: Brand[]
        availableSubcategories?: Subcategory[]
    }
}

export function HomeCategoryBlock({ categoryData }: HomeCategoryBlockProps) {
    const [activeBrandSlug, setActiveBrandSlug] = useState<string | null>(categoryData.availableBrands?.[0]?.slug || null)
    const [activeSubcategorySlug, setActiveSubcategorySlug] = useState<string | null>(null)
    const [displayedProducts, setDisplayedProducts] = useState<any[]>(categoryData.products)
    const [isPending, startTransition] = useTransition()

    // When filters change, fetch products
    useEffect(() => {
        startTransition(async () => {
            try {
                // Fetch up to 8 products to fill 4 columns
                const res = await fetchFeaturedProductsAction(
                    categoryData.id, 
                    activeBrandSlug, 
                    activeSubcategorySlug, 
                    0, 
                    8
                )
                setDisplayedProducts(res.products)
            } catch (error) {
                console.error("Failed to fetch products for brand", error)
            }
        })
    }, [activeBrandSlug, activeSubcategorySlug, categoryData.id])

    const brands = categoryData.availableBrands || []
    const subcats = categoryData.availableSubcategories || []

    return (
        <section className="w-full relative z-0 mt-8 mb-6">
            {/* Header Area */}
            <div className="w-full flex flex-col gap-4 mb-6">
                {/* Row 1: Title and Filter */}
                <div className="flex items-end justify-between border-b border-neutral-200 pb-3">
                    <h2 className="text-2xl md:text-[28px] font-bold text-stone-900 uppercase tracking-tight">
                        {categoryData.label}
                    </h2>

                    {subcats.length > 0 && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="hidden lg:flex gap-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 h-9 px-3 rounded-md font-medium">
                                    <Filter className="w-4 h-4" />
                                    {activeSubcategorySlug 
                                        ? subcats.find(s => s.slug === activeSubcategorySlug)?.name 
                                        : "Lọc theo loại"}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 bg-white rounded-[12px] shadow-lg border-neutral-200">
                                <DropdownMenuItem 
                                    onClick={() => setActiveSubcategorySlug(null)}
                                    className={cn("cursor-pointer py-2", activeSubcategorySlug === null && "font-bold text-brand-600")}
                                >
                                    Tất cả sản phẩm
                                </DropdownMenuItem>
                                {subcats.map((sub) => (
                                    <DropdownMenuItem 
                                        key={sub.slug}
                                        onClick={() => setActiveSubcategorySlug(sub.slug)}
                                        className={cn("cursor-pointer py-2", activeSubcategorySlug === sub.slug && "font-bold text-brand-600")}
                                    >
                                        {sub.name}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>

                {/* Row 2: Brand Tabs */}
                <div className="flex overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] gap-3 w-full pb-2 -mx-5 px-5 md:mx-0 md:px-0">
                    {brands.map((brand) => {
                        const isActive = activeBrandSlug === brand.slug
                        return (
                            <button
                                key={brand.slug}
                                onClick={() => setActiveBrandSlug(brand.slug)}
                                className={cn(
                                    "px-5 py-2.5 text-[14px] font-semibold whitespace-nowrap rounded-lg transition-all border",
                                    isActive
                                        ? "bg-brand-600 border-brand-600 text-white shadow-md shadow-brand-500/20"
                                        : "bg-white border-neutral-200 text-neutral-600 hover:border-brand-400 hover:text-brand-600 shadow-sm"
                                )}
                            >
                                {brand.name}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Grid Layout */}
            <div className="w-full flex flex-col lg:flex-row gap-5 lg:gap-8">
                {/* Column 1: Vertical Banner */}
                <div className="w-full lg:w-[260px] shrink-0 h-[180px] lg:h-auto rounded-[16px] bg-stone-900 flex flex-col items-center justify-center p-6 relative overflow-hidden group shadow-md">
                    {/* Abstract premium background pattern */}
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent pointer-events-none" />
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay pointer-events-none" />
                    
                    <div className="relative z-10 flex flex-col items-center justify-center h-full w-full bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm p-4">
                        <img 
                            src={`/images/brands/${activeBrandSlug}.png`}
                            alt={activeBrandSlug || "Brand"}
                            className="max-w-[140px] max-h-[60px] object-contain brightness-0 invert opacity-90 transition-transform duration-500 group-hover:scale-110"
                            onError={(e) => {
                                const target = e.currentTarget;
                                if (target.src.endsWith('.png')) target.src = `/images/brands/${activeBrandSlug}.svg`;
                                else target.style.display = 'none';
                            }}
                        />
                        <div className="mt-8 text-center hidden lg:block w-full">
                            <div className="h-[1px] w-12 bg-white/20 mx-auto mb-4" />
                            <p className="text-[11px] font-medium text-white/60 uppercase tracking-[0.2em] mb-4">
                                Thương hiệu
                            </p>
                            <Link href={`${categoryData.basePath}?brand=${activeBrandSlug}`} className="block w-full">
                                <Button variant="outline" className="w-full rounded-lg bg-transparent text-white border-white/20 hover:bg-white hover:text-stone-900 transition-all h-10">
                                    Xem tất cả
                                    <ChevronRight className="w-4 h-4 ml-1" />
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Column 2: Products Grid / Scroll */}
                <div className="flex-1 min-w-0">
                    <div className={cn("transition-opacity duration-300 w-full", isPending ? "opacity-50" : "opacity-100")}>
                        {displayedProducts.length > 0 ? (
                            <div className="flex overflow-x-auto snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] -mx-5 px-5 lg:mx-0 lg:px-0 gap-4 lg:grid lg:grid-cols-4 lg:gap-5 pb-4 lg:pb-0">
                                {displayedProducts.map((product) => (
                                    <div key={product.id} className="snap-start shrink-0 w-[70vw] sm:w-[45vw] lg:w-auto max-w-[280px] lg:max-w-none">
                                        <ProductCard
                                            product={product}
                                            basePath={categoryData.basePath}
                                            patternSlug={product.subcategories?.slug ?? 'san-pham'}
                                        />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="w-full h-full min-h-[300px] flex flex-col items-center justify-center bg-stone-50 rounded-[16px] border border-dashed border-stone-200">
                                <p className="text-stone-500 mb-2">Chưa có sản phẩm cho lựa chọn này.</p>
                                <Button variant="link" onClick={() => setActiveSubcategorySlug(null)} className="text-brand-600">
                                    Xóa bộ lọc loại
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Mobile View All Button */}
            <div className="mt-6 flex justify-center lg:hidden">
                <Link href={`${categoryData.basePath}?brand=${activeBrandSlug}`} className="w-full">
                    <Button variant="outline" className="w-full h-12 rounded-xl border-neutral-200 text-stone-700 font-medium bg-white shadow-sm">
                        Xem tất cả sản phẩm {brands.find(b => b.slug === activeBrandSlug)?.name}
                    </Button>
                </Link>
            </div>
        </section>
    )
}
