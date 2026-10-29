import Image from "next/image"
import Link from "next/link"
import { Suspense, type ComponentProps } from "react"
import { ChevronRight, Home } from "lucide-react"
import { CategoryFilterPanel, type CategoryFilterBrand, type CategoryFilterPanelMode } from "@/components/category/category-filter-panel"
import { CategoryRootFeaturedNeutralSection, CategoryRootFeaturedProducts, CategoryRootFeaturedSection } from "@/components/category/category-root-featured-products"
import { SubcategoryIconGrid } from "@/components/category/subcategory-icon-grid"
import type { ProductCardProps } from "@/components/ui/product-card"

type CategoryRootViewProps = {
    categoryName: string
    basePath: string
    emojiFallback: string
    bannerUrl: string | null
    subcategories: ComponentProps<typeof SubcategoryIconGrid>["subcategories"]
    featuredProducts: ProductCardProps["product"][]
    filterableFeaturedProducts?: ProductCardProps["product"][]
    brands: CategoryFilterBrand[]
    isFiltered: boolean
    filterMode?: CategoryFilterPanelMode
    featuredGridClassName?: string
}

const DEFAULT_FEATURED_GRID_CLASS_NAME = "grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5"

export function CategoryRootView({
    categoryName,
    basePath,
    emojiFallback,
    bannerUrl,
    subcategories,
    featuredProducts,
    filterableFeaturedProducts = featuredProducts,
    brands,
    isFiltered,
    filterMode = "canonical",
    featuredGridClassName = DEFAULT_FEATURED_GRID_CLASS_NAME,
}: CategoryRootViewProps) {
    return (
        <main className="max-w-[1380px] mx-auto px-5 lg:px-8">
            <nav className="hidden lg:flex items-center gap-1.5 text-[11px] text-neutral-400 pt-5 pb-0" aria-label="Breadcrumb">
                <Home className="h-3 w-3 flex-shrink-0" />
                <ChevronRight className="h-3 w-3 text-neutral-300" />
                <Link href="/" className="hover:text-neutral-700 transition-colors">Trang chủ</Link>
                <ChevronRight className="h-3 w-3 text-neutral-300" />
                <span className="text-neutral-600 font-medium">{categoryName}</span>
            </nav>

            <div className="flex flex-col lg:flex-row gap-5 lg:gap-10 items-start pt-3 pb-8 lg:pt-6 lg:pb-12">
                <aside className="hidden lg:flex w-[290px] flex-shrink-0 sticky top-24 scroll-sidebar flex-col gap-4">
                    <div className="relative w-full aspect-video rounded-md [overflow:clip] bg-neutral-100 border border-dashed border-neutral-200">
                        {bannerUrl ? (
                            <Image src={bannerUrl} alt={`Banner ${categoryName}`} fill className="object-cover" priority />
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5">
                                <svg className="h-8 w-8 text-neutral-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                                </svg>
                                <p className="text-[11px] text-neutral-400 tracking-wide">Banner quảng cáo</p>
                            </div>
                        )}
                    </div>
                    <Suspense>
                        <CategoryFilterPanel brands={brands} mode={filterMode} />
                    </Suspense>
                </aside>

                <div className="w-full flex-1 min-w-0 space-y-10">
                    <h1 className="text-2xl font-bold text-gray-800 mb-4">{categoryName}</h1>
                    <SubcategoryIconGrid
                        subcategories={subcategories}
                        basePath={basePath}
                        emojiDefault={emojiFallback}
                    />

                    <div className="border-t border-neutral-100" />

                    <Suspense fallback={filterMode === "snapshot" ? (
                        <CategoryRootFeaturedNeutralSection featuredGridClassName={featuredGridClassName} />
                    ) : (
                        <CategoryRootFeaturedSection
                            basePath={basePath}
                            featuredProducts={featuredProducts}
                            isFiltered={isFiltered}
                            featuredGridClassName={featuredGridClassName}
                        />
                    )}>
                        {filterMode === "snapshot" ? (
                            <CategoryRootFeaturedProducts
                                basePath={basePath}
                                featuredProducts={featuredProducts}
                                filterableFeaturedProducts={filterableFeaturedProducts}
                                featuredGridClassName={featuredGridClassName}
                            />
                        ) : (
                            <CategoryRootFeaturedSection
                                basePath={basePath}
                                featuredProducts={featuredProducts}
                                isFiltered={isFiltered}
                                featuredGridClassName={featuredGridClassName}
                            />
                        )}
                    </Suspense>
                </div>
            </div>
        </main>
    )
}
