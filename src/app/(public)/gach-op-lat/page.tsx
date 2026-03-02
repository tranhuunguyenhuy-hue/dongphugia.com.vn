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
    const [patternTypes, filterData, products, collections] = await Promise.all([
        getPatternTypesByCategorySlug("gach-op-lat"),
        getFilterDataByCategorySlug("gach-op-lat", activePatternSlug),
        getProductsByCategorySlug("gach-op-lat", filters),
        getCollectionsForCarousel(activePatternSlug),
    ])

    // Determine active pattern name for carousel title
    const activePattern = activePatternSlug
        ? patternTypes.find((pt) => pt.slug === activePatternSlug)
        : null

    // Sizes need label field
    const sizesForFilter = filterData.sizes.map((s: any) => ({ slug: s.slug, name: s.label }))

    return (
        <div className="relative min-h-screen bg-white">
            {/* Background gradient */}
            <div className="absolute left-0 right-0 top-0 h-[700px] bg-gradient-to-b from-[#dcfce7] to-white pointer-events-none" />

            <div className="max-w-[1280px] mx-auto px-5 relative z-10 py-10">
                <div className="flex flex-col lg:flex-row gap-[51px]">

                    {/* ── Left Sidebar (desktop only) ── */}
                    <aside className="hidden lg:flex lg:w-[302px] shrink-0 flex-col gap-[24px] self-start lg:sticky lg:top-24 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:overscroll-contain scrollbar-thin scrollbar-thumb-[#d1fae5] scrollbar-track-transparent">
                        {/* Smart Filter */}
                        {(filterData.colors.length > 0 ||
                            filterData.surfaces.length > 0 ||
                            filterData.sizes.length > 0) && (
                                <Suspense fallback={<div className="h-64 animate-pulse bg-gray-100 rounded-lg" />}>
                                    <SmartFilter
                                        colors={filterData.colors}
                                        surfaces={filterData.surfaces}
                                        sizes={sizesForFilter}
                                        origins={filterData.origins}
                                        locations={filterData.locations}
                                    />
                                </Suspense>
                            )}
                    </aside>

                    {/* ── Main Content ── */}
                    <div className="flex-1 flex flex-col gap-[40px] min-w-0">

                        {/* Breadcrumb */}
                        <div className="flex items-center gap-2 text-[14px]">
                            <Link href="/" className="text-[#4b5563] hover:text-[#15803d] transition-colors font-medium">
                                Trang chủ
                            </Link>
                            <ChevronRight className="h-4 w-4 text-[#9ca3af]" strokeWidth={1.5} />
                            <span className="text-[#15803d] font-semibold">Gạch ốp lát</span>
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
                        <div className="flex flex-col gap-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-[24px] font-semibold text-[#111827] tracking-[-0.48px] leading-[32px]">
                                    Tất cả{" "}
                                    <span className="text-[#15803d] font-bold">sản phẩm</span>{" "}
                                    {activePattern ? activePattern.name.toLowerCase() : "gạch ốp lát"}
                                </h2>
                                <span className="text-[14px] text-[#6b7280]">
                                    {products.length} sản phẩm
                                </span>
                            </div>

                            {/* Mobile/tablet: Filter trigger → opens bottom sheet drawer */}
                            <div className="lg:hidden">
                                <Suspense fallback={null}>
                                    <FilterDrawer
                                        colors={filterData.colors}
                                        surfaces={filterData.surfaces}
                                        sizes={sizesForFilter}
                                        origins={filterData.origins}
                                        locations={filterData.locations}
                                        productCount={products.length}
                                    />
                                </Suspense>
                            </div>

                            {products.length > 0 ? (
                                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 xl:gap-8">
                                    {products.map((product) => (
                                        <ProductCard
                                            key={product.id}
                                            product={product}
                                            patternSlug={(product.pattern_types as any)?.slug}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-24 text-center">
                                    <div className="w-20 h-20 rounded-full bg-[#f0fdf4] flex items-center justify-center mb-4">
                                        <span className="text-3xl">🔍</span>
                                    </div>
                                    <h3 className="text-lg font-semibold text-[#111827] mb-2">
                                        Không tìm thấy sản phẩm
                                    </h3>
                                    <p className="text-[#6b7280] mb-6">
                                        Hãy thử thay đổi bộ lọc hoặc chọn kiểu vân khác.
                                    </p>
                                    <Link
                                        href="/gach-op-lat"
                                        className="text-[#15803d] font-medium hover:underline"
                                    >
                                        Xem tất cả sản phẩm
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
