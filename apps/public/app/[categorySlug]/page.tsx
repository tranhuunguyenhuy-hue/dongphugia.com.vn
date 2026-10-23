import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { siteConfig } from '@/config/site'
import { getPublicAppEnvironment } from '../../src/config/env'
import { resolvePublicCatalogueRoute } from '../../src/routes'

export const runtime = 'edge'

type PageProps = { params: Promise<{ categorySlug: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { categorySlug } = await params
  const route = resolvePublicCatalogueRoute([categorySlug])
  if (route.kind !== 'category') return { title: 'Không tìm thấy danh mục', robots: { index: false } }

  return {
    title: route.category.name,
    description: `Thông tin nhóm hàng ${route.category.name} tại Đông Phú Gia. Danh mục sản phẩm trực tuyến đang được cập nhật.`,
    alternates: { canonical: `/${route.category.slug}` },
    robots: getPublicAppEnvironment().previewNoindex
      ? { index: false, follow: false }
      : undefined,
  }
}

export default async function PublicCategoryPage({ params }: PageProps) {
  const { categorySlug } = await params
  const route = resolvePublicCatalogueRoute([categorySlug])
  if (route.kind !== 'category') notFound()

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-5 py-10 lg:py-16">
      <nav aria-label="Breadcrumb" className="text-sm text-stone-500">
        <Link href="/">Trang chủ</Link> <span aria-hidden="true">/</span>{' '}
        <span aria-current="page">{route.category.name}</span>
      </nav>
      <header className="space-y-3">
        <h1 className="text-3xl font-bold text-stone-900">{route.category.name}</h1>
        <p className="max-w-2xl leading-7 text-stone-600">
          Danh mục trực tuyến đang được cập nhật. Website hiện chưa hiển thị sản phẩm,
          giá hoặc tình trạng hàng của nhóm này. Vui lòng liên hệ trực tiếp để được tư vấn.
        </p>
      </header>
      <div className="flex flex-wrap gap-3">
        <Link href="/lien-he" className="rounded-full bg-brand-700 px-6 py-3 font-semibold text-white hover:bg-brand-800">Thông tin liên hệ</Link>
        <a href={`tel:${siteConfig.contact.hotline}`} className="rounded-full border border-brand-700 px-6 py-3 font-semibold text-brand-700 hover:bg-brand-50">Gọi {siteConfig.contact.hotlineLabel}</a>
      </div>
    </div>
  )
}
