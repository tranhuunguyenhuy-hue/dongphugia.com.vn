import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'

import { ProductImageGallery } from '@/components/product/product-image-gallery'
import {
  PUBLIC_CATALOGUE_FIXTURE_NOTICE,
  getPreviewCatalogueProduct,
} from '@dpg/public-catalogue-runtime'
import { resolvePublicCatalogueRoute } from '../../../../src/routes'

export const runtime = 'edge'

type PageProps = {
  params: Promise<{ categorySlug: string; subcategorySlug: string; productSlug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { categorySlug, subcategorySlug, productSlug } = await params
  const product = getPreviewCatalogueProduct(categorySlug, subcategorySlug, productSlug)
  if (!product) return { title: 'Không tìm thấy sản phẩm', robots: { index: false } }

  return {
    title: `${product.name} | Đông Phú Gia Preview`,
    description: PUBLIC_CATALOGUE_FIXTURE_NOTICE,
    robots: { index: false, follow: false },
  }
}

export default async function PublicProductPage({ params }: PageProps) {
  const { categorySlug, subcategorySlug, productSlug } = await params
  const route = resolvePublicCatalogueRoute([categorySlug, subcategorySlug, productSlug])
  if (route.kind === 'redirect') permanentRedirect(route.destination)
  const product = getPreviewCatalogueProduct(categorySlug, subcategorySlug, productSlug)
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
          <p className="text-sm text-stone-500">Mã fixture: {product.sku}</p>
          <p className="text-xl font-semibold text-brand-800">Liên hệ</p>
          <p className="text-sm leading-6 text-stone-600">
            Trang chi tiết chỉ dùng để kiểm thử điều hướng và giao diện. Thông tin thuộc tính,
            giá và khả năng cung ứng sẽ lấy từ nguồn catalogue được phê duyệt sau khi khôi phục dữ liệu.
          </p>
        </div>
      </section>
    </main>
  )
}
