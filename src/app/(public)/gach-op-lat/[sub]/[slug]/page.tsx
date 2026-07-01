import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { getPdpDocuments, getPdpPackageItems, getPdpSpecifications, getPublicProductBySlug, getPublicProducts, getVariantSiblings } from "@/lib/public-api-products"
import { VariantSelector } from "@/components/product/variant-selector"
import { ProductImageGallery } from "@/components/product/product-image-gallery"
import { ProductDetailTabs } from "@/components/product/product-detail-tabs"
import { ProductCTA } from "@/components/product/product-cta"
import { ProductBoxIncludes } from "@/components/product/product-box-includes"
import { ProductCard } from "@/components/ui/product-card"
import { RecentlyViewedProducts } from "@/components/product/recently-viewed"
import { BrandBadge } from "@/components/ui/brand-badge"
import { ProductPrice } from "@/components/product/product-price"
import { JsonLd } from "@/components/seo/json-ld"
import { buildProductSchema, buildBreadcrumbSchema } from "@/lib/seo/schema"
import { canonicalUrl } from "@/lib/site"

export const revalidate = 21600
export const dynamicParams = true

interface PageProps {
    params: Promise<{ sub: string; slug: string }>
}

const CATEGORY_SLUG = "gach-op-lat"
const CATEGORY_NAME = "Gạch Ốp Lát"
const BASE_PATH = "/gach-op-lat"

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug } = await params
    const product = await getPublicProductBySlug(CATEGORY_SLUG, slug)
    if (!product) return { title: "Sản phẩm không tìm thấy" }
    return {
        title: `${product.name} | ${CATEGORY_NAME}`,
        description: product.description?.slice(0, 160) || `${product.name} - Chính hãng tại Đông Phú Gia Đà Lạt.`,
        alternates: { canonical: canonicalUrl(`${BASE_PATH}/${slug}`) },
        openGraph: {
            title: `${product.name}`,
            description: product.description?.slice(0, 160) || `${product.name} - Chính hãng tại Đông Phú Gia Đà Lạt.`,
            images: product.image_main_url
                ? [{ url: product.image_main_url, width: 800, height: 600, alt: product.name }]
                : [],
        },
    }
}

