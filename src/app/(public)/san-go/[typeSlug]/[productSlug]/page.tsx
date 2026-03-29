import { Metadata } from "next"
import Link from "next/link"
import { ChevronRight, Phone } from "lucide-react"
import { notFound } from "next/navigation"
import { getSangoProductBySlug, getRelatedSangoProducts } from "@/lib/public-api-sango"
import { ProductImageGallery } from "@/components/product/product-image-gallery"
import { ProductDetailTabs } from "@/components/product/product-detail-tabs"
import { ProductCard } from "@/components/ui/product-card"
import { QuoteForm } from "@/app/(public)/thiet-bi-bep/[typeSlug]/[productSlug]/quote-form" // Reuse QuoteForm

export const revalidate = 3600

interface PageProps {
    params: Promise<{ typeSlug: string; productSlug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { productSlug } = await params
    const product = await getSangoProductBySlug(productSlug)
    if (!product) return {}

    const title = product.seo_title || product.name
    const description = product.seo_description
        || (product.description ? product.description.slice(0, 160) : null)
        || `${product.name} — sàn gỗ công nghiệp, sàn nhựa cao cấp chính hãng tại Đông Phú Gia Đà Lạt.`

    const images = product.image_main_url
        ? [{ url: product.image_main_url, width: 800, height: 800, alt: product.name }]
        : []

    return {
        title,
        description,
        openGraph: {
            title: `${title} | Đông Phú Gia`,
            description,
            url: `/san-go/${product.sango_product_types?.slug}/${product.slug}`,
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

export default async function SangoProductDetailPage({ params }: PageProps) {
    const { typeSlug, productSlug } = await params
    const product = await getSangoProductBySlug(productSlug)

    if (!product) notFound()

    const relatedProducts = await getRelatedSangoProducts(
        product.product_type_id,
        product.id,
        4
    )

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dongphugia.vn"
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: product.description || undefined,
        sku: product.sku,
        image: product.image_main_url || undefined,
        url: `${siteUrl}/san-go/${typeSlug}/${product.slug}`,
        brand: { "@type": "Brand", name: "Đông Phú Gia" },
        offers: {
            "@type": "Offer",
            url: `${siteUrl}/san-go/${typeSlug}/${product.slug}`,
            priceCurrency: "VND",
            price: product.price ? Number(product.price) : 0,
            availability: "https://schema.org/InStock",
            itemCondition: "https://schema.org/NewCondition"
        }
    }

    return (
        <div className="bg-white min-h-screen relative">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            {/* Clean white background - no gradient */}

            <div className="relative z-10 max-w-[1280px] mx-auto px-5 pt-8 pb-20">
                {/* Inline Breadcrumb */}
                <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[14px] mb-8 lg:mb-12 flex-wrap">
                    <Link href="/" className="text-neutral-500 hover:text-blue-600 transition-colors font-medium">Trang chủ</Link>
                    <ChevronRight className="h-4 w-4 text-neutral-400" strokeWidth={1.5} aria-hidden="true" />
                    <Link href="/san-go" className="text-neutral-500 hover:text-blue-600 transition-colors font-medium">Sàn gỗ & Sàn nhựa</Link>
                    <ChevronRight className="h-4 w-4 text-neutral-400" strokeWidth={1.5} aria-hidden="true" />
                    {product.sango_product_types && (
                        <>
                            <Link href={`/san-go?type=${product.sango_product_types.slug || typeSlug}`} className="text-neutral-500 hover:text-blue-600 transition-colors font-medium">
                                {product.sango_product_types.name}
                            </Link>
                            <ChevronRight className="h-4 w-4 text-neutral-400" strokeWidth={1.5} aria-hidden="true" />
                        </>
                    )}
                    <span className="text-blue-600 font-semibold truncate max-w-[200px]" aria-current="page">{product.name}</span>
                </nav>
                {/* Main Product Section */}
                <div className="flex flex-col lg:flex-row gap-10 xl:gap-[70px] mb-16 lg:mb-24">
                    {/* Left: Gallery */}
                    <div className="lg:w-[55%]">
                        <ProductImageGallery
                            mainImageUrl={product.image_main_url}
                            hoverImageUrl={product.image_hover_url}
                            additionalImages={product.sango_product_images as any[]}
                            productName={product.name}
                        />
                    </div>

                    {/* Right: Info & CTA */}
                    <div className="lg:flex-1 flex flex-col gap-5 2xl:gap-6 w-full lg:sticky lg:top-24 h-fit pb-10">
                        {/* Title & Badges */}
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                {product.is_new && (
                                    <span className="inline-flex items-center px-2.5 py-1 bg-blue-50 text-blue-600 text-xs font-semibold uppercase tracking-wide rounded-full backdrop-blur-sm">
                                        Mới
                                    </span>
                                )}
                                {product.is_featured && (
                                    <span className="inline-flex items-center px-2.5 py-1 bg-sand-50 text-sand-700 text-xs font-semibold uppercase tracking-wide rounded-full backdrop-blur-sm">
                                        Nổi bật
                                    </span>
                                )}
                            </div>
                            <h1 className="text-[32px] font-semibold text-neutral-900 leading-[40px] tracking-[-0.64px]">
                                {product.name}
                            </h1>
                        </div>

                        {/* Price Box */}
                        <div className="border border-blue-600 rounded-[20px] px-5 py-4 flex flex-col gap-1 w-full"
                            style={{ backgroundImage: "linear-gradient(173deg, #fcfdee 0%, var(--color-blue-100) 100%)" }}>
                            <p className="text-blue-600 text-[18px] leading-[28px] font-semibold">Giá sản phẩm</p>
                            <p className="text-blue-600 text-[28px] leading-[36px] tracking-[-0.56px] font-semibold">
                                {product.price_display || 'Liên hệ báo giá'}
                            </p>
                        </div>

                        {/* SKU Box */}
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-4 text-sm">
                                <div className="bg-blue-50 border border-blue-600 rounded-lg px-3 py-2">
                                    <span className="font-medium text-[16px] text-blue-600">Mã SP: {product.sku}</span>
                                </div>
                            </div>
                        </div>

                        {/* Specs Table */}
                        <div className="bg-blue-50 border border-blue-100 rounded-[var(--radius)] px-4 py-3 flex flex-col gap-2 w-full">
                            {product.thickness_mm && (
                                <div className="flex items-center justify-between py-1">
                                    <span className="font-medium text-[16px] leading-[24px] text-neutral-900">Độ dày</span>
                                    <span className="font-semibold text-[16px] leading-[24px] text-blue-600 text-right">{product.thickness_mm} mm</span>
                                </div>
                            )}
                            {product.ac_rating && (
                                <div className="flex items-center justify-between py-1">
                                    <span className="font-medium text-[16px] leading-[24px] text-neutral-900">Chống trầy xước</span>
                                    <span className="font-normal text-[16px] leading-[24px] text-neutral-600 text-right">{product.ac_rating}</span>
                                </div>
                            )}
                            {product.origins && (
                                <div className="flex items-center justify-between py-1">
                                    <span className="font-medium text-[16px] leading-[24px] text-neutral-900">Xuất xứ</span>
                                    <span className="font-normal text-[16px] leading-[24px] text-neutral-600 text-right">{product.origins.name}</span>
                                </div>
                            )}
                            {(product.width_mm || product.length_mm) && (
                                <div className="flex items-center justify-between py-1">
                                    <span className="font-medium text-[16px] leading-[24px] text-neutral-900">Kích thước (R x D)</span>
                                    <span className="font-normal text-[16px] leading-[24px] text-neutral-600 text-right">{product.width_mm || '?'} x {product.length_mm || '?'} mm</span>
                                </div>
                            )}
                            {product.colors && (
                                <div className="flex items-center justify-between py-1">
                                    <span className="font-medium text-[16px] leading-[24px] text-neutral-900">Màu sắc</span>
                                    <span className="font-normal text-[16px] leading-[24px] text-neutral-600 text-right">{product.colors.name}</span>
                                </div>
                            )}
                            {product.warranty_years && (
                                <div className="flex items-center justify-between py-1">
                                    <span className="font-medium text-[16px] leading-[24px] text-neutral-900">Bảo hành</span>
                                    <span className="font-normal text-[16px] leading-[24px] text-neutral-600 text-right">{product.warranty_years} năm</span>
                                </div>
                            )}
                        </div>

                        {/* CTA Buttons */}
                        <div className="flex flex-col gap-3 mt-1">
                            <a
                                href="tel:0913963283"
                                className="bg-blue-600 border border-blue-600 shadow-sm rounded-[var(--radius)] h-[46px] w-full flex items-center justify-center gap-2 text-white font-medium text-[16px] transition-all hover:bg-blue-700 hover:shadow-md"
                            >
                                <Phone className="w-5 h-5" />
                                <span>Gọi 0913 963 283</span>
                            </a>
                            <a
                                href="https://zalo.me/0913963283"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-[#0068ff] border border-[#0068ff] shadow-sm rounded-[var(--radius)] h-[46px] w-full flex items-center justify-center gap-2 text-white font-medium text-[16px] transition-all hover:bg-[#0054cc] hover:shadow-md"
                            >
                                <span>Chat Zalo ngay</span>
                            </a>
                        </div>

                        {/* Interactive Quote Form */}
                        <div id="quote" className="pt-1">
                            <QuoteForm productId={product.id} productName={product.name} />
                        </div>
                    </div>
                </div>

                {/* Detail Tabs */}
                <ProductDetailTabs
                    description={product.description}
                    features={product.features}
                    specifications={product.specifications}
                    extraSpecs={[
                        ...(product.thickness_mm ? [{ key: 'Độ dày', value: `${product.thickness_mm} mm` }] : []),
                        ...(product.width_mm || product.length_mm ? [{ key: 'Kích thước (R x D)', value: `${product.width_mm || '?'} x ${product.length_mm || '?'} mm` }] : []),
                        ...(product.ac_rating ? [{ key: 'Chống trầy xước', value: product.ac_rating }] : []),
                        ...(product.warranty_years ? [{ key: 'Bảo hành', value: `${product.warranty_years} năm` }] : []),
                    ]}
                />

                {/* Related Products */}
                {relatedProducts.length > 0 && (
                    <div className="mt-20">
                        <h2 className="text-[28px] sm:text-[32px] font-semibold text-neutral-900 tracking-[-0.64px] mb-8">
                            Sản phẩm liên quan
                        </h2>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                            {relatedProducts.map((rp: any) => (
                                <ProductCard
                                    key={rp.id}
                                    product={rp}
                                    basePath="/san-go"
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
