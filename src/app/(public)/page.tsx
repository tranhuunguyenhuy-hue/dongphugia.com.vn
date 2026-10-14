import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"
import {
    getPublicHomeBanners,
    getPublicHomeContent,
} from "@dpg/public-home-runtime"
import { HeroBanner } from "@/components/home/hero-banner"
import { BrandSlider } from "@/components/home/brand-slider"
import { BlogSection } from "@/components/home/blog-section"
import { HomeCategoryBlockAlt } from "@/components/home/home-category-block-alt"
import { LazyContactSection } from "@/components/home/lazy-contact-section"

export const revalidate = 300

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

async function HomepageContentSections() {
    const { categories, posts } = await getPublicHomeContent()
    return (
        <>
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
            {categories.length > 0 && (
                <div className="max-w-[1280px] mx-auto px-5 py-6 lg:py-10 flex flex-col gap-12 lg:gap-16">
                    {categories.map((cat) => (
                        <HomeCategoryBlockAlt key={cat.id} categoryData={cat} />
                    ))}
                </div>
            )}

            {/* Blog */}
            <BlogSection posts={posts} />

            {/* Contact Form */}
            <LazyContactSection />
        </>
    )
}

export default async function HomePage() {
    await connection()
    const banners = await getPublicHomeBanners()

    return (
        <div className="bg-white">
            <h1 className="sr-only">
                Đông Phú Gia - Vật liệu xây dựng cao cấp tại Đà Lạt
            </h1>
            {/* Hero Banner */}
            <div className="-mt-[126px] pt-[126px]">
                <section className="max-w-[1280px] mx-auto px-5 pt-8 pb-4 lg:pt-10 lg:pb-6">
                    <div className="w-full">
                        <HeroBanner banners={banners} />
                    </div>
                </section>
            </div>

            <Suspense
                fallback={<div className="min-h-screen" aria-hidden="true" />}
            >
                <HomepageContentSections />
            </Suspense>
        </div>
    )
}
