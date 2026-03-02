import { Metadata } from "next"
import Link from "next/link"
import { ChevronRight, Phone } from "lucide-react"
import { notFound } from "next/navigation"
import { getProductBySlug, getRelatedProducts, getRelatedProductsInCollection } from "@/lib/public-api"
import { ProductImageGallery } from "@/components/product/product-image-gallery"
import { ProductDetailTabs } from "@/components/product/product-detail-tabs"
import { ProductCard } from "@/components/ui/product-card"
import { QuoteForm } from "./quote-form"

export const revalidate = 3600

interface PageProps {
    params: Promise<{ patternSlug: string; productSlug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { productSlug } = await params
    const product = await getProductBySlug(productSlug)
    if (!product) return {}

    const title = product.seo_title || product.name
    const description = product.seo_description
        || (product.description ? product.description.slice(0, 160) : null)
        || `${product.name} — gạch ốp lát cao cấp chính hãng tại Đông Phú Gia Đà Lạt.`

    const images = product.image_main_url
        ? [{ url: product.image_main_url, width: 800, height: 800, alt: product.name }]
        : []

    return {
        title,
        description,
        openGraph: {
            title: `${title} | Đông Phú Gia`,
            description,
            url: `/gach-op-lat/${product.pattern_types?.slug}/${product.slug}`,
            images,
            type: "website",
        },
        twitter: {
            card: "summary_large_image",
            title: `${title} | Đông Phú Gia`,
            description,
            images: images.map((i) => i.url),
        },
    }
}

export default async function ProductDetailPage({ params }: PageProps) {
    const { patternSlug, productSlug } = await params
    const product = await getProductBySlug(productSlug)

    if (!product) notFound()

    const relatedProducts = await getRelatedProducts(
        product.pattern_type_id,
        product.id,
        4
    )

    const relatedSKUs = product.collection_id ? await getRelatedProductsInCollection(product.collection_id, product.id) : []

    // Parse specific variants based on the data model
    const colorVariants = product.product_colors?.map(pc => pc.colors) || []

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dongphugia.vn"
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: product.description || undefined,
        sku: product.sku,
        image: product.image_main_url || undefined,
        url: `${siteUrl}/gach-op-lat/${patternSlug}/${product.slug}`,
        brand: { "@type": "Brand", name: "Đông Phú Gia" },
        offers: {
            "@type": "Offer",
            priceCurrency: "VND",
            price: product.price_display || "Liên hệ báo giá",
            itemCondition: "https://schema.org/NewCondition",
            availability: "https://schema.org/InStock",
            seller: { "@type": "Organization", name: "Đông Phú Gia", url: siteUrl },
        },
        ...(product.sizes ? { additionalProperty: { "@type": "PropertyValue", name: "Kích thước", value: product.sizes.label } } : {}),
        ...(product.origins ? { countryOfOrigin: { "@type": "Country", name: product.origins.name } } : {}),
    }

