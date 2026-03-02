import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ChevronRight } from "lucide-react"
import { getFeaturedProducts, getPatternTypesByCategorySlug, getBanners } from "@/lib/public-api"
import { ProductCard } from "@/components/ui/product-card"
import { HeroBanner } from "@/components/home/hero-banner"
import { CategorySidebar } from "@/components/home/category-sidebar"
import { StatsBar } from "@/components/home/stats-bar"
import { ValuesSection } from "@/components/home/values-section"
import { CategoryListing } from "@/components/home/category-listing"

export const revalidate = 3600

export const metadata: Metadata = {
    title: "Vật liệu xây dựng cao cấp tại Đà Lạt",
    description: "Đông Phú Gia - Nhà phân phối gạch ốp lát, thiết bị vệ sinh cao cấp tại Đà Lạt. Hơn 1.500 mẫu sản phẩm chính hãng từ TOTO, Inax, Kohler, Marble và nhiều thương hiệu uy tín.",
    keywords: ["gạch ốp lát", "thiết bị vệ sinh", "vật liệu xây dựng", "Đà Lạt", "Đông Phú Gia"],
    openGraph: {
        title: "Đông Phú Gia - Vật liệu xây dựng cao cấp tại Đà Lạt",
        description: "Hơn 1.500 mẫu gạch ốp lát, thiết bị vệ sinh chính hãng. Tư vấn miễn phí, giao hàng Đà Lạt và các tỉnh lân cận.",
        url: "/",
        images: [
            {
                url: "/images/hero-banner.jpg",
                width: 1200,
                height: 630,
                alt: "Đông Phú Gia - Vật liệu xây dựng cao cấp",
            },
        ],
    },
}

export default async function HomePage() {
    const [patternTypes, featuredProducts, banners] = await Promise.all([
        getPatternTypesByCategorySlug('gach-op-lat'),
        getFeaturedProducts(8),
        getBanners(5),
    ])

    return (
        <div className="bg-white">
            {/* Hero section with green gradient background */}
            <div className="bg-gradient-to-b from-[#dcfce7] to-white">
                <section className="max-w-[1280px] mx-auto px-5 py-10">
                    <div className="flex flex-col gap-6">
                        {/* Category sidebar + Hero banner */}
                        <div className="flex gap-6 items-start">
                            {/* Category sidebar — hidden on mobile */}
                            <div className="hidden lg:block">
                                <CategorySidebar />
                            </div>
                            {/* Hero banner */}
                            <HeroBanner banners={banners} />
                        </div>

                        {/* Brand logos */}
                        {/* Mobile + Tablet: auto-scroll marquee */}
                        <div className="lg:hidden overflow-hidden py-2">
                            <div className="inline-flex animate-marquee">
                                {[...Array(4)].map((_, rep) =>
                                    ["BOSCH", "HAFELE", "JOMOO", "CAESAR", "TOTO", "COTTO"].map((brand) => (
                                        <div
                                            key={`${rep}-${brand}`}
                                            className="shrink-0 h-[72px] w-[130px] mx-3 flex items-center justify-center opacity-[0.38] hover:opacity-100 transition-opacity duration-300"
                                        >
                                            <span className="text-[16px] font-bold text-[#374151] tracking-widest">{brand}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Desktop only: static centered */}
                        <div className="hidden lg:flex gap-[31px] items-center justify-center py-2">
                            {["BOSCH", "HAFELE", "JOMOO", "CAESAR", "TOTO", "COTTO"].map((brand) => (
                                <div
                                    key={brand}
                                    className="shrink-0 h-[100px] w-[177px] flex items-center justify-center opacity-[0.38] hover:opacity-100 transition-opacity duration-300 cursor-pointer"
                                >
                                    <span className="text-[20px] font-bold text-[#374151] tracking-widest">{brand}</span>
                                </div>
                            ))}
                        </div>

                        {/* Stats bar — desktop */}
                        <div className="hidden md:block">
                            <StatsBar />
                        </div>

                        {/* Stats — mobile */}
                        <div className="md:hidden grid grid-cols-2 gap-4 py-4">
                            {[
                                { value: "70+", label: "Thương hiệu uy tín" },
                                { value: "10+", label: "Dự án độc quyền" },
                                { value: "1.5K+", label: "Mẫu sản phẩm" },
                                { value: "88%", label: "Khách hàng hài lòng" },
                            ].map((s) => (
                                <div key={s.label} className="text-center">
                                    <p className="text-[#15803d] font-bold text-3xl">{s.value}</p>
                                    <p className="text-[#4b5563] text-sm mt-1">{s.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </div>
            <ValuesSection />
            <CategoryListing />

            {/* Hidden H1 for SEO - Since Hero Banner might not have an H1 text, we provide one for the whole page */}
            <h1 className="sr-only">Đông Phú Gia - Đại lý Gạch ốp lát và Thiết bị vệ sinh cao cấp tại Đà Lạt</h1>

            {/* Pattern Types Grid */}
            {patternTypes.length > 0 && (
                <section className="container mx-auto px-4 py-10">
                    <div className="flex items-end justify-between mb-8">
                        <div>
                            <h2 className="text-3xl font-bold text-[#0f172a]">Gạch ốp lát</h2>
                            <p className="text-[#64748b] mt-1">Khám phá các dòng gạch cao cấp đa dạng mẫu mã</p>
                        </div>
                        <Link href="/gach-op-lat" className="hidden md:flex items-center gap-1 text-[#15803d] font-medium hover:underline" aria-label="Xem tất cả Gạch ốp lát">
                            Xem tất cả <ChevronRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {patternTypes.map((pt) => (
                            <Link
                                key={pt.id}
                                href={`/gach-op-lat?pattern=${pt.slug}`}
                                className="group flex flex-col gap-3 rounded-2xl overflow-hidden border border-[#e2e8f0] hover:shadow-lg transition-shadow"
                                aria-label={`Xem danh sách sản phẩm ${pt.name}`}
                            >
                                <div className="aspect-square overflow-hidden bg-gray-100">
                                    {pt.thumbnail_url ? (
                                        <Image
                                            src={pt.thumbnail_url}
                                            alt={`Mẫu vân ${pt.name}`}
                                            width={300}
                                            height={300}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                                            {pt.name}
                                        </div>
                                    )}
                                </div>
                                <div className="px-4 pb-4">
                                    <h3 className="font-semibold text-[#0f172a] group-hover:text-[#15803d] transition-colors">
                                        {pt.name}
                                    </h3>
                                    <p className="text-sm text-[#64748b] mt-0.5">
                                        {(pt._count as any)?.products || 0} sản phẩm
                                    </p>
                                </div>
                            </Link>
                        ))}
                    </div>

                    <div className="flex md:hidden justify-center mt-6">
                        <Button asChild variant="outline" className="rounded-xl border-[#15803d] text-[#15803d]">
                            <Link href="/gach-op-lat">Xem tất cả <ChevronRight className="h-4 w-4 ml-1" aria-hidden="true" /></Link>
                        </Button>
                    </div>
                </section>
            )}

            {/* Featured Products */}
            {featuredProducts.length > 0 && (
                <section className="container mx-auto px-4 py-10 pb-20">
                    <div className="flex items-end justify-between mb-8">
                        <div>
                            <h2 className="text-3xl font-bold text-[#0f172a]">Sản phẩm nổi bật</h2>
                            <p className="text-[#64748b] mt-1">Những mẫu gạch được yêu thích nhất</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {featuredProducts.map((product) => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
                </section>
            )}
        </div>
    )
}
