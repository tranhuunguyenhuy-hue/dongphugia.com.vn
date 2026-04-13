import type { Metadata } from "next"
import { HeroBanner } from "@/components/home/hero-banner"
import { BrandSlider } from "@/components/home/brand-slider"
import { BlogSection } from "@/components/home/blog-section"
import { ProjectSection } from "@/components/home/project-section"
import { getFeaturedProductsByCategorySlug } from "@/lib/public-api-products"
import { getFeaturedProjects } from "@/lib/public-api-projects"
import { ProductCard } from "@/components/ui/product-card"
import Link from "next/link"
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
        images: [{ url: "/images/hero-banner.jpg", width: 1200, height: 630, alt: "Đông Phú Gia" }],
    },
}

const FEATURED_CATEGORIES = [
    { slug: "thiet-bi-ve-sinh", name: "Thiết Bị Vệ Sinh", basePath: "/thiet-bi-ve-sinh" },
    { slug: "thiet-bi-bep", name: "Thiết Bị Bếp", basePath: "/thiet-bi-bep" },
    { slug: "gach-op-lat", name: "Gạch Ốp Lát", basePath: "/gach-op-lat" },
    { slug: "vat-lieu-nuoc", name: "Vật Liệu Nước", basePath: "/vat-lieu-nuoc" },
]

export default async function HomePage() {
    const [banners, featuredProjects, ...featuredByCategory] = await Promise.all([
        prisma.banners.findMany({
            where: { is_active: true },
            orderBy: { sort_order: 'asc' },
            take: 5,
        }),
        getFeaturedProjects(),
        ...FEATURED_CATEGORIES.map(c => getFeaturedProductsByCategorySlug(c.slug, 8)),
    ])

    return (
        <div className="bg-white">
            {/* Hero */}
            <div className="-mt-[126px] pt-[126px]">
                <section className="max-w-[1280px] mx-auto px-5 pt-8 pb-4 lg:pt-10 lg:pb-6">
                    <div className="w-full">
                        <HeroBanner banners={banners} />
                    </div>
                </section>
            </div>

            {/* Brand Slider */}
            <div className="max-w-[1280px] mx-auto px-5">
                <BrandSlider />
            </div>

            <h1 className="sr-only">Đông Phú Gia - Đại lý Gạch ốp lát và Thiết bị vệ sinh cao cấp tại Đà Lạt</h1>

            {/* Featured products per category */}
            {FEATURED_CATEGORIES.map((cat, idx) => {
                const products = featuredByCategory[idx] ?? []
                if (products.length === 0) return null
                return (
                    <section key={cat.slug} className="max-w-[1280px] mx-auto px-5 py-10 lg:py-14">
                        <div className="flex items-end justify-between mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-[#192125] tracking-tight">{cat.name}</h2>
                                <p className="text-sm text-neutral-500 mt-0.5">Sản phẩm nổi bật</p>
                            </div>
                            <Link
                                href={cat.basePath}
                                className="text-sm font-medium text-[#2E7A96] hover:underline underline-offset-4 transition-all whitespace-nowrap"
                            >
                                Xem tất cả →
                            </Link>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                            {products.map(p => (
                                <ProductCard
                                    key={p.id}
                                    product={p}
                                    basePath={cat.basePath}
                                    patternSlug={(p as any).subcategories?.slug ?? "san-pham"}
                                />
                            ))}
                        </div>
                    </section>
                )
            })}

            <ProjectSection projects={featuredProjects} />
            <BlogSection />
        </div>
    )
}
