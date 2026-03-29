import { Metadata } from "next"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { Suspense } from "react"
import {
    getPatternTypesByCategorySlug,
    getProductsByCategorySlug,
    getFilterDataByCategorySlug,
    getCollectionsByPatternSlug,
} from "@/lib/public-api"
import prisma from "@/lib/prisma"
import { SmartFilter } from "@/components/category/smart-filter"
import { ProductCard } from "@/components/ui/product-card"
import { ProductPagination } from "@/components/ui/product-pagination"
import { PatternTypeSelector } from "@/components/category/pattern-type-selector"
import { CollectionCarousel } from "@/components/category/collection-carousel"
import { FilterDrawer } from "@/components/category/filter-drawer"

export const revalidate = 3600

export const metadata: Metadata = {
    title: "Gạch ốp lát cao cấp",
    description: "Khám phá hơn 1.000 mẫu gạch ốp lát cao cấp: Marble, Đá tự nhiên, Vân gỗ, Xi măng, Trang trí — chính hãng, giá tốt tại Đông Phú Gia Đà Lạt.",
    keywords: ["gạch ốp lát", "gạch marble", "gạch đá tự nhiên", "gạch vân gỗ", "gạch xi măng", "Đà Lạt"],
    openGraph: {
        title: "Gạch ốp lát cao cấp | Đông Phú Gia",
        description: "Hơn 1.000 mẫu gạch ốp lát cao cấp: Marble, Đá tự nhiên, Vân gỗ, Xi măng, Trang trí — chính hãng tại Đà Lạt.",
        url: "/gach-op-lat",
        images: [
            {
                url: "/images/hero-banner.jpg",
                width: 1200,
                height: 630,
                alt: "Gạch ốp lát cao cấp - Đông Phú Gia",
            },
        ],
    },
}

interface PageProps {
    searchParams: Promise<{ [key: string]: string | undefined }>
}

// Helper to fetch collections for the carousel
async function getCollectionsForCarousel(patternSlug?: string) {
    if (patternSlug) {
        return getCollectionsByPatternSlug(patternSlug)
    }
    // No pattern selected → show all collections (featured ones) across category
    return prisma.collections.findMany({
        where: {
            is_active: true,
            pattern_types: {
                product_categories: { slug: "gach-op-lat" },
                is_active: true,
            },
        },
        include: { _count: { select: { products: true } } },
        orderBy: [{ sort_order: "asc" }],
        take: 20,
    })
}

