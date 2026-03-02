import { Metadata } from "next"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { Suspense } from "react"
import { getBepTypes, getBepProducts } from "@/lib/public-api-bep"
import prisma from "@/lib/prisma"
import { SmartFilterBep } from "@/components/category/smart-filter-bep"
import { ProductCard } from "@/components/ui/product-card"
import { CategorySelectorBep } from "@/components/category/category-selector-bep"
import { BrandCarouselBep } from "@/components/category/brand-carousel-bep"
import { FilterDrawerBep } from "@/components/category/filter-drawer-bep"

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
        _count: { bep_products: b._count.bep_products },
    }))

    return (
        <div className="relative min-h-screen bg-white">
            <div className="absolute left-0 right-0 top-0 h-[700px] bg-gradient-to-b from-[#dcfce7] to-white pointer-events-none" />

            <div className="max-w-[1280px] mx-auto px-5 relative z-10 py-10">
                <div className="flex flex-col lg:flex-row gap-[51px]">

                    {/* ── Left Sidebar (desktop only) ── */}
                    <aside className="hidden lg:flex lg:w-[302px] shrink-0 flex-col gap-[24px] self-start lg:sticky lg:top-24 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:overscroll-contain scrollbar-thin scrollbar-thumb-[#d1fae5] scrollbar-track-transparent">
                        <Suspense fallback={<div className="h-64 animate-pulse bg-gray-100 rounded-lg" />}>
                            <SmartFilterBep
                                brands={mappedBrands}
                                subtypes={subtypesForFilter}
                            />
                        </Suspense>
                    </aside>

                    {/* ── Main Content ── */}
                    <div className="flex-1 flex flex-col gap-[40px] min-w-0">

                        {/* Breadcrumb */}
                        <div className="flex items-center gap-2 text-[14px]">
                            <Link href="/" className="text-[#4b5563] hover:text-[#15803d] transition-colors font-medium">
                                Trang chủ
                            </Link>
                            <ChevronRight className="h-4 w-4 text-[#9ca3af]" strokeWidth={1.5} />
                            <span className="text-[#15803d] font-semibold">Thiết bị bếp</span>
                        </div>

                        {/* Collection Carousel */}
                        {mappedBrands.length > 0 && (
                            <Suspense fallback={null}>
                                <BrandCarouselBep
                                    typeName={activeType ? activeType.name.toLowerCase() : ""}
                                    typeSlug={activeTypeSlug || ""}
                                    brands={mappedBrands}
                                    activeSlug={activeBrandSlug}
                                    categoryMode={!activeTypeSlug}
                                />
                            </Suspense>
                        )}

                        {/* Pattern Type Selector */}
                        <Suspense fallback={null}>
                            <CategorySelectorBep types={typesData} />
                        </Suspense>

                        {/* Products Section */}
                        <div className="flex flex-col gap-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-[24px] font-semibold text-[#111827] tracking-[-0.48px] leading-[32px]">
                                    Tất cả{" "}
                                    <span className="text-[#15803d] font-bold">sản phẩm</span>{" "}
                                    {activeType ? activeType.name.toLowerCase() : "thiết bị bếp"}
                                </h2>
                                <span className="text-[14px] text-[#6b7280]">
                                    {productsData.total} sản phẩm
                                </span>
                            </div>

                            {/* Mobile/tablet: Filter trigger */}
                            <div className="lg:hidden">
                                <Suspense fallback={null}>
                                    <FilterDrawerBep
                                        brands={mappedBrands}
                                        subtypes={subtypesForFilter}
                                        productCount={productsData.total}
                                    />
                                </Suspense>
                            </div>

                            {productsData.products.length > 0 ? (
                                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 xl:gap-8">
                                    {productsData.products.map((product: any) => (
                                        <ProductCard
                                            key={product.id}
                                            product={product}
                                            basePath="/thiet-bi-bep"
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
                                        Hãy thử thay đổi bộ lọc hoặc chọn danh mục khác.
                                    </p>
                                    <Link
                                        href="/thiet-bi-bep"
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