export default async function ProductDetailPage({ params }: PageProps) {
    const { sub, slug } = await params
    const product = await getPublicProductBySlug(CATEGORY_SLUG, slug)
    if (!product) notFound()

    const additionalImages = product.product_images?.filter(i => i.image_url !== product.image_main_url) ?? []
    const features = product.product_feature_values ?? []

    const variantSiblings = product.variant_group ? await getVariantSiblings(product.variant_group, product.id) : []

    const boxIncludes = getPdpPackageItems(product)
    const productDocuments = getPdpDocuments(product)
    const productSpecifications = getPdpSpecifications(product)

    // Fetch related products
    const { products: relatedItems } = await getPublicProducts({
        category_slug: CATEGORY_SLUG,
        subcategory_slug: product.subcategories?.slug || undefined,
        page: 1,
        pageSize: 5
    })
    const relatedProducts = relatedItems.filter(p => p.slug !== slug).slice(0, 4)



    const stockDisplay = product.stock_status === 'in_stock'
        ? <span className="text-success-600 font-medium">Còn hàng</span>
        : product.stock_status === 'pre_order'
        ? <span className="text-warning-600 font-medium">Đặt trước</span>
        : <span className="text-danger-600 font-medium">Hết hàng</span>;

    return (
        <main className="u-container pt-8 pb-28 lg:py-12">
            <JsonLd data={buildProductSchema({
                name: product.name,
                description: product.description,
                sku: product.sku,
                image_main_url: product.image_main_url,
                price: Number(product.price),
                stock_status: product.stock_status,
                brands: product.brands,
                slug: product.slug,
                categorySlug: CATEGORY_SLUG,
                subcategorySlug: product.subcategories?.slug,
            })} />
            <JsonLd data={buildBreadcrumbSchema([
                { name: "Trang chủ", url: "/" },
                { name: CATEGORY_NAME, url: BASE_PATH },
                ...(product.subcategories
                    ? [{ name: product.subcategories.name, url: `${BASE_PATH}/${product.subcategories.slug}` }]
                    : []),
                { name: product.name, url: `${BASE_PATH}/${sub}/${product.slug}` },
            ])} />
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-[11px] text-stone-500 mb-5 overflow-x-auto whitespace-nowrap scrollbar-hide" aria-label="Breadcrumb">
                <Link href="/" className="hover:text-stone-900 transition-colors shrink-0">Trang chủ</Link>
                <span className="text-stone-300 shrink-0">/</span>
                <Link href={BASE_PATH} className="hover:text-stone-900 transition-colors shrink-0">{CATEGORY_NAME}</Link>
                {product.subcategories && (
                    <>
                        <span className="text-stone-300 shrink-0">/</span>
                        <Link href={`${BASE_PATH}?sub=${sub}`} className="hover:text-stone-900 transition-colors shrink-0">
                            {product.subcategories.name}
                        </Link>
                    </>
                )}
                <span className="text-stone-300 shrink-0">/</span>
                <span className="text-stone-900 font-medium truncate max-w-[200px] sm:max-w-none shrink-0">{product.name}</span>
            </nav>

                        {/* Main Content */}
            <div className="flex flex-col lg:grid lg:grid-cols-2 gap-8 lg:gap-x-14 lg:gap-y-4 lg:items-start">
                {/* 1. Image Gallery (Mobile: Top, Desktop: Top Left) */}
                <div className="w-full lg:col-start-1 lg:row-start-1">
                    <ProductImageGallery
                    mainImageUrl={product.image_main_url}
                    additionalImages={additionalImages.map(i => ({ image_url: i.image_url, alt_text: i.alt_text }))}
                    productName={product.name}
                    discountPercent={
                        product.original_price && product.price && Number(product.original_price) > Number(product.price)
                            ? Math.round(((Number(product.original_price) - Number(product.price)) / Number(product.original_price)) * 100)
                            : 0
                    }
                />
                </div>

                {/* 2. Info & CTA (Mobile: Middle, Desktop: Right Column Sticky) */}
                <div className="flex flex-col gap-6 w-full lg:col-start-2 lg:row-start-1 lg:row-span-2 relative">
                    <div>
                        {/* Eyebrow / Breadcrumb badge (HI-5) */}
                        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-stone-100 text-[11px] font-medium text-stone-500 mb-3">
                            <span className="uppercase tracking-wider">{product.categories?.name}</span>
                            {product.subcategories && (
                                <>
                                    <span className="text-stone-300">/</span>
                                    <span>{product.subcategories.name}</span>
                                </>
                            )}
                        </div>

                        <h1 className="text-3xl md:text-[34px] lg:text-[36px] font-bold text-stone-900 leading-[1.15] mb-4 tracking-tight">
                            {product.name}
                        </h1>

                        <div className="flex flex-wrap items-center gap-2 text-[12px]">
                            {/* 1. Status Pill */}
                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${product.stock_status === 'in_stock' ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${product.stock_status === 'in_stock' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                                <span className={`font-medium ${product.stock_status === 'in_stock' ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    {product.stock_status === 'in_stock' ? 'Còn hàng' : 'Liên hệ'}
                                </span>
                            </div>

                            {/* 2. Brand Badge */}
                            {product.brands && <BrandBadge brand={product.brands as any} className="!h-7 !px-2.5 rounded-md border-stone-200/60 shadow-sm" />}

                            {/* 3. Color Pill */}
                            {product.colors && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-stone-50 border border-stone-200/60">
                                    <span
                                        className="w-3 h-3 rounded-full border border-black/10 shadow-sm"
                                        style={{ backgroundColor: product.colors.hex_code || '#ccc' }}
                                    />
                                    <span className="font-medium text-stone-700">{product.colors.name}</span>
                                </div>
                            )}

                            {/* 4. SKU Pill */}
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-stone-100">
                                <span className="text-stone-500">Mã SP:</span>
                                <span className="font-mono font-bold text-stone-800">{product.sku}</span>
                            </div>
                        </div>
                    </div>

                    {/* Variant Selector */}
                    {product.variant_group && variantSiblings.length > 0 && (
                        <div className="mt-2 mb-2">
                            <VariantSelector
                                currentSku={product.sku}
                                currentSlug={product.slug}
                                currentName={product.name}
                                currentImageMainUrl={product.image_main_url}
                                currentPriceDisplay={product.price_display}
                                currentPrice={Number(product.price)}
                                currentOriginalPrice={Number(product.original_price)}
                                currentColor={product.colors}
                                variantType={product.variant_type}
                                variantLabel={product.variant_label}
                                variantGroup={product.variant_group}
                                siblings={variantSiblings}
                                categorySlug={CATEGORY_SLUG}
                                subcategorySlug={product.subcategories?.slug}
                            />
                        </div>
                    )}

                    {/* Price and CTA */}
                    <ProductPrice 
                        price={Number(product.price)}
                        originalPrice={Number(product.original_price)}
                        priceDisplay={product.price_display}
                        onlineDiscountAmount={Number(product.online_discount_amount)}
                    >
                        <ProductCTA
                            productId={product.id}
                            productSku={product.sku}
                            productName={product.name}
                            price={product.price ? Number(product.price) : null}
                            originalPrice={product.original_price ? Number(product.original_price) : null}
                            priceDisplay={product.price_display}
                            imageUrl={product.image_main_url || (product.product_images && product.product_images.length > 0 ? product.product_images[0].image_url : null)}
                            categorySlug={CATEGORY_SLUG}
                            subcategorySlug={product.subcategories?.slug ?? null}
                            brandName={product.brands?.name}
                            slug={product.slug}
                        />
                    </ProductPrice>

                    {/* Box Includes (Nguyên hộp bao gồm) */}
                    {boxIncludes.length > 0 && (
                        <div className="flex flex-col gap-6 pt-6 border-t border-stone-100">
                            <ProductBoxIncludes items={boxIncludes} />
                        </div>
                    )}
</div>

                {/* 3. Product Details & Tabs (Mobile: Bottom, Desktop: Bottom Left) */}
                <div className="flex flex-col gap-8 w-full lg:col-start-1 lg:row-start-2">
                    
                    {/* Detail Tabs */}
                    <div className="mt-2">
                        <ProductDetailTabs
                            description={product.description}
                            features={product.features}
                            specifications={productSpecifications}
                            documents={productDocuments}
                        />
                    </div>
                </div>
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
            <RecentlyViewedProducts currentProduct={{
                id: product.id,
                name: product.name,
                display_name: product.display_name,
                slug: product.slug,
                sku: product.sku,
                image_main_url: product.image_main_url,
                price: product.price ? Number(product.price) : null,
                original_price: product.original_price ? Number(product.original_price) : null,
                online_discount_amount: product.online_discount_amount ? Number(product.online_discount_amount) : null,
                price_display: product.price_display,
                category_slug: CATEGORY_SLUG,
                is_featured: product.is_featured,
                is_promotion: product.is_promotion,
                url: `${BASE_PATH}/${sub}/${slug}`,
                colors: product.colors,
                brands: product.brands,
                subcategories: product.subcategories,
                stock_status: product.stock_status,
            }} />
        </main>
    )
}
