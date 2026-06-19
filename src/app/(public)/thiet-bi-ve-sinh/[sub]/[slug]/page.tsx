import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { getPublicProductBySlug, getPublicProducts, getProductComponents, getVariantSelectionData, getVariantSiblings } from "@/lib/public-api-products"
import { ProductImageGallery } from "@/components/product/product-image-gallery"
import { ProductDetailTabs } from "@/components/product/product-detail-tabs"
import { ProductComponentsSection } from "@/components/product/product-components-section"
import { ProductBoxIncludes } from "@/components/product/product-box-includes"
import { ProductPurchasePanel } from "@/components/product/product-purchase-panel"
import { ProductVariantMetaPills } from "@/components/product/product-variant-meta-pills"
import { ProductCard } from "@/components/ui/product-card"
import { RecentlyViewedProducts } from "@/components/product/recently-viewed"
import { BrandBadge } from "@/components/ui/brand-badge"
import { JsonLd } from "@/components/seo/json-ld"
import { buildProductSchema, buildBreadcrumbSchema } from "@/lib/seo/schema"

export const revalidate = 21600
export const dynamicParams = true

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
        title: `${product.name} | ${CATEGORY_NAME}`,
        description: product.description?.slice(0, 160) || `${product.name} - Chính hãng tại Đông Phú Gia Đà Lạt.`,
        alternates: { canonical: `${BASE_PATH}/${slug}` },
        openGraph: {
            title: `${product.name}`,
            description: product.description?.slice(0, 160) || `${product.name} - Chính hãng tại Đông Phú Gia Đà Lạt.`,
            images: product.image_main_url
                ? [{ url: product.image_main_url, width: 800, height: 600, alt: product.name }]
                : [],
        },
    }
}

export default async function ThietBiVeSinhDetailPage({ params }: PageProps) {
    const { sub, slug } = await params
    const product = await getPublicProductBySlug(CATEGORY_SLUG, slug)
    if (!product) notFound()



    // Fetch product components + variant siblings in parallel
    const [productComponents, variantSiblings, variantSelectionData] = await Promise.all([
        getProductComponents(product.id),
        product.variant_group ? getVariantSiblings(product.variant_group, product.id) : Promise.resolve([]),
        product.variant_group ? getVariantSelectionData(product.variant_group, product.id) : Promise.resolve({ axes: [], currentVariantOptions: [], siblings: [] }),
    ])
    const hasComponents = productComponents.some(c => c.child !== null)

    // Extract "Phụ kiện đi kèm" from specs
    let boxIncludes: string[] = []
    if (product.specs && typeof product.specs === 'object' && !Array.isArray(product.specs)) {
        boxIncludes = (product.specs as any)['Phụ kiện đi kèm'] || []
    }

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



    const stockPill = product.stock_status === 'discontinued'
        ? { label: 'Ngừng kinh doanh', dot: 'bg-rose-400', wrap: 'bg-rose-50 border-rose-200', text: 'text-rose-700' }
        : product.stock_status === 'in_stock'
        ? { label: 'Còn hàng', dot: 'bg-emerald-500 animate-pulse', wrap: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-700' }
        : product.stock_status === 'pre_order'
        ? { label: 'Đặt trước', dot: 'bg-amber-500', wrap: 'bg-amber-50 border-amber-100', text: 'text-amber-700' }
        : { label: 'Liên hệ', dot: 'bg-rose-500', wrap: 'bg-rose-50 border-rose-100', text: 'text-rose-700' }

    const purchaseProduct = {
        id: product.id,
        sku: product.sku,
        slug: product.slug,
        name: product.name,
        price: product.price ? Number(product.price) : null,
        original_price: product.original_price ? Number(product.original_price) : null,
        online_discount_amount: product.online_discount_amount ? Number(product.online_discount_amount) : null,
        price_display: product.price_display,
        image_main_url: product.image_main_url,
        product_images: product.product_images?.map((image) => ({
            image_url: image.image_url,
        })) ?? [],
        stock_status: product.stock_status,
        is_active: product.is_active,
        variant_group: product.variant_group,
        variant_type: product.variant_type,
        variant_label: product.variant_label,
        colors: product.colors,
        brands: product.brands,
    }
    const plainVariantSiblings = variantSiblings.map((sibling) => ({
        ...sibling,
        price: sibling.price ? Number(sibling.price) : null,
        original_price: sibling.original_price ? Number(sibling.original_price) : null,
    }))

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
                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${stockPill.wrap}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${stockPill.dot}`} />
                                <span className={`font-medium ${stockPill.text}`}>
                                    {stockPill.label}
                                </span>
                            </div>

                            {/* 2. Brand Badge */}
                            {product.brands && <BrandBadge brand={product.brands as any} className="!h-7 !px-2.5 rounded-md border-stone-200/60 shadow-sm" />}

                            {/* 3-4. Variant-aware Color + SKU Pills */}
                            <ProductVariantMetaPills
                                initialSku={product.sku}
                                initialColor={product.colors}
                                initialVariantOptions={variantSelectionData.currentVariantOptions}
                            />
                        </div>
                    </div>

                    <ProductPurchasePanel
                        product={purchaseProduct}
                        variantSiblings={variantSelectionData.siblings.length > 0 ? variantSelectionData.siblings : plainVariantSiblings}
                        variantAxes={variantSelectionData.axes}
                        currentVariantOptions={variantSelectionData.currentVariantOptions}
                        categorySlug={CATEGORY_SLUG}
                        subcategorySlug={product.subcategories?.slug}
                    />

                    {/* Accessories & Documents (Moved from left column to save space) */}
                    {(hasComponents || boxIncludes.length > 0) && (
                        <div className="flex flex-col gap-6 pt-6 border-t border-stone-100">
                            {boxIncludes.length > 0 && (
                                <ProductBoxIncludes items={boxIncludes} />
                            )}
                            
                            {hasComponents && (
                                <ProductComponentsSection
                                    components={productComponents as any}
                                    basePath={BASE_PATH}
                                />
                            )}
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
                            specifications={product.specs}
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
