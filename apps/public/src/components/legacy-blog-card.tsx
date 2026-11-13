import Link from 'next/link'
import {
  blogPostPath,
  formatLegacyBlogDate,
  historicalBlogImage,
  type PublicLegacyBlogPost,
} from '../runtime/legacy-blog'

export function LegacyBlogCard({ post, featured = false }: {
  post: PublicLegacyBlogPost
  featured?: boolean
}) {
  const image = historicalBlogImage(post.thumbnail_url ?? post.cover_image_url)
  const path = blogPostPath(post)
  return (
    <article className={`group overflow-hidden rounded-2xl border border-[#E4EEF2] bg-white shadow-sm ${featured ? 'flex flex-col md:flex-row' : 'flex h-full flex-col'}`}>
      <Link href={path} className={`block overflow-hidden bg-[#F5F9FB] ${featured ? 'h-[270px] w-full md:h-auto md:w-[55%]' : 'h-[230px] w-full'}`}>
        {image ? (
          // The legacy URLs are public assets; do not invoke a paid image optimizer.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={post.title} loading={featured ? 'eager' : 'lazy'}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <span className="flex h-full items-center justify-center px-5 text-center text-sm text-[#6A8A97]">
            Ảnh bài viết đang được khôi phục
          </span>
        )}
      </Link>
      <div className={`flex flex-1 flex-col p-6 ${featured ? 'justify-center md:p-9' : ''}`}>
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-[#6A8A97]">
          <Link href={`/blog/${post.category.slug}`}
            className="rounded-md bg-[#EAF6FB] px-3 py-1 font-semibold text-[#2E7A96]">
            {post.category.name}
          </Link>
          <time dateTime={post.published_at}>{formatLegacyBlogDate(post.published_at)}</time>
        </div>
        <Link href={path}>
          <h3 className={`mb-3 font-bold leading-snug text-[#192125] group-hover:text-[#2E7A96] ${featured ? 'text-2xl md:text-3xl' : 'text-xl'}`}>
            {post.title}
          </h3>
        </Link>
        {post.excerpt ? <p className="mb-5 line-clamp-3 leading-relaxed text-[#516A74]">{post.excerpt}</p> : null}
        <Link href={path} className="mt-auto text-sm font-semibold text-[#2E7A96] hover:underline">
          Đọc bài viết
        </Link>
      </div>
    </article>
  )
}
