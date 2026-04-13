import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { getPublicProductBySlug } from "@/lib/public-api-products"
import { ProductImageGallery } from "@/components/product/product-image-gallery"
import { ProductDetailTabs } from "@/components/product/product-detail-tabs"

export const revalidate = 1800

interface PageProps {
    params: Promise<{ sub: string; slug: string }>
}

const CATEGORY_SLUG = "thiet-bi-ve-sinh"
const CATEGORY_NAME = "Thiết Bị Vệ Sinh"
const BASE_PATH = "/thiet-bi-ve-sinh"

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug } = await params
    const product = await getPublicProductBySlug(CATEGORY_SLUG, slug)
    if (!product) return { title: "Sản phẩm không tìm thấy" }
    return {
        title: `${product.name} | ${CATEGORY_NAME} | Đông Phú Gia`,
        description: product.description?.slice(0, 160) || `${product.name} - Chính hãng tại Đông Phú Gia Đà Lạt.`,
    }
}

export default async function ThietBiVeSinhDetailPage({ params }: PageProps) {
    const { sub, slug } = await params
    const product = await getPublicProductBySlug(CATEGORY_SLUG, slug)
    if (!product) notFound()

    const additionalImages = product.product_images?.filter(i => i.image_url !== product.image_main_url) ?? []
    const features = product.product_feature_values ?? []

    return (
        <main className="max-w-[1280px] mx-auto px-5 py-8 lg:py-12">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-neutral-500 mb-8" aria-label="Breadcrumb">
                <Link href="/" className="hover:text-neutral-800 transition-colors">Trang chủ</Link>
                <span>/</span>
                <Link href={BASE_PATH} className="hover:text-neutral-800 transition-colors">{CATEGORY_NAME}</Link>
                {product.subcategories && (
                    <>
                        <span>/</span>
                        <Link href={`${BASE_PATH}?sub=${sub}`} className="hover:text-neutral-800 transition-colors">
                            {product.subcategories.name}
                        </Link>
                    </>
                )}
                <span>/</span>
                <span className="text-neutral-800 font-medium truncate max-w-[200px]">{product.name}</span>
            </nav>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                {/* Gallery */}
                <ProductImageGallery
                    mainImageUrl={product.image_main_url}
                    hoverImageUrl={product.image_hover_url}
                    additionalImages={additionalImages.map(i => ({ image_url: i.image_url, alt_text: i.alt_text }))}
                    productName={product.name}
                />

                {/* Info */}
                <div className="flex flex-col gap-5">
                    {/* Badges */}
                    <div className="flex gap-2 flex-wrap">
                        {product.is_new && (
                            <span className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider bg-blue-50 text-blue-600 rounded-full border border-blue-100">
                                Sản phẩm mới
                            </span>
                        )}
                        {product.is_bestseller && (
                            <span className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider bg-neutral-100 text-neutral-700 rounded-full border border-neutral-200">
                                Bán chạy
                            </span>
                        )}
                        {product.brands && (
                            <span className="px-2.5 py-1 text-xs font-semibold text-neutral-600 bg-neutral-50 rounded-full border border-neutral-200">
                                {product.brands.name}
                            </span>
                        )}
                    </div>

                    <div>
                        <p className="text-sm text-neutral-500 mb-1">Mã SP: {product.sku}</p>
                        <h1 className="text-2xl lg:text-3xl font-bold text-[#192125] leading-tight">
                            {product.name}
                        </h1>
                    </div>

                    {/* Price */}
                    <div className="py-4 border-y border-neutral-100">
                        <p className="text-xs text-neutral-400 uppercase tracking-wider mb-1">Giá tham khảo</p>
                        <p className="text-2xl font-bold text-[#192125]">
                            {product.price_display || "Liên hệ báo giá"}
                        </p>
                    </div>

                    {/* Features highlights */}
                    {features.length > 0 && (
                        <div className="grid grid-cols-2 gap-3">
                            {features.slice(0, 4).map(f => (
                                <div key={f.id} className="flex items-start gap-2 p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#2E7A96] mt-1.5 shrink-0" />
                                    <div>
                                        <p className="text-xs text-neutral-500">{f.product_features?.name}</p>
                                        <p className="text-sm font-medium text-neutral-800">{f.value}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* CTA */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <a
                            href="tel:02633520316"
                            className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#192125] text-white font-semibold text-sm hover:bg-[#2E7A96] transition-colors duration-200"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                            </svg>
                            Gọi tư vấn ngay
                        </a>
                        <a
                            href="https://zalo.me/0263352316"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border-2 border-[#192125] text-[#192125] font-semibold text-sm hover:bg-neutral-50 transition-colors duration-200"
                        >
                            Yêu cầu báo giá
                        </a>
                    </div>
                </div>
            </div>

            {/* Detail Tabs */}
            <div className="mt-12">
                <ProductDetailTabs
                    description={product.description}
                    features={product.features}
                    specifications={null}
                />
            </div>
        </main>
    )
}
