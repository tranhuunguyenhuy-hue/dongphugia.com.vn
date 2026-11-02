import type { Metadata } from 'next'
import Link from 'next/link'

export const runtime = 'edge'

export const metadata: Metadata = {
  title: 'Tin tức & Cẩm nang',
  description: 'Thông tin và cẩm nang từ Đông Phú Gia.',
  alternates: { canonical: '/blog' },
  robots: { index: true, follow: true },
}

export default function PublicNewsPage() {
  return (
    <main className="mx-auto max-w-[1280px] px-5 pb-20 pt-28 lg:pt-36">
      <h1 className="text-3xl font-semibold text-stone-900">Tin tức & Cẩm nang</h1>
      <p className="mt-6 max-w-2xl text-stone-600">
        Bài viết đang được cập nhật. Trong thời gian này, bạn có thể xem danh mục sản phẩm hoặc liên hệ Đông Phú Gia để được tư vấn.
      </p>
      <div className="mt-8 flex flex-wrap gap-4">
        <Link href="/thiet-bi-ve-sinh" className="rounded-full bg-brand-700 px-5 py-3 text-white">Xem sản phẩm</Link>
        <Link href="/lien-he" className="rounded-full border border-stone-300 px-5 py-3 text-stone-800">Liên hệ tư vấn</Link>
      </div>
    </main>
  )
}
