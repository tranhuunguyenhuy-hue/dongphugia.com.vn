import type { Metadata } from "next"
import { HeroBanner } from "@/components/home/hero-banner"
import { BrandSlider } from "@/components/home/brand-slider"
import { BlogSection } from "@/components/home/blog-section"
import { CategoryTabsSection } from "@/components/home/category-tabs-section"
import { FeaturedProductsClient } from "@/components/home/featured-products-client"
import { ContactSection } from "@/components/home/contact-section"
import { getFeaturedProductsByCategorySlug, getTopProductsPerBrand } from "@/lib/public-api-products"
import prisma from "@/lib/prisma"
import { siteConfig } from "@/config/site"

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

export default async function HomePage() {
    const [banners, tbvsData, bepData, gachData, nuocData] = await Promise.all([
        prisma.banners.findMany({
            where: { is_active: true },
            orderBy: { sort_order: 'asc' },
            take: 5,
        }),
        getFeaturedProductsByCategorySlug('thiet-bi-ve-sinh', null, null, 0, 20),
        getFeaturedProductsByCategorySlug('thiet-bi-bep', null, null, 0, 20),
        getFeaturedProductsByCategorySlug('gach-op-lat', null, null, 0, 20),
        getFeaturedProductsByCategorySlug('vat-lieu-nuoc', null, null, 0, 20),
    ])

    const allCategories = [
        { id: 'thiet-bi-ve-sinh', label: 'Thiết Bị Vệ Sinh', basePath: '/thiet-bi-ve-sinh', products: tbvsData.products, totalCount: tbvsData.total },
        { id: 'thiet-bi-bep', label: 'Thiết Bị Bếp', basePath: '/thiet-bi-bep', products: bepData.products, totalCount: bepData.total },
        { id: 'vat-lieu-nuoc', label: 'Vật Liệu Nước', basePath: '/vat-lieu-nuoc', products: nuocData.products, totalCount: nuocData.total },
        { id: 'gach-op-lat', label: 'Gạch Ốp Lát', basePath: '/gach-op-lat', products: gachData.products, totalCount: gachData.total },
    ].filter(c => c.products.length > 0)

    return (
        <div className="bg-white">
            {/* Hero Banner */}
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

            {/* Category Tabs & Subcategories (DPG V2) */}
            <CategoryTabsSection />

            {/* Featured Products */}
            {allCategories.length > 0 && (
                <section className="px-5 py-10 lg:py-14">
                    <FeaturedProductsClient categories={allCategories as any} />
                </section>
            )}

            {/* Blog */}
            <BlogSection />

            {/* Contact Form */}
            <ContactSection />
        </div>
    )
}
