import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'

import { siteConfig, siteLinks } from '@/config/site'
import { ProductImageGallery } from '@/components/product/product-image-gallery'
import {
  PUBLIC_CATALOGUE_FIXTURE_NOTICE,
  getPreviewCatalogueProduct,
} from '@dpg/public-catalogue-runtime'
import { resolvePublicCatalogueRoute } from '@dpg/public-catalogue-runtime'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

type PageProps = {
  params: Promise<{ categorySlug: string; subcategorySlug: string; productSlug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { categorySlug, subcategorySlug, productSlug } = await params
  const product = await getPreviewCatalogueProduct(categorySlug, subcategorySlug, productSlug)
  if (!product) return { title: 'Không tìm thấy sản phẩm', robots: { index: false } }

  return {
    title: `${product.name}`,
    description: PUBLIC_CATALOGUE_FIXTURE_NOTICE,
    robots: { index: false, follow: false },
  }
}

export default async function PublicProductPage({ params }: PageProps) {
  const { categorySlug, subcategorySlug, productSlug } = await params
  const route = await resolvePublicCatalogueRoute([categorySlug, subcategorySlug, productSlug])
  if (route.kind === 'redirect') permanentRedirect(route.destination)
  const product = await getPreviewCatalogueProduct(categorySlug, subcategorySlug, productSlug)
  if (!product) notFound()

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-5 py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-stone-500">
        <Link href="/">Trang chủ</Link> <span aria-hidden="true">/</span>{' '}
        <Link href={product.categoryPath}>{product.categoryName}</Link>{' '}
        <span aria-hidden="true">/</span>{' '}
        <Link href={product.listingPath}>{product.listingName}</Link>{' '}
        <span aria-hidden="true">/</span> <span aria-current="page">{product.name}</span>
      </nav>
      <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        {PUBLIC_CATALOGUE_FIXTURE_NOTICE}
      </p>
      <section className="grid gap-8 md:grid-cols-2">
        <ProductImageGallery mainImageUrl={product.imageUrl} productName={product.name} />
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">
            {product.brand.name}
          </p>
          <h1 className="text-3xl font-bold text-stone-900">{product.name}</h1>
          <p className="text-sm text-stone-500">Mã sản phẩm: {product.sku}</p>
          <p className="text-xl font-semibold text-brand-800">Liên hệ</p>
          <p className="text-sm leading-6 text-stone-600">
            Catalogue khôi phục ở chế độ chỉ đọc. Vui lòng liên hệ để xác nhận giá và khả năng cung ứng hiện tại.
          </p>
          <div className="flex flex-wrap gap-3">
            <a className="rounded-xl bg-brand-700 px-5 py-3 font-semibold text-white" href={`tel:${siteConfig.contact.hotline}`}>Gọi tư vấn</a>
            <a className="rounded-xl border border-brand-700 px-5 py-3 font-semibold text-brand-700" href={siteLinks.zalo} rel="noopener noreferrer" target="_blank">Nhận báo giá qua Zalo</a>
          </div>
        </div>
      </section>
    </main>
  )
}
