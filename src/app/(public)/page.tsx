import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"
import Link from "next/link"
import {
    getPublicHomeBanners,
    getPublicHomeContent,
} from "@dpg/public-home-runtime"
import { HeroBanner } from "@/components/home/hero-banner"
import { BrandSlider } from "@/components/home/brand-slider"
import { BlogSection } from "@/components/home/blog-section"
import { HomeCategoryBlockAlt } from "@/components/home/home-category-block-alt"
import { LazyContactSection } from "@/components/home/lazy-contact-section"
import { NAV_PRODUCT_CATEGORIES, siteConfig } from "@/config/site"

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

// The Cloudflare emergency candidate selects this explicit variant of the
// canonical Public home. The normal Production page above remains unchanged.
export function EmergencyPublicHomePage() {
    return (
        <div className="bg-white">
            <section className="mx-auto grid max-w-[1280px] gap-8 px-5 py-10 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-16">
                <div className="space-y-6">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-700">Đông Phú Gia · Đà Lạt</p>
                    <h1 className="text-4xl font-semibold leading-tight text-stone-900 md:text-5xl">
                        Vật liệu xây dựng cho không gian của bạn
                    </h1>
                    <p className="max-w-xl text-lg leading-8 text-stone-600">
                        Danh mục trực tuyến đang được cập nhật. Chúng tôi chưa hiển thị sản phẩm,
                        giá hoặc tình trạng hàng trên website; vui lòng liên hệ trực tiếp để được tư vấn.
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <Link href="/lien-he" className="rounded-full bg-brand-700 px-6 py-3 font-semibold text-white hover:bg-brand-800">
                            Thông tin liên hệ
                        </Link>
                        <a href={`tel:${siteConfig.contact.hotline}`} className="rounded-full border border-brand-700 px-6 py-3 font-semibold text-brand-700 hover:bg-brand-50">
                            Gọi {siteConfig.contact.hotlineLabel}
                        </a>
                    </div>
                </div>
                <figure>
                    {/* This existing editorial asset has no SKU, price, or stock claim. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/images/banner-3.jpg"
                        alt="Không gian nội thất minh họa"
                        width={640}
                        height={640}
                        className="aspect-square w-full rounded-2xl object-cover shadow-md"
                    />
                    <figcaption className="mt-2 text-right text-xs text-stone-500">Hình ảnh minh họa</figcaption>
                </figure>
            </section>
            <section className="border-t border-stone-200 bg-stone-50">
                <div className="mx-auto max-w-[1280px] px-5 py-12 lg:px-8">
                    <h2 className="text-2xl font-semibold text-stone-900">Các nhóm hàng</h2>
                    <p className="mt-2 text-stone-600">Chọn nhóm hàng để xem thông tin liên hệ và trạng thái cập nhật.</p>
                    <ul className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {NAV_PRODUCT_CATEGORIES.map(({ href, label }) => (
                            <li key={href}>
                                <Link href={href} className="block rounded-2xl border border-stone-200 bg-white p-6 font-semibold text-stone-900 transition hover:border-brand-500 hover:text-brand-700">
                                    {label} <span aria-hidden="true">→</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            </section>
        </div>
    )
}

async function HomepageContentSections() {
    const { categories, posts, previewNotice } = await getPublicHomeContent()
    return (
        <>
            {/* Brand Slider */}
            <div className="max-w-[1280px] mx-auto px-5">
                <BrandSlider />
            </div>

            {previewNotice ? (
                <aside
                    role="note"
                    className="mx-auto max-w-[1280px] rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-950"
                >
                    {previewNotice}
                </aside>
            ) : null}

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
