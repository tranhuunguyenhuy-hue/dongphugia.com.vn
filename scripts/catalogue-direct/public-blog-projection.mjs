import { publicDescriptionHtml, publicText } from './public-product-content.mjs'
import { safeImage } from './public-image-policy.mjs'

export const PUBLIC_BLOG_PROJECTION_CONTRACT = 'dpg:public-blog-snapshot:v1'
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function isoDate(value) {
  if (value === null || value === undefined) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function safeId(value) {
  return Number.isSafeInteger(value) && value > 0
}

// Project only explicitly selected public editorial fields. Database status,
// scheduling, author identity, tags, audit data and staff metadata never pass
// through this serializer.
export function projectPublicBlog({ categories, posts, asOf }) {
  const projectionTime = isoDate(asOf)
  if (!projectionTime || !Array.isArray(categories) || !Array.isArray(posts)) {
    throw new Error('PUBLIC_BLOG_PROJECTION_INPUT_INVALID')
  }

  const categoryById = new Map()
  const categorySlugs = new Set()
  const projectedCategories = []
  for (const row of categories) {
    if (!row || row.is_active !== true || !safeId(row.id)
      || typeof row.slug !== 'string' || !SLUG.test(row.slug)) continue
    if (categoryById.has(row.id) || categorySlugs.has(row.slug)) {
      throw new Error('PUBLIC_BLOG_CATEGORY_DUPLICATE')
    }
    const name = publicText(row.name, 100)
    if (!name) continue
    const category = {
      id: row.id,
      name,
      slug: row.slug,
      description: publicText(row.description, 1200),
      thumbnail_url: safeImage(row.thumbnail_url),
      seo_title: publicText(row.seo_title, 200),
      seo_description: publicText(row.seo_description, 500),
      sort_order: Number.isSafeInteger(row.sort_order) ? row.sort_order : 0,
      is_active: true,
    }
    categoryById.set(row.id, category)
    categorySlugs.add(row.slug)
    projectedCategories.push(category)
  }

  const seenPaths = new Set()
  const projectedPosts = []
  for (const row of posts) {
    if (!row || row.status !== 'published' || !safeId(row.id)
      || typeof row.slug !== 'string' || !SLUG.test(row.slug)) continue
    const category = categoryById.get(row.category_id)
    if (!category) continue
    const publishedAt = isoDate(row.published_at)
    if (!publishedAt || publishedAt > projectionTime) continue
    const title = publicText(row.title, 300)
    const content = publicDescriptionHtml(row.content)
    if (!title || !content) continue
    const path = `/blog/${category.slug}/${row.slug}`
    if (seenPaths.has(path)) throw new Error('PUBLIC_BLOG_DUPLICATE_CANONICAL_PATH')
    seenPaths.add(path)
    projectedPosts.push({
      id: row.id,
      title,
      slug: row.slug,
      excerpt: publicText(row.excerpt, 1200),
      content,
      category_id: category.id,
      thumbnail_url: safeImage(row.thumbnail_url),
      cover_image_url: safeImage(row.cover_image_url),
      seo_title: publicText(row.seo_title, 200),
      seo_description: publicText(row.seo_description, 500),
      reading_time: Number.isSafeInteger(row.reading_time) && row.reading_time > 0 && row.reading_time <= 240
        ? row.reading_time : null,
      status: 'published',
      published_at: publishedAt,
      author_name: 'Đông Phú Gia',
      author_avatar: null,
      is_featured: row.is_featured === true,
      is_pinned: row.is_pinned === true,
      created_at: isoDate(row.created_at),
      updated_at: isoDate(row.updated_at),
      category,
    })
  }

  projectedCategories.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
  projectedPosts.sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned)
    || b.published_at.localeCompare(a.published_at) || b.id - a.id)

  return {
    contract: PUBLIC_BLOG_PROJECTION_CONTRACT,
    asOf: projectionTime,
    categories: projectedCategories,
    posts: projectedPosts,
  }
}

export function buildPublicBlogAsset(projection, checkpoint, catalogueContract) {
  if (!projection || projection.contract !== PUBLIC_BLOG_PROJECTION_CONTRACT
    || !/^[a-f0-9]{40}$/.test(checkpoint)
    || typeof catalogueContract !== 'string' || !catalogueContract) {
    throw new Error('PUBLIC_BLOG_ASSET_EVIDENCE_INVALID')
  }
  const asset = {
    contract: catalogueContract,
    checkpoint,
    blogContract: projection.contract,
    asOf: projection.asOf,
    categories: projection.categories,
    posts: projection.posts,
  }
  if (Buffer.byteLength(JSON.stringify(asset)) > 2_000_000) {
    throw new Error('PUBLIC_BLOG_ASSET_CAPACITY')
  }
  return asset
}
