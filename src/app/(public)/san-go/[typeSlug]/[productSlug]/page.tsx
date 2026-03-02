import { Metadata } from "next"
import Link from "next/link"
import { ChevronRight, Phone } from "lucide-react"
import { notFound } from "next/navigation"
import { getSangoProductBySlug, getRelatedSangoProducts } from "@/lib/public-api-sango"
import { ProductImageGallery } from "@/components/product/product-image-gallery"
import { ProductDetailTabsSango } from "@/components/product/product-detail-tabs-sango"
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
        <div className="bg-white min-h-screen pb-16">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            {/* Breadcrumbs */}
            <div className="border-b border-gray-100 bg-[#fafafa]">
                <div className="max-w-[1280px] mx-auto px-5 py-3 flex items-center gap-2 text-[14px] text-gray-500 overflow-x-auto whitespace-nowrap scrollbar-hide">
                    <Link href="/" className="hover:text-[#d97706]">Trang chủ</Link>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                    <Link href="/san-go" className="hover:text-[#d97706]">Sàn gỗ & Sàn nhựa</Link>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                    <Link href={`/san-go?type=${product.sango_product_types?.slug || typeSlug}`} className="hover:text-[#d97706]">
                        {product.sango_product_types?.name}
                    </Link>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="text-gray-900 font-medium truncate max-w-[200px] sm:max-w-none">{product.name}</span>
                </div>
            </div>

            <div className="max-w-[1280px] mx-auto px-5 pt-8 lg:pt-12">
                <div className="flex flex-col lg:flex-row gap-10 xl:gap-16">
                    {/* Left: Gallery */}
                    <div className="lg:w-[500px] xl:w-[600px] shrink-0">
                        <ProductImageGallery
                            mainImageUrl={product.image_main_url}
                            hoverImageUrl={product.image_hover_url}
                            additionalImages={product.sango_product_images as any[]}
                            productName={product.name}
                        />
                    </div>

                    {/* Right: Info */}
                    <div className="flex-1 flex flex-col">
                        <div className="mb-6">
                            {product.is_new && (
                                <span className="inline-block px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-semibold uppercase tracking-wide rounded-md mb-3">
                                    Mới
                                </span>
                            )}
                            {product.is_featured && (
                                <span className="inline-block px-2.5 py-1 bg-red-100 text-red-700 text-xs font-semibold uppercase tracking-wide rounded-md mb-3 ml-2">
                                    Nổi bật
                                </span>
                            )}
                            <h1 className="text-[28px] lg:text-[32px] font-bold text-gray-900 leading-[1.2] mb-3">
                                {product.name}
                            </h1>
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                                <span>Mã SP: <strong className="text-gray-900">{product.sku}</strong></span>
                            </div>
                        </div>

                        {/* Summary Props Sango Specific */}
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-4 p-5 bg-[#fffbeb] rounded-xl border border-[#fde68a] mb-6 text-[15px]">
                            {product.thickness_mm && (
                                <div className="flex flex-col">
                                    <span className="text-gray-500 text-[13px] mb-0.5">Độ dày</span>
                                    <span className="font-semibold text-[#d97706]">{product.thickness_mm} mm</span>
                                </div>
                            )}
                            {product.ac_rating && (
                                <div className="flex flex-col">
                                    <span className="text-gray-500 text-[13px] mb-0.5">Chống trầy xước</span>
                                    <span className="font-semibold text-gray-900">{product.ac_rating}</span>
                                </div>
                            )}
                            {product.origins && (
                                <div className="flex flex-col">
                                    <span className="text-gray-500 text-[13px] mb-0.5">Xuất xứ</span>
                                    <span className="font-semibold text-gray-900">{product.origins.name}</span>
                                </div>
                            )}
                            {(product.width_mm || product.length_mm) && (
                                <div className="flex flex-col lg:col-span-1">
                                    <span className="text-gray-500 text-[13px] mb-0.5">Kích thước (R x D)</span>
                                    <span className="font-semibold text-gray-900">
                                        {product.width_mm || '?'} x {product.length_mm || '?'} mm
                                    </span>
                                </div>
                            )}
                            {product.colors && (
                                <div className="flex flex-col lg:col-span-1">
                                    <span className="text-gray-500 text-[13px] mb-0.5">Màu sắc</span>
                                    <span className="font-semibold text-gray-900">{product.colors.name}</span>
                                </div>
                            )}
                            {product.warranty_years && (
                                <div className="flex flex-col lg:col-span-1">
                                    <span className="text-gray-500 text-[13px] mb-0.5">Bảo hành</span>
                                    <span className="font-semibold text-gray-900">{product.warranty_years} năm</span>
                                </div>
                            )}
                        </div>

                        {/* Price & Contact Box */}
                        <div className="p-5 lg:p-6 border border-[#fef3c7] rounded-2xl bg-gradient-to-br from-white to-[#fffbeb] shadow-sm mb-6">
                            <div className="flex items-baseline gap-3 mb-4">
                                <span className="text-[28px] font-bold text-[#b45309]">
                                    {product.price_display}
                                </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                                <a
                                    href="tel:0913963283"
                                    className="flex items-center justify-center gap-2 h-12 bg-[#d97706] text-white rounded-xl font-medium hover:bg-[#b45309] transition-colors shadow-sm"
                                >
                                    <Phone className="w-5 h-5" />
                                    <span>Gọi 0913 963 283</span>
                                </a>
                                <a
                                    href="https://zalo.me/0913963283"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 h-12 bg-[#0068ff] text-white rounded-xl font-medium hover:bg-[#0054cc] transition-colors shadow-sm"
                                >
                                    <span>Chat Zalo ngay</span>
                                </a>
                            </div>
                            <p className="text-[13px] text-gray-500 text-center">
                                Vui lòng liên hệ để kiểm tra tồn kho và nhận báo giá ưu đãi
                            </p>
                        </div>

                        {/* Interactive Quote Form */}
                        <QuoteForm productId={product.id} productName={product.name} />
                    </div>
                </div>

                {/* Lower Section: Tabs & Related */}
                <div className="mt-16 lg:mt-20 flex flex-col lg:flex-row gap-10 xl:gap-16">
                    <div className="flex-1 min-w-0">
                        <ProductDetailTabsSango
                            description={product.description}
                            features={product.features}
                            specifications={product.specifications}
                            thickness_mm={product.thickness_mm}
                            width_mm={product.width_mm}
                            length_mm={product.length_mm}
                            ac_rating={product.ac_rating}
                            warranty_years={product.warranty_years}
                        />
                    </div>

                    <div className="lg:w-[320px] shrink-0">
                        {relatedProducts.length > 0 && (
                            <div>
                                <h3 className="text-[20px] font-bold text-gray-900 mb-6 border-b-2 border-[#d97706] inline-block pb-1">Cùng loại</h3>
                                <div className="flex flex-col gap-6">
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
            </div>
        </div>
    )
}
