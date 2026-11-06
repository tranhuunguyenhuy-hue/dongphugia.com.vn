export type AdminBlogCategory = Readonly<{ id: number; name: string; slug: string }>
export type AdminBlogSummary = Readonly<{
  id: number
  title: string
  slug: string
  status: 'draft' | 'scheduled' | 'published' | 'schedule_blocked'
  version: number
  published_at: string | null
  updated_at: string
  thumbnail_url: string | null
  cover_image_url: string | null
}>
export type AdminBlogPost = AdminBlogSummary & Readonly<{
  excerpt: string | null
  content: string
  category_id: number
  seo_title: string | null
  seo_description: string | null
  seo_keywords: string | null
  author_name: string
}>

export type AdminBanner = Readonly<{
  id: number
  title: string | null
  image_url: string
  link_url: string | null
  is_active: boolean
  sort_order: number
}>
export type AdminPartner = Readonly<{
  id: number
  name: string
  logo_url: string | null
  link_url: string | null
  is_active: boolean | null
  sort_order: number | null
}>
export type AdminProject = Readonly<{
  id: number
  title: string
  thumbnail_url: string | null
  is_active: boolean | null
  is_featured: boolean | null
  sort_order: number | null
}>
export type AdminManagedContent = Readonly<{
  banners: AdminBanner[]
  partners: AdminPartner[]
  projects: AdminProject[]
}>

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function positiveInteger(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isSafeInteger(number) && number > 0 ? number : null
}

function optionalString(value: unknown): string | null | undefined {
  if (value === null) return null
  return typeof value === 'string' ? value : undefined
}

function optionalInteger(value: unknown): number | null | undefined {
  if (value === null) return null
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isSafeInteger(number) ? number : undefined
}

function status(value: unknown): AdminBlogSummary['status'] | null {
  return value === 'draft' || value === 'scheduled' || value === 'published' || value === 'schedule_blocked'
    ? value : null
}

function parseBlogSummary(value: unknown): AdminBlogSummary | null {
  const row = record(value)
  const id = positiveInteger(row?.id)
  const version = positiveInteger(row?.version)
  const publishedAt = optionalString(row?.published_at)
  const thumbnailUrl = optionalString(row?.thumbnail_url)
  const coverImageUrl = optionalString(row?.cover_image_url)
  if (!row || id === null || version === null || typeof row.title !== 'string' || typeof row.slug !== 'string'
    || status(row.status) === null || publishedAt === undefined
    || (publishedAt !== null && !Number.isFinite(Date.parse(publishedAt)))
    || typeof row.updated_at !== 'string' || !Number.isFinite(Date.parse(row.updated_at))
    || thumbnailUrl === undefined || coverImageUrl === undefined) return null
  return {
    id, title: row.title, slug: row.slug, status: status(row.status)!, version,
    published_at: publishedAt, updated_at: row.updated_at,
    thumbnail_url: thumbnailUrl, cover_image_url: coverImageUrl,
  }
}

export function parseAdminBlogSummaries(value: unknown): AdminBlogSummary[] | null {
  if (!Array.isArray(value) || value.length > 100) return null
  const posts = value.map(parseBlogSummary)
  return posts.some((post) => post === null) ? null : posts as AdminBlogSummary[]
}

export function parseAdminBlogPost(value: unknown): AdminBlogPost | null {
  const row = record(value)
  const summary = parseBlogSummary(value)
  const categoryId = positiveInteger(row?.category_id)
  const excerpt = optionalString(row?.excerpt)
  const content = row?.content
  const seoTitle = optionalString(row?.seo_title)
  const seoDescription = optionalString(row?.seo_description)
  const seoKeywords = optionalString(row?.seo_keywords)
  if (!summary || !row || categoryId === null || excerpt === undefined || typeof content !== 'string'
    || seoTitle === undefined || seoDescription === undefined || seoKeywords === undefined
    || typeof row.author_name !== 'string') return null
  return {
    ...summary, category_id: categoryId, excerpt, content,
    seo_title: seoTitle, seo_description: seoDescription, seo_keywords: seoKeywords,
    author_name: row.author_name,
  }
}

