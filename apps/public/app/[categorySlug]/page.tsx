import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import {
  PUBLIC_CATALOGUE_FIXTURE_NOTICE,
  getPreviewCatalogueListings,
} from '@dpg/public-catalogue-runtime'
import { resolvePublicCatalogueRoute } from '../../src/routes'

export const runtime = 'edge'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

type PageProps = { params: Promise<{ categorySlug: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { categorySlug } = await params
  const route = resolvePublicCatalogueRoute([categorySlug])
  if (route.kind !== 'category') return { title: 'Không tìm thấy danh mục', robots: { index: false } }

  return {
    title: `${route.category.name} | Đông Phú Gia Preview`,
    robots: { index: false, follow: false },
  }
}

export default async function PublicCategoryPage({ params }: PageProps) {
  const { categorySlug } = await params
  const route = resolvePublicCatalogueRoute([categorySlug])
  if (route.kind !== 'category') notFound()

  const listings = getPreviewCatalogueListings(route.category.slug)

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-5 py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-stone-500">
        <Link href="/">Trang chủ</Link> <span aria-hidden="true">/</span>{' '}
        <span aria-current="page">{route.category.name}</span>
      </nav>
      <header className="space-y-3">
        <h1 className="text-3xl font-bold text-stone-900">{route.category.name}</h1>
        <p className="text-sm text-stone-600">{PUBLIC_CATALOGUE_FIXTURE_NOTICE}</p>
      </header>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((listing) => (
          <li key={listing.slug}>
            <Link
              className="block rounded-2xl border border-stone-200 bg-white p-5 transition hover:border-brand-400 hover:shadow-sm"
              href={`/${route.category.slug}/${listing.slug}`}
            >
              <span className="font-semibold text-stone-900">{listing.name}</span>
              <span className="mt-2 block text-sm text-stone-500">Xem sản phẩm →</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
