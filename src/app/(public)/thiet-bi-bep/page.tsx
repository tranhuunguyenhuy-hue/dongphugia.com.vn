import { Metadata } from "next"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { Suspense } from "react"
import { getBepTypes, getBepProducts } from "@/lib/public-api-bep"
import prisma from "@/lib/prisma"
import { SmartFilter } from "@/components/category/smart-filter"
import { ProductCard } from "@/components/ui/product-card"
import { CategorySelector } from "@/components/category/category-selector"
import { BrandCarousel } from "@/components/category/brand-carousel"
import { FilterDrawer } from "@/components/category/filter-drawer"
import { ProductPagination } from "@/components/ui/product-pagination"

export const revalidate = 3600

export const metadata: Metadata = {
    title: "Thiết bị bếp cao cấp",
    description: "Khám phá danh mục thiết bị bếp cao cấp: Bếp từ, Máy hút mùi, Lò nướng, Tủ bếp — chính hãng, giá tốt tại Đông Phú Gia Đà Lạt.",
    keywords: ["thiết bị bếp", "bếp từ", "máy hút mùi", "lò nướng", "tủ bếp", "Đà Lạt"],
    openGraph: {
        title: "Thiết bị bếp cao cấp | Đông Phú Gia",
        description: "Danh mục thiết bị bếp cao cấp: Bếp từ, Máy hút mùi, Lò nướng — chính hãng tại Đà Lạt.",
        url: "/thiet-bi-bep",
        images: [
            {
                url: "/images/categories/thiet-bi-bep.png",
                width: 1200,
                height: 630,
                alt: "Thiết bị bếp cao cấp - Đông Phú Gia",
            },
        ],
    },
}

interface PageProps {
    searchParams: Promise<{ [key: string]: string | undefined }>
}

async function getBrandsForCarousel(typeSlug?: string) {
    return prisma.bep_brands.findMany({
        where: { is_active: true },
        include: { _count: { select: { bep_products: { where: { is_active: true } } } } },
        orderBy: [{ sort_order: "asc" }],
    })
}

export default async function ThietBiBepPage({ searchParams }: PageProps) {
    const sp = await searchParams

    const activeTypeSlug = sp.type
    const activeSubtypeSlug = sp.subtype
    const activeBrandSlug = sp.brand

    const filters = {
        typeSlug: activeTypeSlug,
        subtypeSlug: activeSubtypeSlug,
        brandSlug: activeBrandSlug,
        page: sp.page ? parseInt(sp.page, 10) : 1,
    }

    // Parallel data fetching
    const [typesData, productsData, brandsData] = await Promise.all([
        getBepTypes(),
        getBepProducts(filters),
        getBrandsForCarousel(activeTypeSlug),
    ])

    const activeType = activeTypeSlug ? typesData.find(t => t.slug === activeTypeSlug) : null
    const subtypesForFilter = activeType ? activeType.bep_subtypes : []

    const mappedBrands = brandsData.map(b => ({
        name: b.name,
        slug: b.slug,
    }))

    const filterSections = [
        { key: 'subtype', label: 'Kiểu Dáng (Subtype)', options: subtypesForFilter, mode: 'single' as const, defaultOpen: true },
        { key: 'brand', label: 'Thương Hiệu', options: mappedBrands, mode: 'single' as const, defaultOpen: true },
    ]

    return (
        <div className="relative min-h-screen bg-white">


            <div className="max-w-[1280px] mx-auto px-5 lg:px-8 relative z-10 py-10">
                <div className="flex flex-col lg:flex-row gap-10 lg:gap-[64px]">

                    {/* ── Left Sidebar (desktop only) ── */}
                    <aside className="hidden lg:flex lg:w-[260px] shrink-0 flex-col gap-[24px] self-start lg:sticky lg:top-24 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:overscroll-contain scrollbar-hide">
                        <Suspense fallback={<div className="h-64 animate-pulse bg-neutral-100 rounded-sm" />}>
                            <SmartFilter sections={filterSections} />
                        </Suspense>
                    </aside>

                    {/* ── Main Content ── */}
                    <div className="flex-1 flex flex-col gap-[32px] min-w-0">

                        {/* Breadcrumb */}
                        <div className="flex items-center gap-2 text-[13px]">
                            <Link href="/" className="text-neutral-500 hover:text-neutral-900 transition-colors font-medium">
                                Trang chủ
                            </Link>
                            <ChevronRight className="h-3.5 w-3.5 text-neutral-400" strokeWidth={2} />
                            <span className="text-neutral-900 font-medium">Thiết bị bếp</span>
                        </div>

                        {/* Collection Carousel */}
                        {mappedBrands.length > 0 && (
                            <Suspense fallback={null}>
                                <BrandCarousel
                                    brands={mappedBrands}
                                    activeSlug={activeBrandSlug}
                                />
                            </Suspense>
                        )}

                        {/* Pattern Type Selector */}
                        <Suspense fallback={null}>
                            <CategorySelector types={typesData} highlightText="" suffixText="" />
                        </Suspense>

                        {/* Products Section */}
                        <div className="flex flex-col gap-6 mt-2">
                            <div className="flex items-end justify-between border-b border-neutral-100 pb-4">
                                <h1 className="text-[28px] font-semibold text-neutral-900 tracking-tight leading-none">
                                    {activeType ? activeType.name : "Thiết bị bếp"}
                                </h1>
                                <span className="text-neutral-500 text-[14px]">
                                    {productsData.total} sản phẩm
                                </span>
                            </div>

                            {/* Mobile/tablet: Filter trigger */}
                            <div className="lg:hidden">
                                <Suspense fallback={null}>
                                    <FilterDrawer
                                        title="Bộ Lọc"
                                        filterKeys={['brand', 'subtype']}
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
                                                basePath="/thiet-bi-bep"
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
                                        Hãy thử thay đổi bộ lọc hoặc chọn danh mục khác.
                                    </p>
                                    <Link
                                        href="/thiet-bi-bep"
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
