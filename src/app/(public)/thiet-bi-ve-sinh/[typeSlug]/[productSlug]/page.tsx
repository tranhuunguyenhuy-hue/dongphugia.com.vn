import { Metadata } from "next"
import Link from "next/link"
import { ChevronRight, Phone } from "lucide-react"
import { notFound } from "next/navigation"
import { getTBVSProductBySlug, getRelatedTBVSProducts } from "@/lib/public-api-tbvs"
import { ProductImageGallery } from "@/components/product/product-image-gallery"
import { ProductDetailTabsTBVS } from "@/components/product/product-detail-tabs-tbvs"
import { ProductCard } from "@/components/ui/product-card"
import { QuoteForm } from "./quote-form"

export const revalidate = 3600

interface PageProps {
    params: Promise<{ typeSlug: string; productSlug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { productSlug } = await params
    const product = await getTBVSProductBySlug(productSlug)
    if (!product) return {}

    const title = product.seo_title || product.name
    const description = product.seo_description
        || (product.description ? product.description.slice(0, 160) : null)
        || `${product.name} — thiết bị vệ sinh cao cấp chính hãng tại Đông Phú Gia Đà Lạt.`

    const images = product.image_main_url
        ? [{ url: product.image_main_url, width: 800, height: 800, alt: product.name }]
        : []

    return {
        title,
        description,
        openGraph: {
            title: `${title} | Đông Phú Gia`,
            description,
            url: `/thiet-bi-ve-sinh/${product.tbvs_product_types?.slug}/${product.slug}`,
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
    const { typeSlug, productSlug } = await params
    const product = await getTBVSProductBySlug(productSlug)

    if (!product) notFound()

    const relatedProducts = await getRelatedTBVSProducts(
        product.product_type_id,
        product.id,
        4
    )

    const technologies = product.tbvs_product_technologies?.map((pt: any) => pt.tbvs_technologies) || []

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dongphugia.vn"
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: product.description || undefined,
        sku: product.sku,
        image: product.image_main_url || undefined,
        url: `${siteUrl}/thiet-bi-ve-sinh/${typeSlug}/${product.slug}`,
        brand: { "@type": "Brand", name: product.tbvs_brands?.name || "Đông Phú Gia" },
        offers: {
            "@type": "Offer",
            url: `${siteUrl}/thiet-bi-ve-sinh/${typeSlug}/${product.slug}`,
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
                    <Link href="/" className="hover:text-[#15803d]">Trang chủ</Link>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                    <Link href="/thiet-bi-ve-sinh" className="hover:text-[#15803d]">Thiết bị vệ sinh</Link>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                    <Link href={`/thiet-bi-ve-sinh?type=${product.tbvs_product_types?.slug || typeSlug}`} className="hover:text-[#15803d]">
                        {product.tbvs_product_types?.name}
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
                            additionalImages={product.tbvs_product_images as any[]}
                            productName={product.name}
                        />
                    </div>

                    {/* Right: Info */}
                    <div className="flex-1 flex flex-col">
                        <div className="mb-6">
                            {product.is_new && (
                                <span className="inline-block px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-semibold uppercase tracking-wide rounded-md mb-3">
                                    Mới
                                </span>
                            )}
                            {product.is_bestseller && (
                                <span className="inline-block px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-semibold uppercase tracking-wide rounded-md mb-3 ml-2">
                                    Bán chạy
                                </span>
                            )}
                            <h1 className="text-[28px] lg:text-[32px] font-bold text-gray-900 leading-[1.2] mb-3">
                                {product.name}
                            </h1>
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                                <span>Mã SP: <strong className="text-gray-900">{product.sku}</strong></span>
                                {product.tbvs_brands && (
                                    <>
                                        <span className="w-1 h-1 rounded-full bg-gray-300" />
                                        <span>Thương hiệu: <strong className="text-gray-900">{product.tbvs_brands.name}</strong></span>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Summary Props */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3 p-5 bg-[#f8fafc] rounded-xl mb-6 text-[15px]">
                            {product.tbvs_materials && (
                                <div className="flex flex-col">
                                    <span className="text-gray-500 text-[13px] mb-0.5">Chất liệu</span>
                                    <span className="font-medium text-gray-900">{product.tbvs_materials.name}</span>
                                </div>
                            )}
                            {product.tbvs_subtypes && (
                                <div className="flex flex-col">
                                    <span className="text-gray-500 text-[13px] mb-0.5">Kiểu dáng</span>
                                    <span className="font-medium text-gray-900">{product.tbvs_subtypes.name}</span>
                                </div>
                            )}
                            {product.origins && (
                                <div className="flex flex-col">
                                    <span className="text-gray-500 text-[13px] mb-0.5">Xuất xứ</span>
                                    <span className="font-medium text-gray-900">{product.origins.name}</span>
                                </div>
                            )}
                            {product.warranty_months && (
                                <div className="flex flex-col">
                                    <span className="text-gray-500 text-[13px] mb-0.5">Bảo hành</span>
                                    <span className="font-medium text-gray-900">{product.warranty_months} tháng</span>
                                </div>
                            )}
                        </div>

                        {/* Price & Contact Box */}
                        <div className="p-5 lg:p-6 border border-gray-200 rounded-2xl bg-white shadow-sm mb-6">
                            <div className="flex items-baseline gap-3 mb-4">
                                <span className="text-[28px] font-bold text-[#111827]">
                                    {product.price_display}
                                </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                                <a
                                    href="tel:0913963283"
                                    className="flex items-center justify-center gap-2 h-12 bg-[#15803d] text-white rounded-xl font-medium hover:bg-[#166534] transition-colors"
                                >
                                    <Phone className="w-5 h-5" />
                                    <span>Gọi 0913 963 283</span>
                                </a>
                                <a
                                    href="https://zalo.me/0913963283"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 h-12 bg-[#0068ff] text-white rounded-xl font-medium hover:bg-[#0054cc] transition-colors"
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
                        <ProductDetailTabsTBVS
                            description={product.description}
                            features={product.features}
                            specifications={product.specifications}
                            technologies={technologies}
                        />
                    </div>

                    <div className="lg:w-[320px] shrink-0">
                        {relatedProducts.length > 0 && (
                            <div>
                                <h3 className="text-[20px] font-bold text-gray-900 mb-6">SP cùng loại</h3>
                                <div className="flex flex-col gap-6">
                                    {relatedProducts.map((rp: any) => (
                                        <ProductCard
                                            key={rp.id}
                                            product={rp}
                                            basePath="/thiet-bi-ve-sinh"
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
