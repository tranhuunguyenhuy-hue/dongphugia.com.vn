import { cache } from 'react'
import { publicPostgresEnabled, readPublicRows } from './public-db'
import {
  blogPosts as snapshotPosts,
  blogCategories as snapshotCategories,
  type LegacyBlogPost,
  type LegacyBlogCategory,
} from './legacy-blog'

type BlogRecord = {
  post: Record<string, unknown>
  category: LegacyBlogCategory
}

const LIVE_BLOG = `
 SELECT to_jsonb(p) AS post, to_jsonb(c) AS category
 FROM dpg_app.blog_posts p
 JOIN dpg_app.blog_categories c ON c.id = p.category_id
 WHERE p.status = 'published' AND p.published_at IS NOT NULL AND c.is_active = true
 ORDER BY p.published_at DESC, p.id DESC
 LIMIT 100
`

export const getPublicBlogPosts = cache(async (): Promise<readonly LegacyBlogPost[]> => {
  if (!publicPostgresEnabled()) return snapshotPosts
  const rows = await readPublicRows<BlogRecord>(LIVE_BLOG)
  // Fail closed on malformed source data; do not silently display an obsolete snapshot.
  return rows.map(({post, category}) => {
    if (!Number.isSafeInteger(post.id) || typeof post.slug !== 'string'
      || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug)
      || typeof post.title !== 'string' || typeof post.content !== 'string'
      || post.status !== 'published'
      || !category || typeof category.slug !== 'string') {
      throw new Error('PUBLIC_BLOG_SOURCE_INVALID')
    }
    return { ...post, content_md5: '', category } as LegacyBlogPost
  })
})

export const getPublicBlogCategories = cache(async (): Promise<readonly LegacyBlogCategory[]> => {
  if (!publicPostgresEnabled()) return snapshotCategories
  // Empty categories are intentional on old website; read those from DB too.
  const rows = await readPublicRows<LegacyBlogCategory>(`
    SELECT id,name,slug,description,thumbnail_url,is_active,sort_order,seo_title,seo_description
    FROM dpg_app.blog_categories WHERE is_active = true ORDER BY sort_order,id
    LIMIT 100
  `)
  return rows
})

export async function getPublicBlogCategory(slug: string) {
  return (await getPublicBlogCategories()).find((category) => category.slug === slug) ?? null
}
export async function getPublicBlogPostsForCategory(slug: string) {
  return (await getPublicBlogPosts()).filter((post) => post.category.slug === slug)
}
export async function getPublicBlogPost(categorySlug: string, postSlug: string) {
  return (await getPublicBlogPosts()).find((post) =>
    post.category.slug === categorySlug && post.slug === postSlug) ?? null
}
export async function getPublicBlogRelatedPosts(post: LegacyBlogPost, limit = 3) {
  return (await getPublicBlogPosts()).filter(other =>
    other.id !== post.id && other.category_id === post.category_id).slice(0, limit)
}
