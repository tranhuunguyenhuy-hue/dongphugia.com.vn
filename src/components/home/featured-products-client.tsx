'use client'

import { useState, useMemo, useEffect, useTransition } from 'react'
import { ProductCard } from '@/components/ui/product-card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ChevronRight, PackageOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fetchFeaturedProductsAction } from '@/app/actions/home-products'

interface Brand {
    name: string
    slug: string
}

interface Subcategory {
    name: string
    slug: string
}

interface FeaturedProduct {
    id: number
    name: string
    slug: string
    price: number | null
    original_price?: number | null
    price_display: string | null
    image_main_url: string | null

    is_promotion: boolean
        stock_status: string
    subcategories: Subcategory | null
    brands: Brand | null
}

interface CategoryData {
    id: string
    label: string
    basePath: string
    products: FeaturedProduct[]
    totalCount?: number
}

interface FeaturedProductsClientProps {
    categories: CategoryData[]
}

export function FeaturedProductsClient({ categories }: FeaturedProductsClientProps) {
    const [activeCategoryId, setActiveCategoryId] = useState(categories[0]?.id)
    const activeCategory = categories.find(c => c.id === activeCategoryId) || categories[0]
    
    const [activeBrandSlug, setActiveBrandSlug] = useState<string | null>(null)
    const [activeSubcategorySlug, setActiveSubcategorySlug] = useState<string | null>(null)

    const [displayedProducts, setDisplayedProducts] = useState<FeaturedProduct[]>(activeCategory?.products || [])
    const [totalActiveCount, setTotalActiveCount] = useState<number>(activeCategory?.totalCount || activeCategory?.products?.length || 0)
    
    const [isPending, startTransition] = useTransition()
    const [isLoadingMore, setIsLoadingMore] = useState(false)

    // Reset sub-filters when changing category
    const handleCategoryChange = (id: string) => {
        if (id === activeCategoryId) return
        setActiveCategoryId(id)
        setActiveBrandSlug(null)
        setActiveSubcategorySlug(null)
    }

    // Sync products when filters change
    useEffect(() => {
        if (!activeCategory) return

        if (!activeBrandSlug && !activeSubcategorySlug) {
            // Using default cache if no manual filter
            setDisplayedProducts(activeCategory.products)
            setTotalActiveCount(activeCategory.totalCount || activeCategory.products.length)
            return
        }

        // Fetch explicitly if filtered
        startTransition(async () => {
            try {
                const res = await fetchFeaturedProductsAction(activeCategoryId, activeBrandSlug, activeSubcategorySlug, 0, 20)
                setDisplayedProducts(res.products)
                setTotalActiveCount(res.total)
            } catch (error) {
                console.error("Failed to fetch filtered products", error)
            }
        })
    }, [activeCategoryId, activeBrandSlug, activeSubcategorySlug, activeCategory])

    const MAX_PRODUCTS = 50
    const maxProductsAllowed = Math.min(totalActiveCount, MAX_PRODUCTS)
    const remainingToLoad = maxProductsAllowed - displayedProducts.length

    const handleLoadMore = async () => {
        if (isLoadingMore || remainingToLoad <= 0) return
        setIsLoadingMore(true)
        try {
            const skip = displayedProducts.length
            const take = Math.min(20, remainingToLoad)
            const res = await fetchFeaturedProductsAction(activeCategoryId, activeBrandSlug, activeSubcategorySlug, skip, take)
            setDisplayedProducts(prev => [...prev, ...res.products])
        } catch (error) {
            console.error("Failed to load more products", error)
        } finally {
            setIsLoadingMore(false)
        }
    }

    // Extract unique brands and subcategories for the active category based purely on its unfiltered default items
    const { brands, subcategories } = useMemo(() => {
        if (!activeCategory) return { brands: [], subcategories: [] }

        const brandMap = new Map<string, Brand>()
        const subMap = new Map<string, Subcategory>()

        activeCategory.products.forEach(p => {
            if (p.brands?.slug) {
                brandMap.set(p.brands.slug, p.brands)
            }
            if (p.subcategories?.slug) {
                subMap.set(p.subcategories.slug, p.subcategories)
            }
        })

        return {
            brands: Array.from(brandMap.values()),
            subcategories: Array.from(subMap.values())
        }
    }, [activeCategory])

    if (!activeCategory) return null

    return (
        <div className="w-full max-w-[1280px] mx-auto relative z-0 mt-[1px]">
            {/* The fading border effect underneath */}
            <div className="absolute -top-[1px] -left-[1px] -right-[1px] h-[300px] md:h-[350px] bg-gradient-to-b from-brand-500/40 to-transparent rounded-t-[13px] -z-10 pointer-events-none" />

            <div className="w-full h-full relative z-0 rounded-[12px] bg-white px-4 py-8 md:px-6 md:py-10 lg:py-12 flex flex-col gap-8 md:gap-10">
                
                {/* Fixed gradient background for header section */}
                <div className="absolute top-0 left-0 w-full h-[300px] md:h-[350px] bg-gradient-to-b from-brand-300/10 to-transparent -z-10 rounded-t-[12px] pointer-events-none" />

                {/* Heading */}
                <h2 className="text-display-md italic text-brand-600 text-center tracking-tight font-serif">
                    Sản phẩm nổi bật
                </h2>

                <div className="flex flex-col gap-3">
                    {/* Level 1: Category Tabs */}
                    <div className="flex justify-center border-b border-neutral-300 -mx-4 md:mx-0">
                        <div className="flex gap-6 md:gap-10 overflow-x-auto overflow-y-hidden scrollbar-hide px-4 md:px-0">
                            {categories.map((cat) => {
                                const isActive = activeCategoryId === cat.id
                                return (
                                    <button
                                        key={cat.id}
                                        onClick={() => handleCategoryChange(cat.id)}
                                        className={cn(
                                            "pb-3 text-[15px] transition-all relative whitespace-nowrap",
                                            isActive
                                                ? "text-brand-600 font-semibold"
                                                : "text-neutral-400 hover:text-brand-500"
                                        )}
                                    >
                                        {cat.label}
                                        {isActive && (
                                            <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-brand-600" />
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Level 2: Sub-filters (Brands and Subcategories) */}
                    <div className="flex flex-col">
                        {/* Brand Filter */}
                        {brands.length > 0 && activeCategoryId !== 'gach-op-lat' && (
                            <div className="flex items-center justify-center gap-3 overflow-x-auto overflow-y-hidden scrollbar-hide pb-2 px-1">
                                {brands.map(brand => {
                                    const isActive = activeBrandSlug === brand.slug
                                    return (
                                        <button
                                            key={brand.slug}
                                        onClick={() => setActiveBrandSlug(isActive ? null : brand.slug)}
                                        className={cn(
                                            "shrink-0 h-10 px-4 rounded-lg bg-white/60 flex items-center justify-center transition-all border",
                                            isActive
                                                ? "border-brand-500 shadow-sm opacity-100"
                                                : "border-neutral-300 hover:border-brand-400 opacity-80 hover:opacity-100"
                                        )}
                                        title={brand.name}
                                    >
                                        <div className="h-full flex items-center justify-center">
                                            <img
                                                src={`/images/brands/${brand.slug}.png`}
                                                alt={brand.name}
                                                className="max-h-[28px] object-contain transition-all duration-300"
                                                onError={(e) => {
                                                    const target = e.currentTarget;
                                                    if (target.src.endsWith('.png')) {
                                                        target.src = `/images/brands/${brand.slug}.svg`;
                                                    } else {
                                                        target.style.display = 'none';
                                                        if (target.nextElementSibling) {
                                                            (target.nextElementSibling as HTMLElement).style.display = 'inline';
                                                        }
                                                    }
                                                }}
                                            />
                                            <span className="text-[13px] font-semibold text-stone-700 hidden uppercase tracking-wide">
                                                {brand.name}
                                            </span>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    {/* Subcategory Filter */}
                    {subcategories.length > 0 && (
                        <div className="flex items-center justify-center gap-2 md:gap-3 overflow-x-auto overflow-y-hidden scrollbar-hide py-3 px-1 -my-1">
                            <button
                                onClick={() => setActiveSubcategorySlug(null)}
                                className={cn(
                                    "shrink-0 px-5 py-2 rounded-lg text-[14px] transition-all border",
                                    activeSubcategorySlug === null
                                        ? "bg-white border-neutral-100 shadow-sm text-brand-600 font-semibold"
                                        : "bg-transparent border-transparent text-neutral-500 hover:text-brand-500"
                                )}
                            >
                                Tất cả
                            </button>
                            {subcategories.map(sub => {
                                const isActive = activeSubcategorySlug === sub.slug
                                return (
                                    <button
                                        key={sub.slug}
                                        onClick={() => setActiveSubcategorySlug(isActive ? null : sub.slug)}
                                        className={cn(
                                            "shrink-0 px-5 py-2 rounded-lg text-[14px] transition-all border",
                                            isActive
                                                ? "bg-white border-neutral-100 shadow-sm text-brand-600 font-semibold"
                                                : "bg-transparent border-transparent text-neutral-500 hover:text-brand-500"
                                        )}
                                    >
                                        {sub.name}
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>
                </div>

                {/* Products Grid or Empty State */}
                <div className="w-full">
                    <div className={cn("transition-opacity duration-300", isPending ? "opacity-50 pointer-events-none" : "opacity-100")}>
                        {displayedProducts.length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6 lg:gap-8">
                                {displayedProducts.map((product) => (
                                    <ProductCard
                                        key={product.id}
                                        product={product}
                                        basePath={activeCategory.basePath}
                                        patternSlug={product.subcategories?.slug ?? 'san-pham'}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="w-full flex flex-col items-center justify-center py-20 bg-white/50 rounded-2xl border border-dashed border-brand-200">
                                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-4">
                                    <PackageOpen className="w-8 h-8 text-brand-400" />
                                </div>
                                <h3 className="text-heading-md text-stone-900 mb-2">Không tìm thấy sản phẩm</h3>
                                <p className="text-body-sm text-stone-500 text-center max-w-md mb-6">
                                    Không có sản phẩm nào khớp với bộ lọc bạn đã chọn. Vui lòng thử lại.
                                </p>
                                <Button 
                                    onClick={() => { setActiveBrandSlug(null); setActiveSubcategorySlug(null); }} 
                                    variant="outline" 
                                    className="rounded-lg border-border text-stone-800 hover:bg-brand-500 hover:text-white hover:border-brand-500 transition-colors"
                                >
                                    Xoá bộ lọc
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Footers Buttons */}
                    {displayedProducts.length > 0 && (
                        <div className="w-full mt-10 md:mt-12 flex flex-col md:flex-row items-center justify-center gap-4">
                            {/* Primary Button */}
                            <Link href={activeCategory.basePath} className="w-full md:w-auto">
                                <Button className="w-full md:w-auto h-12 px-8 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium text-[15px] shadow-sm shadow-brand-500/20">
                                    Xem chi tiết {activeCategory.label}
                                    <ChevronRight className="ml-2 w-5 h-5" />
                                </Button>
                            </Link>

                            {/* Secondary Button - Load More */}
                            {remainingToLoad > 0 && (
                                <Button 
                                    variant="outline"
                                    onClick={handleLoadMore}
                                    disabled={isLoadingMore || isPending}
                                    className="w-full md:w-auto h-12 px-8 rounded-[12px] border-brand-200 text-brand-700 hover:bg-brand-50 hover:text-brand-800 font-medium text-[15px] bg-white shadow-sm"
                                >
                                    {isLoadingMore ? "Đang tải thêm..." : `Hiển thị thêm ${remainingToLoad} sản phẩm`}
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
