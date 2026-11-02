import archive from './legacy-blog-snapshot.json'
import verifiedMedia from './legacy-blog-media.json'

export type LegacyBlogCategory = (typeof archive.categories)[number]
export type LegacyBlogPost = (typeof archive.posts)[number] & {
  category: LegacyBlogCategory
}

if (archive.contract !== 'dpg:verified-legacy-blog-snapshot:v1') {
  throw new Error('LEGACY_BLOG_SNAPSHOT_CONTRACT_INVALID')
}

export const blogCategories: readonly LegacyBlogCategory[] = archive.categories
  .filter((category) => category.is_active)
  .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)

export const blogPosts: readonly LegacyBlogPost[] = archive.posts
  .filter((post) => post.status === 'published' && Boolean(post.published_at))
  .map((post) => {
    const category = blogCategories.find(({ id }) => id === post.category_id)
    if (!category) throw new Error('LEGACY_BLOG_CATEGORY_MISSING')
    return { ...post, category }
  })
  .sort((a, b) => b.published_at.localeCompare(a.published_at)
    || Number(b.is_pinned) - Number(a.is_pinned)
    || b.id - a.id)

export const blogCategoriesWithPosts = blogCategories.filter((category) =>
  blogPosts.some((post) => post.category_id === category.id),
)

export function getLegacyBlogCategory(slug: string) {
  return blogCategories.find((category) => category.slug === slug) ?? null
}

export function getLegacyBlogPostsForCategory(categorySlug: string) {
  return blogPosts.filter((post) => post.category.slug === categorySlug)
}

export function getLegacyBlogPost(categorySlug: string, postSlug: string) {
  return blogPosts.find((post) =>
    post.category.slug === categorySlug && post.slug === postSlug,
  ) ?? null
}

export function getLegacyBlogRelatedPosts(post: LegacyBlogPost, limit = 3) {
  return blogPosts.filter((other) =>
    other.id !== post.id && other.category_id === post.category_id,
  ).slice(0, limit)
}

export function formatLegacyBlogDate(value: string) {
  return new Date(value).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

export function blogPostPath(post: LegacyBlogPost) {
  return `/blog/${post.category.slug}/${post.slug}`
}

// Preserve every historical media URL in the immutable public snapshot.
// Unknown / unsupported URL hosts are not embedded into the visible page.
const allowedMediaHosts = new Set([
  'tygjmrhandbffjllxveu.supabase.co',
  'cdn.dongphugia.com.vn',
])
const verifiedMediaUrls = new Set(verifiedMedia.assets.flatMap((asset) => [
  asset.sourceUrl,
  asset.deliveryUrl,
]))

export function historicalBlogImage(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' &&
      (allowedMediaHosts.has(url.hostname) || verifiedMediaUrls.has(url.href)) ? url.href : null
  } catch {
    return null
  }
}
