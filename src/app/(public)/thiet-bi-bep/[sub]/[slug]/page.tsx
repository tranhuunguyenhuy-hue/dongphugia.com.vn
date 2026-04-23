import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { getPublicProductBySlug, getPublicProducts } from "@/lib/public-api-products"
import { ProductImageGallery } from "@/components/product/product-image-gallery"
import { ProductDetailTabs } from "@/components/product/product-detail-tabs"
import { ProductCTA } from "@/components/product/product-cta"
import { ProductCard } from "@/components/ui/product-card"
import { BrandBadge } from "@/components/ui/brand-badge"

export const revalidate = 1800

interface PageProps {
    params: Promise<{ sub: string; slug: string }>
}

const CATEGORY_SLUG = "thiet-bi-bep"
const CATEGORY_NAME = "Thiết Bị Bếp"
const BASE_PATH = "/thiet-bi-bep"

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug } = await params
    const product = await getPublicProductBySlug(CATEGORY_SLUG, slug)
    if (!product) return { title: "Sản phẩm không tìm thấy" }
    return {
        title: `${product.name} | ${CATEGORY_NAME} | Đông Phú Gia`,
        description: product.description?.slice(0, 160) || `${product.name} - Chính hãng tại Đông Phú Gia Đà Lạt.`,
    }
}

export default async function ProductDetailPage({ params }: PageProps) {
    const { sub, slug } = await params
    const product = await getPublicProductBySlug(CATEGORY_SLUG, slug)
    if (!product) notFound()

    const additionalImages = product.product_images?.filter(i => i.image_url !== product.image_main_url) ?? []
    const features = product.product_feature_values ?? []

    // Fetch related products
    const { products: relatedItems } = await getPublicProducts({
        category_slug: CATEGORY_SLUG,
        subcategory_slug: product.subcategories?.slug || undefined,
        page: 1,
        pageSize: 5
    })
    const relatedProducts = relatedItems.filter(p => p.slug !== slug).slice(0, 4)

    // Build extra specs to pass into Tabs
    const extraSpecs: { key: string, value: React.ReactNode }[] = []
    if (product.brands) {
        extraSpecs.push({ key: 'Thương hiệu', value: product.brands.name })
    }
    if (product.origins) {
        extraSpecs.push({ key: 'Xuất xứ', value: product.origins.name })
    }
    if (product.materials) {
        extraSpecs.push({ key: 'Chất liệu', value: product.materials.name })
    }
    if (product.colors) {
        extraSpecs.push({ 
            key: 'Màu sắc', 
            value: (
                <div className="flex items-center gap-2">
                    {product.colors.hex_code && (
                        <div 
                            className="w-4 h-4 rounded-[4px] border border-stone-200 shadow-sm" 
                            style={{ backgroundColor: product.colors.hex_code }}
                        />
                    )}
                    <span>{product.colors.name}</span>
                </div>
            ) 
        })
    }

    const stockDisplay = product.stock_status === 'in_stock'
        ? <span className="text-success-600 font-medium">Còn hàng</span>
        : product.stock_status === 'pre_order'
        ? <span className="text-warning-600 font-medium">Đặt trước</span>
        : <span className="text-danger-600 font-medium">Hết hàng</span>;

    return (
        <main className="u-container py-8 lg:py-12">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-stone-500 mb-8" aria-label="Breadcrumb">
                <Link href="/" className="hover:text-stone-900 transition-colors">Trang chủ</Link>
                <span>/</span>
                <Link href={BASE_PATH} className="hover:text-stone-900 transition-colors">{CATEGORY_NAME}</Link>
                {product.subcategories && (
                    <>
                        <span>/</span>
                        <Link href={`${BASE_PATH}?sub=${sub}`} className="hover:text-stone-900 transition-colors">
                            {product.subcategories.name}
                        </Link>
                    </>
                )}
                <span>/</span>
                <span className="text-stone-900 font-medium truncate max-w-[200px]">{product.name}</span>
            </nav>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14">
                {/* Gallery */}
                <ProductImageGallery
                    mainImageUrl={product.image_main_url}
                    hoverImageUrl={product.image_hover_url}
                    additionalImages={additionalImages.map(i => ({ image_url: i.image_url, alt_text: i.alt_text }))}
                    productName={product.name}
                />

                {/* Info */}
                <div className="flex flex-col gap-6">
                    {/* Badges */}
                    <div className="flex gap-2 flex-wrap">
                        {product.is_new && (
                            <span className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider border border-brand-500 text-brand-600 bg-brand-50 rounded-full">
                                Sản phẩm mới
                            </span>
                        )}
                        {product.is_bestseller && (
                            <span className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider bg-stone-900 text-white rounded-full">
                                Bán chạy
                            </span>
                        )}
                        {product.brands && <BrandBadge brand={product.brands as any} />}
                    </div>

                    <div>
                        <h1 className="text-display-sm font-bold text-stone-900 leading-tight mb-3 tracking-tight">
                            {product.name}
                        </h1>
                        <div className="flex items-center gap-4 text-[13px]">
                            <p className="text-stone-500">Mã SP: <span className="font-medium text-stone-900">{product.sku}</span></p>
                            <div className="w-1 h-1 rounded-full bg-stone-300" />
                            <p className="text-stone-500">Tình trạng: {stockDisplay}</p>
                        </div>
                    </div>

                    {/* Price */}
                    <div className="py-4 border-y border-stone-100">
                        <p className="text-xs text-stone-400 uppercase tracking-wider mb-1">Giá tham khảo</p>
                        <p className="text-3xl font-bold text-accent-500 tracking-tight">
                            {product.price_display || "Liên hệ báo giá"}
                        </p>
                    </div>

                    {/* Features highlights */}
                    {features.length > 0 && (
                        <div className="grid grid-cols-2 gap-3 mt-1">
                            {features.slice(0, 4).map(f => (
                                <div key={f.id} className="flex items-start gap-2.5 p-3 rounded-xl bg-stone-50 border border-stone-200">
                                    <div className="w-1.5 h-1.5 rounded-full bg-stone-300 mt-2 shrink-0" />
                                    <div>
                                        <p className="text-[11px] text-stone-400 uppercase tracking-wider">{f.product_features?.name}</p>
                                        <p className="text-[13px] font-medium text-stone-800 leading-tight mt-0.5">{f.value}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* CTA */}
                    <ProductCTA
                        productId={product.id}
                        productSku={product.sku}
                        productName={product.name}
                        price={product.price ? Number(product.price) : null}
                        priceDisplay={product.price_display}
                        imageUrl={product.image_main_url}
                        categorySlug={CATEGORY_SLUG}
                        subcategorySlug={product.subcategories?.slug ?? null}
                        brandName={product.brands?.name}
                        slug={product.slug}
                    />
                </div>
            </div>

            {/* Detail Tabs */}
            <div className="mt-16 border-t border-stone-100 pt-8">
                <ProductDetailTabs
                    description={product.description}
                    features={product.features}
                    specifications={null}
                    extraSpecs={extraSpecs}
                />
            </div>

            {/* Related Products */}
            {relatedProducts.length > 0 && (
                <div className="mt-16 pt-8 border-t border-stone-100">
                    <h2 className="text-display-xs font-bold text-stone-900 mb-6">Sản phẩm liên quan</h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                        {relatedProducts.map(p => (
                            <ProductCard
                                key={p.id}
                                product={p}
                                basePath={BASE_PATH}
                            />
                        ))}
                    </div>
                </div>
            )}
        </main>
    )
}