    return (
        <div className="bg-white min-h-screen relative">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            {/* Top Light Green Gradient Background */}
            <div className="absolute top-0 left-0 right-0 h-[800px] bg-gradient-to-b from-[#dcfce7] to-white pointer-events-none z-0" />

            <div className="relative z-10 max-w-[1280px] mx-auto px-5 pt-8 pb-20">
                {/* Breadcrumb */}
                <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[14px] mb-8 lg:mb-12 flex-wrap">
                    <Link href="/" className="text-[#4b5563] hover:text-[#15803d] transition-colors font-medium">
                        Trang chủ
                    </Link>
                    <ChevronRight className="h-4 w-4 text-[#9ca3af]" strokeWidth={1.5} aria-hidden="true" />
                    <Link href="/gach-op-lat" className="text-[#4b5563] hover:text-[#15803d] transition-colors font-medium">
                        Gạch ốp lát
                    </Link>
                    <ChevronRight className="h-4 w-4 text-[#9ca3af]" strokeWidth={1.5} aria-hidden="true" />
                    {product.pattern_types && (
                        <>
                            <Link href={`/gach-op-lat/${patternSlug}`} className="text-[#4b5563] hover:text-[#15803d] transition-colors font-medium">
                                {product.pattern_types.name}
                            </Link>
                            <ChevronRight className="h-4 w-4 text-[#9ca3af]" strokeWidth={1.5} aria-hidden="true" />
                        </>
                    )}
                    <span className="text-[#15803d] font-semibold truncate max-w-[200px]" aria-current="page">{product.name}</span>
                </nav>

                {/* Main Product Section */}
                <div className="flex flex-col lg:flex-row gap-10 xl:gap-[70px] mb-16 lg:mb-24">
                    {/* Left: Gallery */}
                    <div className="lg:w-[55%]">
                        <ProductImageGallery
                            mainImageUrl={product.image_main_url}
                            hoverImageUrl={product.image_hover_url}
                            additionalImages={product.product_images}
                            productName={product.name}
                        />
                    </div>

                    {/* Right: Info & CTA */}
                    <div className="lg:flex-1 flex flex-col gap-5 2xl:gap-6 w-full lg:sticky lg:top-24 h-fit pb-10">
                        {/* Title */}
                        <h1 className="text-[32px] font-semibold text-[#111827] leading-[40px] tracking-[-0.64px]">
                            {product.name}
                        </h1>

                        {/* Price Box */}
                        <div className="border border-[#16a34a] rounded-[20px] px-5 py-4 flex flex-col gap-1 w-full"
                            style={{ backgroundImage: "linear-gradient(173deg, #fcfdee 0%, #bbf7d0 100%)" }}>
                            <p className="text-[#16a34a] text-[18px] leading-[28px] font-semibold">Giá sản phẩm</p>
                            <p className="text-[#15803d] text-[28px] leading-[36px] tracking-[-0.56px] font-semibold">
                                {product.price_display || 'Liên hệ báo giá'}
                            </p>
                        </div>

                        {/* SKU/Variants Box */}
                        <div className="flex flex-col gap-3">
                            <p className="font-semibold text-[20px] 2xl:text-[24px] text-[#1f2937] leading-[28px] 2xl:leading-[32px] tracking-[-0.48px]">
                                Mã sản phẩm:
                            </p>
                            <div className="flex gap-3 2xl:gap-4 items-center flex-wrap">
                                {/* Active SKU */}
                                <div className="bg-[#f0fdf4] border border-[#16a34a] rounded-[8px] px-3 py-2 cursor-default">
                                    <span className="font-medium text-[16px] leading-[18px] text-[#16a34a]" aria-current="true">
                                        {product.sku}
                                    </span>
                                </div>
                                {/* Related SKUs */}
                                {relatedSKUs.map(related => (
                                    <Link
                                        key={related.id}
                                        href={`/gach-op-lat/${patternSlug}/${related.slug}`}
                                        className="bg-white border border-[#e5e7eb] rounded-[8px] px-3 py-2 hover:border-[#16a34a] transition-colors"
                                        aria-label={`Xem sản phẩm mã ${related.sku}`}
                                    >
                                        <span className="font-medium text-[16px] leading-[18px] text-[#6b7280]">
                                            {related.sku}
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {/* Color Variants */}
                        {colorVariants.length > 0 && (
                            <div className="flex flex-col gap-3">
                                <p className="font-semibold text-[20px] 2xl:text-[24px] text-[#1f2937] leading-[28px] 2xl:leading-[32px] tracking-[-0.48px]">
                                    Màu sắc:
                                </p>
                                <div className="flex gap-5 items-center flex-wrap">
                                    {colorVariants.map(color => (
                                        <div key={color.id} className="flex flex-col gap-2 items-center">
                                            <div
                                                className="w-10 h-10 rounded-full border border-gray-200 shadow-sm"
                                                style={{ backgroundColor: color.hex_code || '#ccc' }}
                                                title={color.name}
                                            />
                                            <span className="font-medium text-[16px] leading-[24px] text-[#374151]">
                                                {color.name}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Specs Table */}
                        <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-[12px] px-4 py-3 flex flex-col gap-2 w-full">
                            {product.collections && (
                                <div className="flex items-center justify-between py-1">
                                    <span className="font-medium text-[16px] leading-[24px] text-[#111827]">Bộ sưu tập</span>
                                    <span className="font-normal text-[16px] leading-[24px] text-[#374151] text-right uppercase">
                                        {product.collections.name}
                                    </span>
                                </div>
                            )}
                            {/* Assuming "Số vân" isn't a direct DB field but we might have it in description or we hardcode based on product. We skip if not available */}
                            {product.sizes && (
                                <div className="flex items-center justify-between py-1">
                                    <span className="font-medium text-[16px] leading-[24px] text-[#111827]">Quy cách</span>
                                    <span className="font-normal text-[16px] leading-[24px] text-[#374151] text-right">
                                        {product.sizes.label}
                                    </span>
                                </div>
                            )}
                            {product.surfaces && (
                                <div className="flex items-center justify-between py-1">
                                    <span className="font-medium text-[16px] leading-[24px] text-[#111827]">Bề mặt</span>
                                    <span className="font-normal text-[16px] leading-[24px] text-[#374151] text-right">
                                        {product.surfaces.name}
                                    </span>
                                </div>
                            )}
                            {product.origins && (
                                <div className="flex items-center justify-between py-1">
                                    <span className="font-medium text-[16px] leading-[24px] text-[#111827]">Xuất xứ</span>
                                    <span className="font-normal text-[16px] leading-[24px] text-[#374151] text-right">
                                        {product.origins.name}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* CTA Buttons */}
                        <div className="flex flex-col gap-3 mt-1">
                            <Link
                                href="#quote"
                                className="bg-[#15803d] border border-[#15803d] shadow-[0_2px_6px_rgba(16,24,40,0.06)] rounded-[12px] h-[46px] w-full flex items-center justify-center gap-2 text-white font-medium text-[16px] transition-all hover:bg-[#166534] hover:shadow-md"
                            >
                                <Phone className="w-5 h-5" />
                                <span>Liên hệ tư vấn ngay</span>
                            </Link>

                            <div id="quote" className="pt-1">
                                <QuoteForm productId={product.id} productName={product.name} />
                            </div>
                        </div>

                    </div>
                </div>

                {/* Info & Desc Tabs */}
                <ProductDetailTabs
                    description={product.description}
                    locations={product.product_locations}
                />

                {/* Related Products */}
                {relatedProducts.length > 0 && (
                    <div className="mt-20">
                        <h2 className="text-[28px] sm:text-[32px] font-semibold text-[#111827] tracking-[-0.64px] mb-8">
                            Sản phẩm liên quan
                        </h2>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                            {relatedProducts.map((p) => (
                                <ProductCard key={p.id} product={p} patternSlug={patternSlug} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