export default async function GachOpLatPage({ searchParams }: PageProps) {
    const sp = await searchParams

    const activePatternSlug = sp.pattern
    const activeCollectionSlug = sp.collection

    const filters = {
        patternSlug: activePatternSlug,
        collectionSlug: activeCollectionSlug,
        colorSlug: sp.color,
        surfaceSlug: sp.surface,
        sizeSlug: sp.size,
        originSlug: sp.origin,
        locationSlug: sp.location,
    }

    // Parallel data fetching
    const [patternTypes, filterData, productsData, collections] = await Promise.all([
        getPatternTypesByCategorySlug("gach-op-lat"),
        getFilterDataByCategorySlug("gach-op-lat", activePatternSlug),
        getProductsByCategorySlug("gach-op-lat", filters),
        getCollectionsForCarousel(activePatternSlug),
    ])

    // Determine active pattern name for carousel title
    const activePattern = activePatternSlug
        ? patternTypes.find((pt) => pt.slug === activePatternSlug)
        : null

    // Helper to deduplicate filter options
    const uniqueBySlug = <T extends { slug: string }>(arr: T[]) => {
        const map = new Map<string, T>()
        arr.forEach(item => {
            if (item && item.slug && !map.has(item.slug)) map.set(item.slug, item)
        })
        return Array.from(map.values())
    }

    const sizesForFilter = uniqueBySlug(filterData.sizes.map((s: any) => ({ slug: s.slug, name: s.label })))
    const colorsForFilter = uniqueBySlug(filterData.colors)
    const surfacesForFilter = uniqueBySlug(filterData.surfaces)
    const originsForFilter = uniqueBySlug(filterData.origins)
    const locationsForFilter = uniqueBySlug(filterData.locations || [])

    // Build unified filter sections
    const filterSections = [
        { key: 'color', label: 'Màu sắc', options: colorsForFilter, mode: 'multi' as const, defaultOpen: true },
        { key: 'surface', label: 'Bề mặt', options: surfacesForFilter, mode: 'multi' as const, defaultOpen: true },
        { key: 'size', label: 'Kích thước', options: sizesForFilter, mode: 'single' as const, defaultOpen: true },
        { key: 'origin', label: 'Xuất xứ', options: originsForFilter, mode: 'single' as const, defaultOpen: false },
        { key: 'location', label: 'Vị trí sử dụng', options: locationsForFilter, mode: 'multi' as const, defaultOpen: false },
    ].filter(s => s.options.length > 0)

    const filterKeys = filterSections.map(s => s.key)

    return (
        <div className="relative min-h-screen bg-white">


            <div className="max-w-[1280px] mx-auto px-5 lg:px-8 relative z-10 py-10">
                <div className="flex flex-col lg:flex-row gap-10 lg:gap-[64px]">

                    {/* ── Left Sidebar (desktop only) ── */}
                    <aside className="hidden lg:flex lg:w-[260px] shrink-0 flex-col gap-[24px] self-start lg:sticky lg:top-24 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:overscroll-contain scrollbar-hide">
                        {/* Smart Filter */}
                        {filterSections.length > 0 && (
                                <Suspense fallback={<div className="h-64 animate-pulse bg-neutral-100 rounded-sm" />}>
                                    <SmartFilter sections={filterSections} />
                                </Suspense>
                            )}
                    </aside>

                    {/* ── Main Content ── */}
                    <div className="flex-1 flex flex-col gap-[32px] min-w-0">

                        {/* Breadcrumb */}
                        <div className="flex items-center gap-2 text-[13px]">
                            <Link href="/" className="text-neutral-500 hover:text-neutral-900 transition-colors font-medium">
                                Trang chủ
                            </Link>
                            <ChevronRight className="h-3.5 w-3.5 text-neutral-400" strokeWidth={2} />
                            <span className="text-neutral-900 font-medium">Gạch ốp lát</span>
                        </div>

                        {/* Pattern Type Selector */}
                        <Suspense fallback={null}>
                            <PatternTypeSelector patternTypes={patternTypes} />
                        </Suspense>

                        {/* Collection Carousel */}
                        {collections.length > 0 && (
                            <Suspense fallback={null}>
                                <CollectionCarousel
                                    patternName={activePattern ? activePattern.name.toLowerCase() : "gạch ốp lát"}
                                    patternSlug={activePatternSlug || ""}
                                    collections={collections}
                                    activeSlug={activeCollectionSlug}
                                    categoryMode={!activePatternSlug}
                                />
                            </Suspense>
                        )}

                        {/* Products Section */}
                        <div className="flex flex-col gap-6 mt-2">
                            <div className="flex items-end justify-between border-b border-neutral-100 pb-4">
                                <h1 className="text-[28px] font-semibold text-neutral-900 tracking-tight leading-none">
                                    {activePattern ? activePattern.name : "Gạch ốp lát"}
                                </h1>
                                <span className="text-neutral-500 text-[14px]">
                                    {productsData.total} sản phẩm
                                </span>
                            </div>

                            {/* Mobile/tablet: Filter trigger → opens bottom sheet drawer */}
                            <div className="lg:hidden">
                                <Suspense fallback={null}>
                                    <FilterDrawer
                                        title="Bộ Lọc"
                                        filterKeys={filterKeys}
                                        productCount={productsData.total}
                                    >
                                        <SmartFilter sections={filterSections} />
                                    </FilterDrawer>
                                </Suspense>
                            </div>

                            {productsData.products.length > 0 ? (
                                <div className="space-y-12">
                                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 xl:gap-8">
                                        {productsData.products.map((product: any) => (
                                            <ProductCard
                                                key={product.id}
                                                product={product}
                                                patternSlug={(product.pattern_types as any)?.slug}
                                            />
                                        ))}
                                    </div>
                                    <ProductPagination
                                        currentPage={productsData.page}
                                        totalPages={productsData.totalPages}
                                    />
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-24 text-center">
                                    <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="m21 21-4.35-4.35" /></svg>
                                    </div>
                                    <h3 className="text-lg font-medium text-neutral-900 mb-2">
                                        Không tìm thấy sản phẩm
                                    </h3>
                                    <p className="text-neutral-500 mb-6 text-sm">
                                        Hãy thử thay đổi bộ lọc hoặc chọn kiểu vân khác.
                                    </p>
                                    <Link
                                        href="/gach-op-lat"
                                        className="text-neutral-900 font-medium hover:underline text-sm"
                                    >
                                        Xóa tất cả bộ lọc
                                    </Link>
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </div>
        </div>
    )
}
