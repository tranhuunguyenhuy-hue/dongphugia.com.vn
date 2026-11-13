import archive from './legacy-blog-snapshot.json'
import verifiedMedia from './legacy-blog-media.json'
import { getSnapshotBlogData } from './public-snapshot-catalogue'
import { usesPublicSnapshot } from './public-snapshot-mode'
import { safeImage } from '../../../../scripts/catalogue-direct/public-image-policy.mjs'

export type LegacyBlogCategory = {
  id: number
  name: string
  slug: string
  description: string | null
  thumbnail_url: string | null
  is_active: boolean
  sort_order: number
  seo_title: string | null
  seo_description: string | null
}
export type LegacyBlogPost = {
  id: number
  title: string
  slug: string
  content_md5?: string
  excerpt: string | null
  content: string
  category_id: number
  thumbnail_url: string | null
  cover_image_url: string | null
  seo_title: string | null
  seo_description: string | null
  reading_time: number | null
  status: string
  published_at: string
  author_name: string
  author_avatar: string | null
  is_featured: boolean
  is_pinned: boolean
  created_at: string | null
  updated_at: string | null
  category: LegacyBlogCategory
  source: 'archive' | 'database'
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
    return { ...post, category, source: 'archive' as const }
  })
  .sort((a, b) => b.published_at.localeCompare(a.published_at)
    || Number(b.is_pinned) - Number(a.is_pinned)
    || b.id - a.id)

export const blogCategoriesWithPosts = blogCategories.filter((category) =>
  blogPosts.some((post) => post.category_id === category.id),
)

export function mergePublicBlogData(snapshot: {
  categories: readonly LegacyBlogCategory[]
  posts: readonly Omit<LegacyBlogPost, 'source'>[]
}, legacyCategories: readonly LegacyBlogCategory[] = blogCategories,
legacyPosts: readonly LegacyBlogPost[] = blogPosts) {
  const categoriesBySlug = new Map<string, LegacyBlogCategory>(
    legacyCategories.map((category) => [category.slug, category]),
  )
  for (const category of snapshot.categories) {
    categoriesBySlug.set(category.slug, {
      ...category,
      thumbnail_url: category.thumbnail_url,
      is_active: true,
    })
  }
  const postByCanonicalPath = new Map<string, LegacyBlogPost>()
  for (const post of legacyPosts) {
    const category = categoriesBySlug.get(post.category.slug)
    if (category) postByCanonicalPath.set(blogPostPath({ ...post, category }), { ...post, category })
  }
  for (const post of snapshot.posts) {
    const category = categoriesBySlug.get(post.category.slug)
    if (!category) throw new Error('PUBLIC_BLOG_CATEGORY_MISSING')
    const projectedPost: LegacyBlogPost = { ...post, category, source: 'database' }
    postByCanonicalPath.set(blogPostPath(projectedPost), projectedPost)
  }

  const categories = [...categoriesBySlug.values()].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
  const posts = [...postByCanonicalPath.values()].sort((a, b) =>
    b.published_at.localeCompare(a.published_at)
    || Number(b.is_pinned) - Number(a.is_pinned)
    || b.id - a.id,
  )
  return {
    categories,
    posts,
    categoriesWithPosts: categories.filter((category) =>
      posts.some((post) => post.category.slug === category.slug),
    ),
  }
}

export async function getPublicBlogData() {
  if (!usesPublicSnapshot()) {
    return { categories: blogCategories, posts: blogPosts, categoriesWithPosts: blogCategoriesWithPosts }
  }
  const snapshot = await getSnapshotBlogData()
  return snapshot
    ? mergePublicBlogData(snapshot)
    : { categories: blogCategories, posts: blogPosts, categoriesWithPosts: blogCategoriesWithPosts }
}

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

// Every old-CDN Blog image in the frozen public snapshot was checked at the
// Bunny path on 2026-11-04 (HTTP 200, image/png). Keep the set exact.
const verifiedLegacyBlogFiles=new Set([
  '1782900856082-07fw89.png','1782900852828-h356on.png',
  '1782900583342-xau1gc.png','1782900595979-3no5dp.png',
  '1782900608836-cnlsev.png','1782900630678-xjhqn.png',
  '1782900645322-r9pwsj.png','1782900654935-1i96x.png',
  '1782901095727-dyj5rx.png','1782811960521-ubztwd.png',
  '1782811954060-lm1xt.png','1782811525156-t4ntyk.png',
  '1782811549421-g9ss0l.png','1782811563320-1quc5te.png',
])

// Preserve every historical media URL in the immutable public snapshot.
// Unknown / unsupported URL hosts are not embedded into the visible page.
const allowedMediaHosts = new Set([
  'tygjmrhandbffjllxveu.supabase.co',
])
const verifiedMediaUrls = new Set(verifiedMedia.assets.flatMap((asset) => [
  asset.sourceUrl,
  asset.deliveryUrl,
]))

export function historicalBlogImage(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return null
    if(url.hostname==='cdn.dongphugia.com.vn'&&url.search===''&&url.hash===''
      &&url.pathname.startsWith('/blog/')&&verifiedLegacyBlogFiles.has(url.pathname.slice(6)))
      return `https://dpg-products.b-cdn.net${url.pathname}`
    return allowedMediaHosts.has(url.hostname) || verifiedMediaUrls.has(url.href) ? url.href : null
  } catch {
    return null
  }
}

export function publicBlogImage(value: string | null | undefined, source: LegacyBlogPost['source'] = 'archive'): string | null {
  if (source === 'archive') return historicalBlogImage(value)
  const safe = safeImage(value)
  return safe?.startsWith('https://cdn.dongphugia.com.vn/')
    ? 'https://dpg-products.b-cdn.net/' + safe.slice('https://cdn.dongphugia.com.vn/'.length)
    : safe
}

export function restoreHistoricalBlogArticleLinks(html:string){
 return html.replace(/\b(src|href)=(['"])(.*?)\2/gi,(whole,attribute:string,quote:string,raw:string)=>{
  if(attribute.toLowerCase()==='src'){
   const restored=historicalBlogImage(raw)
   return restored?`src=${quote}${restored}${quote}`:whole
  }
  try{
   const url=new URL(raw.replaceAll('&amp;','&'))
   if(!['dongphugia.com.vn','www.dongphugia.com.vn'].includes(url.hostname)
     ||!['http:','https:'].includes(url.protocol))return whole
   url.searchParams.delete('sub')
   const target=`https://www.dongphugia.vn${url.pathname}${url.search}`.replaceAll('&','&amp;')
   return `href=${quote}${target}${quote}`
  }catch{return whole}
 })
}
