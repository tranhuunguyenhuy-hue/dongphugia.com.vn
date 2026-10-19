import type { Metadata } from 'next'
import Link from 'next/link'

import { APPLICATIONS } from '@dpg/app-contracts'
import {
  PUBLIC_CATALOGUE_FIXTURE_NOTICE,
  getPreviewCatalogueCategories,
} from '@dpg/public-catalogue-runtime'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Danh mục sản phẩm | Đông Phú Gia Preview',
  robots: { index: false, follow: false },
}

export default function PublicFoundationPage() {
  const categories = getPreviewCatalogueCategories()

  return (
    <main
      className="mx-auto max-w-6xl space-y-8 px-5 py-12"
      data-application={APPLICATIONS.public.name}
      data-route-owner="public"
    >
      <header className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-700">
          Đông Phú Gia · Public Preview
        </p>
        <h1 className="text-3xl font-bold text-stone-900">Danh mục sản phẩm</h1>
        <p className="max-w-3xl text-sm leading-6 text-stone-600">{PUBLIC_CATALOGUE_FIXTURE_NOTICE}</p>
      </header>

      <nav aria-label="Danh mục sản phẩm">
        <ul className="grid gap-4 sm:grid-cols-2">
          {categories.map((category) => (
            <li key={category.slug}>
              <Link
                className="block rounded-2xl border border-stone-200 bg-white p-5 transition hover:border-brand-400 hover:shadow-sm"
                href={`/${category.slug}`}
              >
                <span className="font-semibold text-stone-900">{category.name}</span>
                <span className="mt-2 block text-sm text-stone-500">Xem danh mục →</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  )
}
