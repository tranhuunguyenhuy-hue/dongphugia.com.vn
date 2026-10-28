import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'

import { ProductCard } from '@/components/ui/product-card'
import {
  PUBLIC_CATALOGUE_FIXTURE_NOTICE,
  getPreviewCatalogueProducts,
} from '@dpg/public-catalogue-runtime'
import { resolvePublicCatalogueRoute } from '@dpg/public-catalogue-runtime'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

type PageProps = {
  params: Promise<{ categorySlug: string; subcategorySlug: string }>
  searchParams: Promise<{ page?: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { categorySlug, subcategorySlug } = await params
  const route = await resolvePublicCatalogueRoute([categorySlug, subcategorySlug])
  if (route.kind !== 'listing') return { title: 'Không tìm thấy danh mục', robots: { index: false } }

  return {
    title: `${route.listing.name} | ${route.category.name}`,
    robots: { index: false, follow: false },
  }
}

export default async function PublicListingPage({ params, searchParams }: PageProps) {
  const { categorySlug, subcategorySlug } = await params
  const route = await resolvePublicCatalogueRoute([categorySlug, subcategorySlug])
  if (route.kind === 'redirect') permanentRedirect(route.destination)
  if (route.kind !== 'listing') notFound()

  const query = await searchParams
  const page = query.page && /^[1-9][0-9]*$/.test(query.page) ? Number(query.page) : 1
  if (!Number.isSafeInteger(page)) notFound()
  const products = await getPreviewCatalogueProducts(route.category.slug, route.listing.slug, page)
  if (page > 1 && products.length === 0) notFound()
  const total = 'totalCount' in route.listing ? Number(route.listing.totalCount) : products.length
  const lastPage = Math.max(1, Math.ceil(total / 48))
  const listingPath = `/${route.category.slug}/${route.listing.slug}`

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-5 py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-stone-500">
        <Link href="/">Trang chủ</Link> <span aria-hidden="true">/</span>{' '}
        <Link href={`/${route.category.slug}`}>{route.category.name}</Link>{' '}
        <span aria-hidden="true">/</span> <span aria-current="page">{route.listing.name}</span>
      </nav>
      <header className="space-y-3">
        <h1 className="text-3xl font-bold text-stone-900">{route.listing.name}</h1>
        <p className="text-sm text-stone-600">{PUBLIC_CATALOGUE_FIXTURE_NOTICE}</p>
      </header>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <li key={product.slug}>
            <ProductCard basePath={`/${route.category.slug}`} product={product} />
          </li>
        ))}
      </ul>
      {lastPage > 1 ? <nav aria-label="Phân trang sản phẩm" className="flex items-center justify-center gap-6">
        {page > 1 ? <Link href={`${listingPath}?page=${page - 1}`} rel="prev">← Trang trước</Link> : null}
        <span>Trang {page} / {lastPage}</span>
        {page < lastPage ? <Link href={`${listingPath}?page=${page + 1}`} rel="next">Trang sau →</Link> : null}
      </nav> : null}
    </main>
  )
}
