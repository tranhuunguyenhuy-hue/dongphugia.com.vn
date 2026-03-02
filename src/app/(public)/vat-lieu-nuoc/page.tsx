import { Metadata } from "next"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { Suspense } from "react"
import { getNuocTypes, getNuocProducts, getNuocBrands, getNuocMaterials } from "@/lib/public-api-nuoc"
import { SmartFilterNuoc } from "@/components/category/smart-filter-nuoc"
import { ProductCard } from "@/components/ui/product-card"
import { BrandCarouselNuoc } from "@/components/category/brand-carousel-nuoc"
import { FilterDrawerNuoc } from "@/components/category/filter-drawer-nuoc"

export const revalidate = 3600

export const metadata: Metadata = {
    title: "Vật liệu ngành nước",
    description: "Các sản phẩm vật liệu ngành nước, bồn nước, ống nhựa, phụ kiện hàn nhiệt chất lượng cao tại Đông Phú Gia Đà Lạt.",
    keywords: ["vật liệu nước", "ống nhựa", "bồn nước", "phụ kiện nước", "Đà Lạt"],
    openGraph: {
        title: "Vật liệu ngành nước | Đông Phú Gia",
        description: "Các sản phẩm vật liệu ngành nước, bồn nước, ống nhựa chất lượng cao tại Đà Lạt.",
        url: "/vat-lieu-nuoc",
        type: "website",
    },
}

interface PageProps {
    searchParams: Promise<{ [key: string]: string | undefined }>
}

export default async function VatLieuNuocPage({ searchParams }: PageProps) {
    const sp = await searchParams

    const activeTypeSlug = sp.type
    const activeSubtypeSlug = sp.subtype
    const activeBrandSlug = sp.brand
    const activeMaterialSlug = sp.material

    const filters = {
        typeSlug: activeTypeSlug,
        subtypeSlug: activeSubtypeSlug,
        brandSlug: activeBrandSlug,
        materialSlug: activeMaterialSlug,
        page: sp.page ? parseInt(sp.page, 10) : 1,
    }

    // Parallel data fetching
    const [typesData, productsData, brandsData, materialsData] = await Promise.all([
        getNuocTypes(),
        getNuocProducts(filters),
        getNuocBrands(),
        getNuocMaterials()
    ])

    const activeType = activeTypeSlug ? typesData.find((t: any) => t.slug === activeTypeSlug) : null
    const subtypesForFilter = activeType ? activeType.nuoc_subtypes : typesData.flatMap((t: any) => t.nuoc_subtypes)

    const mappedBrands = brandsData.map((b: any) => ({
        name: b.name,
        slug: b.slug,
    }))

    const mappedMaterials = materialsData.map((m: any) => ({
        name: m.name,
        slug: m.slug,
    }))

    return (
        <div className="relative min-h-screen bg-white">
            <div className="absolute left-0 right-0 top-0 h-[700px] bg-gradient-to-b from-[#dcfce7] to-white pointer-events-none" />

            <div className="max-w-[1280px] mx-auto px-5 relative z-10 py-10">
                <div className="flex flex-col lg:flex-row gap-[51px]">

                    {/* ── Left Sidebar (desktop only) ── */}
                    <aside className="hidden lg:flex lg:w-[302px] shrink-0 flex-col gap-[24px] self-start lg:sticky lg:top-24 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:overscroll-contain scrollbar-thin scrollbar-thumb-[#d1fae5] scrollbar-track-transparent">
                        <Suspense fallback={<div className="h-64 animate-pulse bg-gray-100 rounded-lg" />}>
                            <SmartFilterNuoc
                                brands={mappedBrands}
                                subtypes={subtypesForFilter}
                                materials={mappedMaterials}
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
                            <span className="text-[#15803d] font-semibold">Vật liệu ngành nước</span>
                        </div>

                        {/* Collection Carousel */}
                        {mappedBrands.length > 0 && (
                            <Suspense fallback={null}>
                                <BrandCarouselNuoc
                                    typeName={activeType ? activeType.name.toLowerCase() : ""}
                                    typeSlug={activeTypeSlug || ""}
                                    brands={mappedBrands}
                                    activeSlug={activeBrandSlug}
                                    categoryMode={!activeTypeSlug}
                                />
                            </Suspense>
                        )}

                        {/* Category Selector (Tabs) */}
                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                            <Link href="/vat-lieu-nuoc" className={`px-4 py-2 rounded-full border whitespace-nowrap text-sm font-medium transition-colors ${!activeTypeSlug ? "bg-[#15803d] text-white border-[#15803d]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"}`}>
                                Tất cả
                            </Link>
                            {typesData.map((type: any) => (
                                <Link
                                    key={type.id}
                                    href={`/vat-lieu-nuoc?type=${type.slug}`}
                                    className={`px-4 py-2 rounded-full border whitespace-nowrap text-sm font-medium transition-colors ${activeTypeSlug === type.slug ? "bg-[#15803d] text-white border-[#15803d]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"}`}
                                >
                                    {type.name}
                                </Link>
                            ))}
                        </div>

                        {/* Products Section */}
                        <div className="flex flex-col gap-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-[24px] font-semibold text-[#111827] tracking-[-0.48px] leading-[32px]">
                                    Danh sách{" "}
                                    <span className="text-[#15803d] font-bold">sản phẩm</span>{" "}
                                    {activeType ? activeType.name.toLowerCase() : "vật tư nước"}
                                </h2>
                                <span className="text-[14px] text-[#6b7280]">
                                    {productsData.total} sản phẩm
                                </span>
                            </div>

                            {/* Mobile/tablet: Filter trigger */}
                            <div className="lg:hidden">
                                <Suspense fallback={null}>
                                    <FilterDrawerNuoc
                                        brands={mappedBrands}
                                        subtypes={subtypesForFilter}
                                        materials={mappedMaterials}
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
                                            basePath="/vat-lieu-nuoc"
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
                                        href="/vat-lieu-nuoc"
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
