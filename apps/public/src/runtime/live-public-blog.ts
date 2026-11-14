import { cache } from 'react'
import { publicPostgresEnabled, readPublicRows } from './public-db'
import {
  blogPosts as snapshotPosts,
  blogCategories as snapshotCategories,
  type LegacyBlogPost,
  type PublicLegacyBlogPost,
  type LegacyBlogCategory,
} from './legacy-blog'

type PublicBlogPostRow = Pick<LegacyBlogPost,
  | 'id' | 'title' | 'slug' | 'excerpt' | 'content' | 'category_id'
  | 'thumbnail_url' | 'cover_image_url' | 'seo_title' | 'seo_description'
  | 'reading_time' | 'status' | 'published_at' | 'author_name' | 'updated_at'
>
type BlogRecord = { post: PublicBlogPostRow; category: LegacyBlogCategory }

const LIVE_BLOG = `
 SELECT jsonb_build_object(
   'id',p.id,'title',p.title,'slug',p.slug,'excerpt',p.excerpt,'content',p.content,
   'category_id',p.category_id,'thumbnail_url',p.thumbnail_url,'cover_image_url',p.cover_image_url,
   'seo_title',p.seo_title,'seo_description',p.seo_description,
   'reading_time',p.reading_time,'status',p.status,
   'published_at',p.published_at,'author_name',p.author_name,'updated_at',p.updated_at
 ) AS post,
 jsonb_build_object(
   'id',c.id,'name',c.name,'slug',c.slug,'description',c.description,
   'thumbnail_url',c.thumbnail_url,'is_active',c.is_active,'sort_order',c.sort_order,
   'seo_title',c.seo_title,'seo_description',c.seo_description
 ) AS category
 FROM dpg_app.blog_posts p
 JOIN dpg_app.blog_categories c ON c.id = p.category_id
 WHERE p.status = 'published' AND p.published_at IS NOT NULL AND c.is_active = true
 ORDER BY p.published_at DESC, p.is_pinned DESC, p.id DESC
 LIMIT 100
`

function projectPublicBlogPost(post: PublicBlogPostRow, category: LegacyBlogCategory): PublicLegacyBlogPost {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    content: post.content,
    category_id: post.category_id,
    thumbnail_url: post.thumbnail_url,
    cover_image_url: post.cover_image_url,
    seo_title: post.seo_title,
    seo_description: post.seo_description,
    reading_time: post.reading_time,
    status: post.status,
    published_at: post.published_at,
    author_name: post.author_name,
    updated_at: post.updated_at,
    category,
  }
}

export const getPublicBlogPosts = cache(async (): Promise<readonly PublicLegacyBlogPost[]> => {
  if (!publicPostgresEnabled()) return snapshotPosts.map(({category, ...post}) => projectPublicBlogPost(post, category))
  const rows = await readPublicRows<BlogRecord>(LIVE_BLOG)
  // Fail closed on malformed source data; do not silently display an obsolete snapshot.
  return rows.map(({post, category}) => {
    if (!Number.isSafeInteger(post.id) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug)
      || typeof post.title !== 'string' || typeof post.content !== 'string'
      || post.status !== 'published' || !post.published_at
      || !Number.isSafeInteger(category.id) || typeof category.slug !== 'string'
      || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category.slug) || category.is_active !== true) {
      throw new Error('PUBLIC_BLOG_SOURCE_INVALID')
    }
    return projectPublicBlogPost(post, category)
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
export async function getPublicBlogRelatedPosts(post: PublicLegacyBlogPost, limit = 3) {
  return (await getPublicBlogPosts()).filter(other =>
    other.id !== post.id && other.category_id === post.category_id).slice(0, limit)
}
