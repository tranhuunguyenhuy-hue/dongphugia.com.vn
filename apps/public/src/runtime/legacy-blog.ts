import archive from './legacy-blog-snapshot.json'
import verifiedMedia from './legacy-blog-media.json'

export type LegacyBlogCategory = (typeof archive.categories)[number]
export type LegacyBlogPost = (typeof archive.posts)[number] & {
  category: LegacyBlogCategory
}
export type PublicLegacyBlogPost = Pick<LegacyBlogPost,
  | 'id' | 'title' | 'slug' | 'excerpt' | 'content' | 'category_id'
  | 'thumbnail_url' | 'cover_image_url' | 'seo_title' | 'seo_description'
  | 'reading_time' | 'status' | 'published_at' | 'author_name' | 'updated_at'
> & { category: LegacyBlogCategory }

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

export function blogPostPath(post: Pick<PublicLegacyBlogPost, 'category' | 'slug'>) {
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
