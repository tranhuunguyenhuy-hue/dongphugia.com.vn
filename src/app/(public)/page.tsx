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
import { FeaturedCategories } from "@/components/home/featured-categories"
import { BlogSection } from "@/components/home/blog-section"
import { ProjectSection } from "@/components/home/project-section"
import { getFeaturedProjects } from "@/lib/public-api-projects"

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
    const [patternTypes, featuredProducts, banners, featuredProjects] = await Promise.all([
        getPatternTypesByCategorySlug('gach-op-lat'),
        getFeaturedProducts(8),
        getBanners(5),
        getFeaturedProjects(),
    ])

    return (
        <div className="bg-white">
            {/* Hero section — full bleed from top, sits behind fixed header */}
            <div className="bg-gradient-to-b from-[#dcfce7] to-white -mt-[126px] pt-[126px]">
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

            <FeaturedCategories />
            <ProjectSection projects={featuredProjects} />
            <BlogSection />
        </div>
    )
}
