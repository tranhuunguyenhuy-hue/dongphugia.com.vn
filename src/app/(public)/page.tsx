import type { Metadata } from "next"
import { HeroBanner } from "@/components/home/hero-banner"
import { BrandSlider } from "@/components/home/brand-slider"
import { BlogSection } from "@/components/home/blog-section"
import { ProjectSection } from "@/components/home/project-section"
import { getFeaturedProjects } from "@/lib/public-api-projects"
import prisma from "@/lib/prisma"

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
    // LEO-366: Temporarily fetch only banners and projects
    // Product sections will be restored in Phase 3 with unified schema
    const [banners, featuredProjects] = await Promise.all([
        prisma.banners.findMany({
            where: { is_active: true },
            orderBy: { sort_order: 'asc' },
            take: 5,
        }),
        getFeaturedProjects(),
    ])

    return (
        <div className="bg-white">
            {/* Hero section — full bleed, clean white */}
            <div className="-mt-[126px] pt-[126px]">
                <section className="max-w-[1280px] mx-auto px-5 pt-8 pb-4 lg:pt-10 lg:pb-6">
                    {/* Hero banner — full width */}
                    <div className="w-full">
                        <HeroBanner banners={banners} />
                    </div>
                </section>
            </div>

            {/* Brand slider (replaces old StatsBar) */}
            <div className="max-w-[1280px] mx-auto px-5">
                <BrandSlider />
            </div>

            {/* SEO H1 — visually hidden */}
            <h1 className="sr-only">Đông Phú Gia - Đại lý Gạch ốp lát và Thiết bị vệ sinh cao cấp tại Đà Lạt</h1>

            {/* LEO-366: Product category sections temporarily removed during DB restructure */}
            {/* Will be rebuilt in Phase 3 with unified product schema */}
            <div className="bg-white py-16">
                <div className="max-w-[1280px] mx-auto px-5 text-center">
                    <p className="text-muted-foreground">
                        Đang nâng cấp hệ thống sản phẩm. Vui lòng liên hệ trực tiếp để được tư vấn.
                    </p>
                </div>
            </div>

            <ProjectSection projects={featuredProjects} />
            <BlogSection />
        </div>
    )
}
