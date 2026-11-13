import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LegacyBlogCard } from '../../../src/components/legacy-blog-card'
import { getPublicBlogCategory, getPublicBlogPostsForCategory } from '../../../src/runtime/live-public-blog'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ categorySlug: string }>
  searchParams: Promise<{ page?: string | string[] }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { categorySlug } = await params
  const category = await getPublicBlogCategory(categorySlug)
  if (!category) return { title: 'Không tìm thấy chuyên mục', robots: { index: false, follow: false } }
  const count = await getPublicBlogPostsForCategory(categorySlug).length
  return {
    title: category.seo_title || category.name,
    description: category.seo_description || category.description || `Bài viết chuyên mục ${category.name} tại Đông Phú Gia.`,
    alternates: { canonical: `/blog/${categorySlug}` },
    robots: { index: count > 0, follow: true },
  }
}

export default async function PublicBlogCategoryPage({ params, searchParams }: Props) {
  const [{ categorySlug }, { page }] = await Promise.all([params, searchParams])
  if (page !== undefined && page !== '1') notFound()
  const category = await getPublicBlogCategory(categorySlug)
  if (!category) notFound()
  const posts = await getPublicBlogPostsForCategory(categorySlug)

  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-[#E4EEF2] bg-[#F5F9FB] py-12">
        <div className="mx-auto max-w-[1280px] px-5">
          <nav aria-label="Đường dẫn" className="mb-6 flex flex-wrap gap-2 text-sm text-[#6A8A97]">
            <Link href="/" className="hover:underline">Trang chủ</Link><span>/</span>
            <Link href="/blog" className="hover:underline">Tin tức</Link><span>/</span>
            <span aria-current="page" className="text-[#2E7A96]">{category.name}</span>
          </nav>
          <h1 className="mb-3 text-3xl font-bold text-[#192125] lg:text-4xl">{category.name}</h1>
          <p className="max-w-2xl text-[#6A8A97]">{category.description || `Bài viết và thông tin thuộc chuyên mục ${category.name}.`}</p>
        </div>
      </header>
      <section className="mx-auto max-w-[1280px] px-5 py-12 lg:py-16">
        {posts.length > 0 ? (
          <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => <LegacyBlogCard key={post.id} post={post} />)}
          </div>
        ) : (
          <div className="rounded-2xl border border-[#E4EEF2] bg-[#F5F9FB] p-12 text-center text-[#6A8A97]">
            Chuyên mục này hiện chưa có bài viết được xuất bản trong dữ liệu cũ.
          </div>
        )}
      </section>
    </main>
  )
}
