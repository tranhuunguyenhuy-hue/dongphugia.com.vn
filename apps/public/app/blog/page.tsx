import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LegacyBlogCard } from '../../src/components/legacy-blog-card'
import {
  blogCategoriesWithPosts,
  blogPosts,
} from '../../src/runtime/legacy-blog'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Blog & Tin tức | Đông Phú Gia',
  description: 'Xu hướng thiết kế, kiến thức vật liệu xây dựng và hướng dẫn chọn thiết bị vệ sinh từ Đông Phú Gia.',
  alternates: { canonical: '/blog' },
  robots: { index: true, follow: true },
}

export default async function PublicNewsPage({ searchParams }: {
  searchParams: Promise<{ page?: string | string[] }>
}) {
  const { page } = await searchParams
  // The original published archive has eight posts: exactly one listing page.
  if (page !== undefined && page !== '1') notFound()
  const [featured, ...remaining] = blogPosts
  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-[#E4EEF2] bg-[#F5F9FB] py-12 lg:py-16">
        <div className="mx-auto max-w-[1280px] px-5 text-center">
          <h1 className="mb-4 text-3xl font-bold tracking-tight text-[#192125] lg:text-5xl">
            Góc chia sẻ <span className="text-[#2E7A96]">Đông Phú Gia</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-[#6A8A97]">
            Kiến thức vật liệu xây dựng, xu hướng thiết kế và kinh nghiệm lựa chọn thiết bị cho ngôi nhà.
          </p>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1280px] flex-col gap-10 px-5 py-12 lg:flex-row lg:py-16">
        <div className="min-w-0 flex-1 space-y-12">
          {featured ? (
            <section aria-labelledby="featured-news">
              <h2 id="featured-news" className="mb-6 text-2xl font-bold text-[#192125]">Bài viết nổi bật</h2>
              <LegacyBlogCard post={featured} featured />
            </section>
          ) : null}
          <section aria-labelledby="all-news">
            <h2 id="all-news" className="mb-6 text-2xl font-bold text-[#192125]">Các bài viết đã xuất bản</h2>
            <div className="grid gap-6 sm:grid-cols-2">
              {remaining.map((post) => <LegacyBlogCard key={post.id} post={post} />)}
            </div>
            <p className="mt-8 text-sm text-[#6A8A97]">Đang hiển thị {blogPosts.length} bài viết được khôi phục từ dữ liệu website trước đây.</p>
          </section>
        </div>
        <aside className="w-full shrink-0 lg:w-[30%]" aria-label="Chuyên mục tin tức">
          <nav className="rounded-2xl border border-[#E4EEF2] bg-[#F5F9FB] p-6">
            <h2 className="mb-4 border-b border-[#C8D9E0] pb-4 text-lg font-bold text-[#192125]">Chuyên mục</h2>
            <ul className="space-y-4">
              {blogCategoriesWithPosts.map((category) => (
                <li key={category.id}>
                  <Link href={`/blog/${category.slug}`}
                    className="font-medium text-[#516A74] hover:text-[#2E7A96]">
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <p className="mt-5 text-sm text-[#6A8A97]">
            <Link href="/" className="underline hover:text-[#2E7A96]">Trở về trang chủ</Link>
          </p>
        </aside>
      </div>
    </main>
  )
}
