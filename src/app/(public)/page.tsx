import type { Metadata } from "next"
import { HeroBanner } from "@/components/home/hero-banner"
import { BrandSlider } from "@/components/home/brand-slider"
import { BlogSection } from "@/components/home/blog-section"
import { HomeCategoryBlockAlt } from "@/components/home/home-category-block-alt"
import { ContactSection } from "@/components/home/contact-section"
import { getFeaturedProductsByCategorySlug } from "@/lib/public-api-products"
import prisma from "@/lib/prisma"

export const revalidate = 3600

export const metadata: Metadata = {
    title: { absolute: "Đông Phú Gia - Vật liệu xây dựng cao cấp tại Đà Lạt" },
    description: "Đông Phú Gia - Nhà phân phối gạch ốp lát, thiết bị vệ sinh cao cấp tại Đà Lạt. Hơn 1.500 mẫu sản phẩm chính hãng từ TOTO, Inax, Kohler, Marble và nhiều thương hiệu uy tín.",
    keywords: ["gạch ốp lát", "thiết bị vệ sinh", "vật liệu xây dựng", "Đà Lạt", "Đông Phú Gia"],
    alternates: { canonical: "/" },
    openGraph: {
        title: "Đông Phú Gia — Vật Liệu Xây Dựng Cao Cấp Đà Lạt",
        description: "Hơn 1.500 mẫu gạch ốp lát, thiết bị vệ sinh chính hãng. Tư vấn miễn phí, giao hàng Đà Lạt và các tỉnh lân cận.",
        url: "/",
        images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Đông Phú Gia - Vật liệu xây dựng cao cấp tại Đà Lạt" }],
    },
    twitter: {
        card: "summary_large_image",
        images: ["/opengraph-image"],
    },
}

export default async function HomePage() {
    const [banners, tbvsData, bepData, gachData, nuocData, tbvsBrands, tbvsSubcats, bepSubcats, bepBrands] = await Promise.all([
        prisma.banners.findMany({
            where: { is_active: true },
            orderBy: { sort_order: 'asc' },
            take: 5,
        }),
        // getHomeFeaturedProducts(15), // Tạm ẩn để nghiên cứu thêm
        getFeaturedProductsByCategorySlug('thiet-bi-ve-sinh', ['toto', 'inax'], null, 0, 5),
        getFeaturedProductsByCategorySlug('thiet-bi-bep', null, null, 0, 5),
        getFeaturedProductsByCategorySlug('gach-op-lat', null, null, 0, 5),
        getFeaturedProductsByCategorySlug('vat-lieu-nuoc', null, null, 0, 5),
        prisma.brands.findMany({
            where: { products: { some: { categories: { slug: 'thiet-bi-ve-sinh' } } } },
            select: { name: true, slug: true }
        }),
        prisma.subcategories.findMany({
            where: { 
                categories: { slug: 'thiet-bi-ve-sinh' }
            },
            select: { name: true, slug: true }
        }),
        prisma.subcategories.findMany({
            where: { 
                categories: { slug: 'thiet-bi-bep' },
                slug: { notIn: ['thiet-bi-bep-khac'] }
            },
            select: { name: true, slug: true }
        }),
        prisma.brands.findMany({
            where: { products: { some: { categories: { slug: 'thiet-bi-bep' } } } },
            select: { name: true, slug: true }
        })
    ])

    const allCategories = [
        { 
            id: 'thiet-bi-ve-sinh', 
            label: 'Thiết Bị Vệ Sinh', 
            basePath: '/thiet-bi-ve-sinh', 
            products: tbvsData.products, 
            totalCount: tbvsData.total,
            availableBrands: tbvsBrands,
            availableSubcategories: tbvsSubcats
        },
        { 
            id: 'thiet-bi-bep', 
            label: 'Thiết Bị Bếp', 
            basePath: '/thiet-bi-bep', 
            products: bepData.products, 
            totalCount: bepData.total,
            availableBrands: bepBrands,
            availableSubcategories: bepSubcats
        },
        { id: 'vat-lieu-nuoc', label: 'Vật Liệu Nước', basePath: '/vat-lieu-nuoc', products: nuocData.products, totalCount: nuocData.total },
        { id: 'gach-op-lat', label: 'Gạch Ốp Lát', basePath: '/gach-op-lat', products: gachData.products, totalCount: gachData.total },
    ].filter(c => c.products.length > 0)

    return (
        <div className="bg-white">
            <h1 className="sr-only">Đông Phú Gia - Vật liệu xây dựng cao cấp tại Đà Lạt</h1>
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

            {/* Featured Products (Khối 1) - Tạm ẩn để nghiên cứu thêm */}
            {/* 
            {homeFeatured && homeFeatured.length > 0 && (
                <div className="max-w-[1280px] mx-auto px-5 mt-8">
                    <HomeFeaturedProducts products={homeFeatured} />
                </div>
            )}
            */}

            {/* Category Blocks (Khối 2-5) */}
            {allCategories.length > 0 && (
                <div className="max-w-[1280px] mx-auto px-5 py-6 lg:py-10 flex flex-col gap-12 lg:gap-16">
                    {allCategories.map((cat) => (
                        <HomeCategoryBlockAlt key={cat.id} categoryData={cat} />
                    ))}
                </div>
            )}

            {/* Blog */}
            <BlogSection />

            {/* Contact Form */}
            <ContactSection />
        </div>
    )
}
