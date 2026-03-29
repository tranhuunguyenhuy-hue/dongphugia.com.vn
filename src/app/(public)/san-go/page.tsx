import { Metadata } from "next"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { Suspense } from "react"
import { getSangoTypes, getSangoProducts } from "@/lib/public-api-sango"
import { SmartFilter } from "@/components/category/smart-filter"
import { ProductCard } from "@/components/ui/product-card"
import { FilterDrawer } from "@/components/category/filter-drawer"
import { ProductPagination } from "@/components/ui/product-pagination"
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

    const thicknessOptions = [
        { name: 'Dưới 8mm', slug: 'duoi-8' },
        { name: '8mm', slug: '8mm' },
        { name: '10mm', slug: '10mm' },
        { name: '12mm', slug: '12mm' },
        { name: 'Trên 12mm', slug: 'tren-12' },
    ]

    const filterSections = [
        { key: 'color', label: 'Màu Sắc', options: mappedColors, mode: 'single' as const, defaultOpen: true },
        { key: 'origin', label: 'Xuất Xứ', options: mappedOrigins, mode: 'single' as const, defaultOpen: true },
        { key: 'thickness', label: 'Độ Dày', options: thicknessOptions, mode: 'single' as const, defaultOpen: true },
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
                            <span className="text-neutral-900 font-medium">Sàn gỗ - Sàn nhựa</span>
                        </div>

                        {/* Category Selector (Tabs) */}
                        <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide pt-2">
                            <Link href="/san-go" className={`px-4 py-1.5 rounded-full border whitespace-nowrap text-[13.5px] font-medium transition-colors ${!activeTypeSlug ? "bg-neutral-900 text-white border-neutral-900" : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300 hover:text-neutral-900"}`}>
                                Tất cả
                            </Link>
                            {typesData.map((type: any) => (
                                <Link
                                    key={type.id}
                                    href={`/san-go?type=${type.slug}`}
                                    className={`px-4 py-1.5 rounded-full border whitespace-nowrap text-[13.5px] font-medium transition-colors ${activeTypeSlug === type.slug ? "bg-neutral-900 text-white border-neutral-900" : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300 hover:text-neutral-900"}`}
                                >
                                    {type.name}
                                </Link>
                            ))}
                        </div>

                        {/* Products Section */}
                        <div className="flex flex-col gap-6 mt-2">
                            <div className="flex items-end justify-between border-b border-neutral-100 pb-4">
                                <h1 className="text-[28px] font-semibold text-neutral-900 tracking-tight leading-none">
                                    {activeType ? activeType.name : "Sàn gỗ - Sàn nhựa"}
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
                                        filterKeys={['color', 'origin', 'thickness']}
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
                                                basePath="/san-go"
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
                                        href="/san-go"
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
