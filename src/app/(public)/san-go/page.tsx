import { Metadata } from "next"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { Suspense } from "react"
import { getSangoTypes, getSangoProducts } from "@/lib/public-api-sango"
import { SmartFilterSango } from "@/components/category/smart-filter-sango"
import { ProductCard } from "@/components/ui/product-card"
import { FilterDrawerSango } from "@/components/category/filter-drawer-sango"
import prisma from "@/lib/prisma"

export const revalidate = 3600

export const metadata: Metadata = {
    title: "Sàn gỗ - Sàn nhựa",
    description: "Sàn gỗ công nghiệp, sàn nhựa ngoài trời cao cấp, chống nước, chống xước tại Đà Lạt.",
    keywords: ["sàn gỗ", "sàn nhựa", "sàn công nghiệp", "Đà Lạt"],
    openGraph: {
        title: "Sàn gỗ - Sàn nhựa | Đông Phú Gia",
        description: "Sàn gỗ công nghiệp, sàn nhựa ngoài trời cao cấp, chống nước, chống xước tại Đà Lạt.",
        url: "/san-go",
        type: "website",
    },
}

interface PageProps {
    searchParams: Promise<{ [key: string]: string | undefined }>
}

export default async function SanGoPage({ searchParams }: PageProps) {
    const sp = await searchParams

    const activeTypeSlug = sp.type
    const activeColorSlug = sp.color
    const activeOriginSlug = sp.origin
    const activeThicknessSlug = sp.thickness

    // Thickness mapping
    let thicknessMin: number | undefined
    let thicknessMax: number | undefined
    if (activeThicknessSlug === "duoi-8") {
        thicknessMin = 0; thicknessMax = 7.9;
    } else if (activeThicknessSlug === "8mm") {
        thicknessMin = 8; thicknessMax = 8.9;
    } else if (activeThicknessSlug === "10mm") {
        thicknessMin = 10; thicknessMax = 10.9;
    } else if (activeThicknessSlug === "12mm") {
        thicknessMin = 12; thicknessMax = 12.9;
    } else if (activeThicknessSlug === "tren-12") {
        thicknessMin = 13; thicknessMax = 100;
    }

    // Fetch Colors and Origins using Prisma directly for Sango
    // We only want colors and origins that exist in active Sango products
    const [colorsRaw, originsRaw, typesData] = await Promise.all([
        prisma.colors.findMany({
            orderBy: { name: 'asc' },
        }),
        prisma.origins.findMany({
            orderBy: { name: 'asc' },
        }),
        getSangoTypes()
    ]);

    const activeColorObj = colorsRaw.find((c: any) => c.slug === activeColorSlug);
    const activeOriginObj = originsRaw.find((o: any) => o.slug === activeOriginSlug);
    const activeType = activeTypeSlug ? typesData.find((t: any) => t.slug === activeTypeSlug) : null;

    const filters = {
        typeSlug: activeTypeSlug,
        colorId: activeColorObj?.id,
        originId: activeOriginObj?.id,
        thicknessMin,
        thicknessMax,
        page: sp.page ? parseInt(sp.page, 10) : 1,
    }

    const productsData = await getSangoProducts(filters);

    const mappedColors = colorsRaw.map((c: any) => ({
        name: c.name,
        slug: c.slug,
        id: c.id
    }))

    const mappedOrigins = originsRaw.map((o: any) => ({
        name: o.name,
        slug: o.slug,
        id: o.id
    }))

    return (
        <div className="relative min-h-screen bg-white">
            <div className="absolute left-0 right-0 top-0 h-[700px] bg-gradient-to-b from-[#fef3c7] to-white pointer-events-none" />

            <div className="max-w-[1280px] mx-auto px-5 relative z-10 py-10">
                <div className="flex flex-col lg:flex-row gap-[51px]">

                    {/* ── Left Sidebar (desktop only) ── */}
                    <aside className="hidden lg:flex lg:w-[302px] shrink-0 flex-col gap-[24px] self-start lg:sticky lg:top-24 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:overscroll-contain scrollbar-thin scrollbar-thumb-[#fde68a] scrollbar-track-transparent">
                        <Suspense fallback={<div className="h-64 animate-pulse bg-gray-100 rounded-lg" />}>
                            <SmartFilterSango
                                colors={mappedColors}
                                origins={mappedOrigins}
                            />
                        </Suspense>
                    </aside>

                    {/* ── Main Content ── */}
                    <div className="flex-1 flex flex-col gap-[40px] min-w-0">

                        {/* Breadcrumb */}
                        <div className="flex items-center gap-2 text-[14px]">
                            <Link href="/" className="text-[#4b5563] hover:text-[#d97706] transition-colors font-medium">
                                Trang chủ
                            </Link>
                            <ChevronRight className="h-4 w-4 text-[#9ca3af]" strokeWidth={1.5} />
                            <span className="text-[#d97706] font-semibold">Sàn gỗ - Sàn nhựa</span>
                        </div>

                        {/* Category Selector (Tabs) */}
                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                            <Link href="/san-go" className={`px-4 py-2 rounded-full border whitespace-nowrap text-sm font-medium transition-colors ${!activeTypeSlug ? "bg-[#d97706] text-white border-[#d97706]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"}`}>
                                Tất cả
                            </Link>
                            {typesData.map((type: any) => (
                                <Link
                                    key={type.id}
                                    href={`/san-go?type=${type.slug}`}
                                    className={`px-4 py-2 rounded-full border whitespace-nowrap text-sm font-medium transition-colors ${activeTypeSlug === type.slug ? "bg-[#d97706] text-white border-[#d97706]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"}`}
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
                                    <span className="text-[#d97706] font-bold">sản phẩm</span>{" "}
                                    {activeType ? activeType.name.toLowerCase() : "sàn gỗ, sàn nhựa"}
                                </h2>
                                <span className="text-[14px] text-[#6b7280]">
                                    {productsData.total} sản phẩm
                                </span>
                            </div>

                            {/* Mobile/tablet: Filter trigger */}
                            <div className="lg:hidden">
                                <Suspense fallback={null}>
                                    <FilterDrawerSango
                                        colors={mappedColors}
                                        origins={mappedOrigins}
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
                                            basePath="/san-go"
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-24 text-center">
                                    <div className="w-20 h-20 rounded-full bg-[#fef3c7] flex items-center justify-center mb-4">
                                        <span className="text-3xl">🔍</span>
                                    </div>
                                    <h3 className="text-lg font-semibold text-[#111827] mb-2">
                                        Không tìm thấy sản phẩm
                                    </h3>
                                    <p className="text-[#6b7280] mb-6">
                                        Hãy thử thay đổi bộ lọc hoặc chọn danh mục khác.
                                    </p>
                                    <Link
                                        href="/san-go"
                                        className="text-[#d97706] font-medium hover:underline"
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
