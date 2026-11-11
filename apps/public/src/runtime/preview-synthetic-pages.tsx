import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ProductPurchasePanel } from '@/components/product/product-purchase-panel'
import { ProductCard } from '@/components/ui/product-card'
import { getPublicProductBySlug, getVariantSelectionData } from '@/lib/public-api-products'

import { getPublicAppEnvironment } from '../config/env'
import { getPreviewCatalogueProducts } from './preview-public-catalogue'
import {
  expectedPreviewSyntheticSku,
  isPreviewSyntheticListingRoute,
  isPreviewSyntheticProductRoute,
  PREVIEW_SYNTHETIC_CATEGORY_SLUG,
  PREVIEW_SYNTHETIC_LISTING_SLUG,
} from './preview-synthetic-route-contract'

const PRODUCT_URL = `/${PREVIEW_SYNTHETIC_CATEGORY_SLUG}/${PREVIEW_SYNTHETIC_LISTING_SLUG}`
const EXPECTED_SKUS = ['DPG-290-SYN-A', 'DPG-290-SYN-B'] as const
const nullableNumber = (value: unknown) => value === null || value === undefined ? null : Number(value)

function requirePreviewSyntheticListing() {
  const environment = getPublicAppEnvironment().environment
  if (!isPreviewSyntheticListingRoute(
    environment,
    PREVIEW_SYNTHETIC_CATEGORY_SLUG,
    PREVIEW_SYNTHETIC_LISTING_SLUG,
  )) notFound()
}

export async function PreviewSyntheticListingPage() {
  requirePreviewSyntheticListing()

  const products = await getPreviewCatalogueProducts(
    PREVIEW_SYNTHETIC_CATEGORY_SLUG,
    PREVIEW_SYNTHETIC_LISTING_SLUG,
  )
  const actualSkus = products.map((product) => product.sku).sort()
  if (products.length !== EXPECTED_SKUS.length
    || actualSkus.some((sku, index) => sku !== [...EXPECTED_SKUS].sort()[index])) notFound()

  return (
    <main className="mx-auto w-full max-w-[1380px] px-5 py-8 lg:px-8 lg:py-12" data-preview-synthetic-catalogue>
      <nav className="mb-5 flex items-center gap-2 text-sm text-stone-600" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-brand-700">Trang chủ</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/${PREVIEW_SYNTHETIC_CATEGORY_SLUG}`} className="hover:text-brand-700">Sản phẩm thử nghiệm</Link>
        <span aria-hidden="true">/</span>
        <span>Tùy chọn SKU</span>
      </nav>
      <header className="mb-7">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-amber-800">Preview · Dữ liệu tổng hợp</p>
        <h1 className="text-2xl font-bold text-stone-900 md:text-3xl">Tùy chọn SKU kiểm thử</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
          Hai lựa chọn A/B dưới đây chỉ là dữ liệu kiểm thử tổng hợp; không đại diện cho catalogue hoặc giá bán thực tế.
        </p>
      </header>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-6">
        {products.map((product) => (
          <ProductCard
            key={product.sku}
            product={product}
            basePath={PRODUCT_URL}
            patternSlug={PREVIEW_SYNTHETIC_LISTING_SLUG}
            href={product.url}
          />
        ))}
      </div>
    </main>
  )
}

export async function PreviewSyntheticProductPage({ productSlug }: { productSlug: string }) {
  const environment = getPublicAppEnvironment().environment
  if (!isPreviewSyntheticProductRoute(
    environment,
    PREVIEW_SYNTHETIC_CATEGORY_SLUG,
    PREVIEW_SYNTHETIC_LISTING_SLUG,
    productSlug,
  )) notFound()

  const expectedSku = expectedPreviewSyntheticSku(productSlug)
  const product = await getPublicProductBySlug(PREVIEW_SYNTHETIC_CATEGORY_SLUG, productSlug)
  if (!product
    || product.sku !== expectedSku
    || product.categories?.slug !== PREVIEW_SYNTHETIC_CATEGORY_SLUG
    || product.subcategories?.slug !== PREVIEW_SYNTHETIC_LISTING_SLUG
    || product.variant_group !== 'public-290') notFound()

  const selection = await getVariantSelectionData(product.variant_group, product.id)
  const expectedSiblingSku = EXPECTED_SKUS.find((sku) => sku !== product.sku)
  if (selection.siblings.length !== 1 || selection.siblings[0]?.sku !== expectedSiblingSku) notFound()

  return (
    <main className="mx-auto w-full max-w-[1240px] px-5 py-8 lg:px-8 lg:py-12" data-preview-synthetic-product>
      <nav className="mb-5 flex flex-wrap items-center gap-2 text-sm text-stone-600" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-brand-700">Trang chủ</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/${PREVIEW_SYNTHETIC_CATEGORY_SLUG}`} className="hover:text-brand-700">Sản phẩm thử nghiệm</Link>
        <span aria-hidden="true">/</span>
        <Link href={PRODUCT_URL} className="hover:text-brand-700">Tùy chọn SKU</Link>
        <span aria-hidden="true">/</span>
        <span>{product.name}</span>
      </nav>
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
        <section>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-amber-800">Preview · Dữ liệu tổng hợp</p>
          <h1 className="text-2xl font-bold leading-tight text-stone-900 md:text-3xl" data-testid="preview-product-name">
            {product.name}
          </h1>
          <p className="mt-3 text-sm text-stone-600">Mã SKU: <strong data-testid="selected-sku">{product.sku}</strong></p>
          <p role="note" className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            Giá hiển thị là giá kiểm thử tổng hợp, không phải giá bán; nhân viên xác nhận giá và khả năng cung ứng trước khi nhận yêu cầu.
          </p>
        </section>
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm md:p-7" aria-label="Thông tin đặt hàng kiểm thử">
          <ProductPurchasePanel
            product={{
              id: product.id,
              sku: product.sku,
              slug: product.slug,
              name: product.name,
              price: nullableNumber(product.price),
              original_price: nullableNumber(product.original_price),
              sale_price: nullableNumber(product.sale_price),
              list_price: nullableNumber(product.list_price),
              online_discount_amount: nullableNumber(product.online_discount_amount),
              price_display: product.price_display,
              image_main_url: product.image_main_url,
              product_images: product.product_images?.map((image) => ({ image_url: image.image_url })) ?? [],
              stock_status: product.stock_status,
              is_active: product.is_active,
              variant_group: product.variant_group,
              sale_status: product.sale_status ?? null,
              price_state: product.price_state ?? null,
              variant_type: product.variant_type,
              variant_label: product.variant_label,
              colors: product.colors ?? null,
              brands: product.brands ?? null,
            }}
            variantSiblings={selection.siblings}
            variantAxes={selection.axes}
            currentVariantOptions={selection.currentVariantOptions}
            categorySlug={PREVIEW_SYNTHETIC_CATEGORY_SLUG}
            subcategorySlug={PREVIEW_SYNTHETIC_LISTING_SLUG}
          />
        </section>
      </div>
    </main>
  )
}
