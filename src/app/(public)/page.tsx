import type { Metadata } from "next"
import { getFeaturedProducts, getPatternTypesByCategorySlug, getBanners } from "@/lib/public-api"
import { HeroBanner } from "@/components/home/hero-banner"
import { BrandSlider } from "@/components/home/brand-slider"
import { BlogSection } from "@/components/home/blog-section"
import { ProjectSection } from "@/components/home/project-section"
import { HomeCategorySection } from "@/components/home/home-category-section"
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
    const [
        patternTypes, 
        banners, 
        featuredProjects,
        gach,
        tbvs,
        bep,
        sango,
        nuoc
    ] = await Promise.all([
        getPatternTypesByCategorySlug('gach-op-lat'),
        getBanners(5),
        getFeaturedProjects(),
        prisma.products.findMany({
            where: { is_featured: true, is_active: true },
            include: { collections: true, sizes: true, surfaces: true, pattern_types: true },
            take: 12,
            orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }]
        }),
        prisma.tbvs_products.findMany({
            where: { is_featured: true, is_active: true },
            include: { tbvs_product_types: true, tbvs_brands: true, tbvs_subtypes: true, tbvs_materials: true },
            take: 12,
            orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }]
        }),
        prisma.bep_products.findMany({
            where: { is_featured: true, is_active: true },
            include: { bep_product_types: true, bep_brands: true, bep_subtypes: true },
            take: 12,
            orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }]
        }),
        prisma.sango_products.findMany({
            where: { is_featured: true, is_active: true },
            include: { sango_product_types: true, origins: true },
            take: 12,
            orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }]
        }),
        prisma.nuoc_products.findMany({
            where: { is_featured: true, is_active: true },
            include: { nuoc_product_types: true, nuoc_brands: true, nuoc_subtypes: true, nuoc_materials: true },
            take: 12,
            orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }]
        })
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

            {/* Main content sections */}
            <div className="bg-white">
                <HomeCategorySection 
                    title="Gạch ốp lát"
                    subtitle="Bán chạy nhất"
                    products={gach}
                    basePath="/gach-op-lat"
                    viewAllHref="/gach-op-lat"
                />
                
                <HomeCategorySection 
                    title="Thiết bị vệ sinh"
                    subtitle="Chính Hãng Cao Cấp"
                    products={tbvs}
                    basePath="/thiet-bi-ve-sinh"
                    viewAllHref="/thiet-bi-ve-sinh"
                />

                <HomeCategorySection 
                    title="Thiết bị bếp"
                    subtitle="Hiện Đại & Tiện Nghi"
                    products={bep}
                    basePath="/thiet-bi-bep"
                    viewAllHref="/thiet-bi-bep"
                />

                <HomeCategorySection 
                    title="Sàn gỗ"
                    subtitle="Sang Trọng & Bền Bỉ"
                    products={sango}
                    basePath="/san-go"
                    viewAllHref="/san-go"
                />

                <HomeCategorySection 
                    title="Vật liệu ngành nước"
                    subtitle="Chất lượng Hàng đầu"
                    products={nuoc}
                    basePath="/vat-lieu-nuoc"
                    viewAllHref="/vat-lieu-nuoc"
                />
            </div>

            <ProjectSection projects={featuredProjects} />
            <BlogSection />
        </div>
    )
}