export function parseAdminBlogCategories(value: unknown): AdminBlogCategory[] | null {
  if (!Array.isArray(value) || value.length > 200) return null
  const categories = value.map((candidate) => {
    const row = record(candidate)
    const id = positiveInteger(row?.id)
    return row && id !== null && typeof row.name === 'string' && typeof row.slug === 'string'
      ? { id, name: row.name, slug: row.slug }
      : null
  })
  return categories.some((category) => category === null) ? null : categories as AdminBlogCategory[]
}

function parseBanners(value: unknown): AdminBanner[] | null {
  if (!Array.isArray(value) || value.length > 200) return null
  const result = value.map((candidate) => {
    const row = record(candidate)
    const id = positiveInteger(row?.id)
    const sortOrder = optionalInteger(row?.sort_order)
    const linkUrl = optionalString(row?.link_url)
    if (!row || id === null || (row.title !== null && typeof row.title !== 'string')
      || typeof row.image_url !== 'string' || typeof row.is_active !== 'boolean'
      || sortOrder === undefined || sortOrder === null || linkUrl === undefined) return null
    return { id, title: row.title as string | null, image_url: row.image_url, link_url: linkUrl, is_active: row.is_active, sort_order: sortOrder }
  })
  return result.some((item) => item === null) ? null : result as AdminBanner[]
}

function parsePartners(value: unknown): AdminPartner[] | null {
  if (!Array.isArray(value) || value.length > 200) return null
  const result = value.map((candidate) => {
    const row = record(candidate)
    const id = positiveInteger(row?.id)
    const logoUrl = optionalString(row?.logo_url)
    const linkUrl = optionalString(row?.link_url)
    const isActive = row?.is_active === null ? null : typeof row?.is_active === 'boolean' ? row.is_active : undefined
    const sortOrder = optionalInteger(row?.sort_order)
    if (!row || id === null || typeof row.name !== 'string' || logoUrl === undefined || linkUrl === undefined
      || isActive === undefined || sortOrder === undefined) return null
    return { id, name: row.name, logo_url: logoUrl, link_url: linkUrl, is_active: isActive, sort_order: sortOrder }
  })
  return result.some((item) => item === null) ? null : result as AdminPartner[]
}

function parseProjects(value: unknown): AdminProject[] | null {
  if (!Array.isArray(value) || value.length > 200) return null
  const result = value.map((candidate) => {
    const row = record(candidate)
    const id = positiveInteger(row?.id)
    const thumbnailUrl = optionalString(row?.thumbnail_url)
    const isActive = row?.is_active === null ? null : typeof row?.is_active === 'boolean' ? row.is_active : undefined
    const isFeatured = row?.is_featured === null ? null : typeof row?.is_featured === 'boolean' ? row.is_featured : undefined
    const sortOrder = optionalInteger(row?.sort_order)
    if (!row || id === null || typeof row.title !== 'string' || thumbnailUrl === undefined
      || isActive === undefined || isFeatured === undefined || sortOrder === undefined) return null
    return { id, title: row.title, thumbnail_url: thumbnailUrl, is_active: isActive, is_featured: isFeatured, sort_order: sortOrder }
  })
  return result.some((item) => item === null) ? null : result as AdminProject[]
}

export function parseAdminManagedContent(value: unknown): AdminManagedContent | null {
  const row = record(value)
  const banners = parseBanners(row?.banners)
  const partners = parsePartners(row?.partners)
  const projects = parseProjects(row?.projects)
  return banners && partners && projects ? { banners, partners, projects } : null
}

export function validateAdminBlogSlug(value: string): boolean {
  return value.length <= 300 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
}
