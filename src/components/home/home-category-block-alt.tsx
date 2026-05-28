"use client"

import { useState, useEffect, useTransition, useMemo, useRef } from 'react'
import { ProductCard } from '@/components/ui/product-card'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'
import { fetchFeaturedProductsAction } from '@/app/actions/home-products'
import Image from 'next/image'
import { SUBCATEGORY_IMAGES } from '@/config/subcategory-images'

interface Brand {
    name: string
    slug: string
}

interface Subcategory {
    name: string
    slug: string
}

interface HomeCategoryBlockAltProps {
    categoryData: {
        id: string
        label: string
        basePath: string
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        products: any[]
        totalCount?: number
        availableBrands?: Brand[]
        availableSubcategories?: Subcategory[]
    }
}

export function HomeCategoryBlockAlt({ categoryData }: HomeCategoryBlockAltProps) {
    const brands = useMemo(() => categoryData.availableBrands || [], [categoryData.availableBrands])
    const subcats = useMemo(() => categoryData.availableSubcategories || [], [categoryData.availableSubcategories])

    // Create a large array to simulate infinite scroll without complex CSS reset logic
    const LOOPS = 60
    const extendedBrands = useMemo(() => {
        if (brands.length === 0) return []
        const arr = []
        for (let i = 0; i < LOOPS; i++) arr.push(...brands)
        return arr
    }, [brands])

    const [activeVirtualIndex, setActiveVirtualIndex] = useState<number>(() => {
        if (brands.length === 0) return 0
        // Start precisely in the middle loop
        return Math.floor(LOOPS / 2) * brands.length
    })
    
    const [activeSubcategorySlug, setActiveSubcategorySlug] = useState<string | null>(() => {
        if (subcats.length > 0) {
            const defaultSub = subcats.find(s => s.slug === 'bon-cau') || subcats[0]
            return defaultSub.slug
        }
        return null
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [displayedProducts, setDisplayedProducts] = useState<any[]>(categoryData.products)
    const [isPending, startTransition] = useTransition()
    const subcatsScrollRef = useRef<HTMLDivElement>(null)

    const activeBrandSlug = extendedBrands[activeVirtualIndex]?.slug || null

    const handleNextBrand = () => {
        setActiveVirtualIndex((prev) => prev + 1)
    }

    const handlePrevBrand = () => {
        setActiveVirtualIndex((prev) => prev - 1)
    }

    // When filters change, fetch products
    useEffect(() => {
        if (!activeBrandSlug && brands.length === 0) return

        startTransition(async () => {
            try {
                // Fetch up to 10 products for a 5-column layout
                const res = await fetchFeaturedProductsAction(
                    categoryData.id, 
                    activeBrandSlug, 
                    activeSubcategorySlug, 
                    0, 
                    10
                )
                setDisplayedProducts(res.products)
            } catch (error) {
                console.error("Failed to fetch products for brand", error)
            }
        })
    }, [activeBrandSlug, activeSubcategorySlug, categoryData.id, brands.length])

    return (
        <section className="w-full relative z-0 mt-8 mb-12">
            {/* Header */}
            <div className="w-full mb-6 md:mb-8 flex flex-col items-start gap-2 md:gap-3">
                <h2 className="text-[28px] md:text-display-lg font-display font-semibold text-stone-900 tracking-tight leading-tight">
                    Sản phẩm {categoryData.label}
                </h2>
                <div className="w-12 h-1 bg-brand-600 rounded-full"></div>
            </div>

            {/* Horizontal Brand Carousel & Subcategories Container */}
            {brands.length > 0 && (
                <div className="w-full bg-neutral-50 rounded-xl mb-6 relative overflow-hidden flex flex-col py-4 md:py-6 border border-neutral-200/60 shadow-inner">
                    {/* Background Pattern for aesthetics */}
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 mix-blend-multiply pointer-events-none" />
                    
                    {/* Track Container */}
                    <div className={cn(
                        "w-full relative flex items-center justify-center",
                        subcats.length > 0 ? "mb-4 md:mb-6" : ""
                    )}>
                        <div 
                            className="flex transition-transform duration-500 ease-out"
                            style={{ 
                                // Center the active item (each item is 140px wide).
                                transform: `translateX(calc(50% - ${activeVirtualIndex * 140 + 70}px))` 
                            }}
                        >
                            {extendedBrands.map((brand, idx) => {
                                const isActive = idx === activeVirtualIndex
                                return (
                                    <button
                                        key={`${brand.slug}-${idx}`}
                                        onClick={() => {
                                            setActiveVirtualIndex(idx)
                                        }}
                                        className="w-[140px] h-[72px] shrink-0 flex items-center justify-center px-3 transition-all duration-300 focus:outline-none"
                                    >
                                        <div className={cn(
                                            "relative w-full h-full flex items-center justify-center transition-all duration-300",
                                            isActive 
                                                ? "opacity-100 scale-[1.35]" 
                                                : "opacity-40 grayscale hover:opacity-70 hover:grayscale-0 scale-[0.85]"
                                        )}>
                                            
                                            <img 
                                                src={`/images/brands/${brand.slug}.png`}
                                                alt={brand.name}
                                                className="max-w-[80px] max-h-[32px] object-contain"
                                                onError={(e) => {
                                                    const target = e.currentTarget;
                                                    if (target.src.endsWith('.png')) target.src = `/images/brands/${brand.slug}.svg`;
                                                    else target.style.display = 'none';
                                                }}
                                            />
                                        </div>
                                    </button>
                                )
                            })}
                        </div>

                        {/* Left Fade & Arrow */}
                        <div className="absolute left-0 top-0 bottom-0 w-12 md:w-24 bg-gradient-to-r from-neutral-50 to-transparent flex items-center px-1 md:px-2 pointer-events-none z-10">
                            <button 
                                onClick={handlePrevBrand}
                                className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-white/90 shadow-sm border border-neutral-200 flex items-center justify-center text-neutral-600 hover:text-brand-600 hover:border-brand-300 pointer-events-auto transition-colors"
                                aria-label="Previous Brand"
                            >
                                <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
                            </button>
                        </div>

                        {/* Right Fade & Arrow */}
                        <div className="absolute right-0 top-0 bottom-0 w-12 md:w-24 bg-gradient-to-l from-neutral-50 to-transparent flex items-center justify-end px-1 md:px-2 pointer-events-none z-10">
                            <button 
                                onClick={handleNextBrand}
                                className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-white/90 shadow-sm border border-neutral-200 flex items-center justify-center text-neutral-600 hover:text-brand-600 hover:border-brand-300 pointer-events-auto transition-colors"
                                aria-label="Next Brand"
                            >
                                <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Subcategories Container with Thumbnails */}
                    {subcats.length > 0 && (
                        <div className="w-full mt-1 md:mt-2 border-t border-neutral-200/50 pt-4 md:pt-6 relative">
                            {/* Left Scroll Arrow */}
                            <div className="absolute left-0 top-4 md:top-6 bottom-0 w-12 md:w-16 bg-gradient-to-r from-neutral-50 via-neutral-50/80 to-transparent flex items-center justify-start pl-1 md:pl-2 pointer-events-none z-10 md:hidden">
                                <button 
                                    onClick={() => subcatsScrollRef.current?.scrollBy({ left: -200, behavior: 'smooth' })}
                                    className="w-7 h-7 rounded-full bg-white/90 shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-neutral-200 flex items-center justify-center text-neutral-600 hover:text-brand-600 pointer-events-auto transition-colors"
                                    aria-label="Cuộn trái"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                            </div>

                            <div 
                                ref={subcatsScrollRef}
                                className="flex gap-3 sm:gap-4 overflow-x-auto px-4 md:px-8 snap-x snap-mandatory touch-pan-x [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] md:justify-center scroll-smooth"
                            >
                                {/* Subcategory Items */}
                                {subcats.map(subcat => {
                                    const imgSrc = SUBCATEGORY_IMAGES[subcat.slug] || null
                                    const isActive = activeSubcategorySlug === subcat.slug
                                    return (
                                        <button
                                            key={subcat.slug}
                                            onClick={() => setActiveSubcategorySlug(subcat.slug)}
                                            className="group/item shrink-0 snap-start flex flex-col items-center gap-2 w-[60px] sm:w-[72px] transition-all duration-200"
                                        >
                                            <div className={cn(
                                                "relative w-full aspect-square flex items-center justify-center rounded-[14px] bg-white transition-all duration-300 overflow-hidden",
                                                isActive 
                                                    ? "border-[2px] border-brand-600 shadow-sm" 
                                                    : "border border-neutral-200 shadow-sm group-hover/item:border-brand-300 group-hover/item:shadow-md"
                                            )}>
                                                {imgSrc ? (
                                                    <Image src={imgSrc} alt={subcat.name} fill sizes="72px" className="object-cover transition-transform duration-300 group-hover/item:scale-110" />
                                                ) : (
                                                    <span className="text-xs text-stone-300 font-medium">#</span>
                                                )}
                                            </div>
                                            <span className={cn("text-[10px] sm:text-[11px] font-medium text-center mt-1 leading-tight line-clamp-2", isActive ? "text-brand-600 font-bold" : "text-stone-500 group-hover/item:text-brand-500")}>
                                                {subcat.name}
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>

                            {/* Right Scroll Arrow */}
                            <div className="absolute right-0 top-4 md:top-6 bottom-0 w-12 md:w-16 bg-gradient-to-l from-neutral-50 via-neutral-50/80 to-transparent flex items-center justify-end pr-1 md:pr-2 pointer-events-none z-10 md:hidden">
                                <button 
                                    onClick={() => subcatsScrollRef.current?.scrollBy({ left: 200, behavior: 'smooth' })}
                                    className="w-7 h-7 rounded-full bg-white/90 shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-neutral-200 flex items-center justify-center text-neutral-600 hover:text-brand-600 pointer-events-auto transition-colors"
                                    aria-label="Cuộn phải"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Products Grid (5 Columns) */}
            <div className={cn("transition-opacity duration-300 w-full", isPending ? "opacity-50" : "opacity-100")}>
                {displayedProducts.length > 0 ? (
                    <div className="flex overflow-x-auto snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] -mx-5 px-5 md:mx-0 md:px-0 gap-4 md:grid md:grid-cols-5 md:gap-5 pb-4 md:pb-0">
                        {displayedProducts.map((product) => (
                            <div key={product.id} className="snap-start shrink-0 w-[70vw] sm:w-[45vw] md:w-auto max-w-[280px] md:max-w-none">
                                <ProductCard
                                    product={product}
                                    basePath={categoryData.basePath}
                                    patternSlug={product.subcategories?.slug ?? 'san-pham'}
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="w-full min-h-[300px] flex flex-col items-center justify-center bg-stone-50 rounded-[16px] border border-dashed border-stone-200">
                        <p className="text-stone-500 mb-2">Chưa có sản phẩm cho lựa chọn này.</p>
                        <Button variant="link" onClick={() => setActiveSubcategorySlug(subcats.find(s => s.slug === 'bon-cau')?.slug || subcats[0]?.slug || null)} className="text-brand-600">
                            Xóa bộ lọc
                        </Button>
                    </div>
                )}
            </div>
            
        </section>
    )
}
