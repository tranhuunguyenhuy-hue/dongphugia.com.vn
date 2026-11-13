import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { sanitizeRichHtml } from '@/lib/html-sanitizer'
import { LegacyBlogCard } from '../../../../src/components/legacy-blog-card'
import {
  blogPostPath,
  formatLegacyBlogDate,
  getPublicBlogData,
  publicBlogImage,
  restoreHistoricalBlogArticleLinks,
} from '../../../../src/runtime/legacy-blog'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ categorySlug: string; postSlug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { categorySlug, postSlug } = await params
  const { posts } = await getPublicBlogData()
  const post = posts.find((entry) => entry.category.slug === categorySlug && entry.slug === postSlug)
  if (!post) return { title: 'Bài viết không tồn tại', robots: { index: false, follow: false } }
  const path = blogPostPath(post)
  const cover = publicBlogImage(post.cover_image_url ?? post.thumbnail_url, post.source)
  return {
    title: post.seo_title || post.title,
    description: post.seo_description || post.excerpt || post.title,
    alternates: { canonical: path },
    robots: { index: true, follow: true },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.excerpt || undefined,
      publishedTime: post.published_at,
      ...(post.updated_at ? { modifiedTime: post.updated_at } : {}),
      url: path,
      ...(cover ? { images: [{ url: cover }] } : {}),
    },
  }
}

export default async function PublicBlogPostPage({ params }: Props) {
  const { categorySlug, postSlug } = await params
  const { posts } = await getPublicBlogData()
  const post = posts.find((entry) => entry.category.slug === categorySlug && entry.slug === postSlug)
  if (!post) notFound()
  const cover = publicBlogImage(post.cover_image_url ?? post.thumbnail_url, post.source)
  const articleContent = sanitizeRichHtml(
    restoreHistoricalBlogArticleLinks(post.content.replace(/<h1(\s|>)/gi, '<h2$1').replace(/<\/h1>/gi, '</h2>')),
  )
  const relatedPosts = posts.filter((other) =>
    other.slug !== post.slug && other.category.slug === post.category.slug,
  ).slice(0, 3)
  const path = blogPostPath(post)
  const articleStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt || undefined,
    datePublished: post.published_at,
    dateModified: post.updated_at,
    ...(cover ? { image: [cover] } : {}),
    author: { '@type': 'Organization', name: post.author_name },
    publisher: { '@type': 'Organization', name: 'Đông Phú Gia' },
    mainEntityOfPage: `https://www.dongphugia.vn${path}`,
  }

  return (
    <main className="min-h-screen bg-[#F5F9FB] pb-20">
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(articleStructuredData).replace(/</g, '\\u003c'),
        }} />
      <div className="mx-auto max-w-[1280px] px-5 pt-10">
        <nav aria-label="Đường dẫn" className="mb-8 flex flex-wrap gap-2 text-sm text-[#6A8A97]">
          <Link href="/" className="hover:underline">Trang chủ</Link><span>/</span>
          <Link href="/blog" className="hover:underline">Tin tức</Link><span>/</span>
          <Link href={`/blog/${post.category.slug}`} className="hover:underline">{post.category.name}</Link>
        </nav>

        <article className="mx-auto max-w-[920px] rounded-3xl border border-[#E4EEF2] bg-white p-6 shadow-sm md:p-10">
          <Link href={`/blog/${post.category.slug}`}
            className="inline-block rounded-full bg-[#C5E8F5] px-3 py-1.5 text-sm font-semibold text-[#2E7A96]">
            {post.category.name}
          </Link>
          <h1 className="mb-5 mt-6 text-3xl font-bold leading-tight text-[#192125] md:text-4xl">{post.title}</h1>
          <div className="mb-7 flex flex-wrap items-center gap-4 text-sm text-[#6A8A97]">
            <span>{post.author_name}</span>
            <time dateTime={post.published_at}>{formatLegacyBlogDate(post.published_at)}</time>
            {post.reading_time ? <span>{post.reading_time} phút đọc</span> : null}
          </div>

          {cover ? (
            <div className="mb-9 overflow-hidden rounded-2xl bg-[#F5F9FB]">
              {/* Unoptimized source image with the original approved article metadata. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cover} alt={post.title} loading="eager"
                className="max-h-[480px] w-full object-cover" />
            </div>
          ) : null}

          <div className="prose prose-slate prose-lg max-w-none break-words prose-img:mx-auto prose-img:max-w-full"
            dangerouslySetInnerHTML={{ __html: articleContent }} />

          <div className="mt-10 border-t border-[#E4EEF2] pt-6 text-sm text-[#6A8A97]">
            Nội dung được khôi phục từ bài viết đã xuất bản trên website Đông Phú Gia trước đây.
          </div>
        </article>

        {relatedPosts.length > 0 ? (
          <section className="mx-auto mt-14 max-w-[1280px]" aria-labelledby="related-news">
            <h2 id="related-news" className="mb-6 text-2xl font-bold text-[#192125]">Bài viết liên quan</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {relatedPosts.map((related) => <LegacyBlogCard key={blogPostPath(related)} post={related} />)}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  )
}
