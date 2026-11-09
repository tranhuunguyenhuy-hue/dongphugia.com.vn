'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireActiveStaff } from '../../src/auth/require-staff'
import { getAdminBlogCategories, getAdminBlogPost } from '../../src/cms/queries'
import { validateAdminBlogSlug } from '../../src/cms/contracts'
import { createAdminServerClient } from '../../src/supabase/server'

function textField(formData: FormData, name: string, maxLength: number): string | null {
  const value = formData.get(name)
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length <= maxLength && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(normalized)
    ? normalized : null
}

function mediaUrl(value: string): boolean {
  if (!value) return true
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) return true
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password
  } catch {
    return false
  }
}

export async function saveAdminBlogPost(formData: FormData): Promise<never> {
  const staff = await requireActiveStaff()
  const rawId = formData.get('postId')
  const id = rawId === '' ? null : Number(rawId)
  const expectedVersion = Number(formData.get('version'))
  const idempotencyKey = formData.get('idempotencyKey')
  const destination = id && Number.isSafeInteger(id) ? `/blog/${id}` : '/blog/new'
  if (!staff.capabilities.includes('blog:read') || !staff.capabilities.includes('blog:write')) {
    redirect('/blog?error=forbidden')
  }
  if ((id !== null && (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1))
    || typeof idempotencyKey !== 'string' || !/^[a-f0-9-]{36}$/i.test(idempotencyKey)) {
    redirect(`${destination}?error=invalid`)
  }

  const current = id === null ? null : await getAdminBlogPost(id)
  if (id !== null && !current) redirect('/blog?error=unavailable')
  if (current && current.version !== expectedVersion) redirect(`${destination}?error=stale`)

  const title = textField(formData, 'title', 300)
  const slug = textField(formData, 'slug', 300)
  const excerpt = textField(formData, 'excerpt', 3000)
  const content = formData.get('content')
  const categoryId = Number(formData.get('categoryId'))
  const thumbnailUrl = textField(formData, 'thumbnailUrl', 1000)
  const coverImageUrl = textField(formData, 'coverImageUrl', 1000)
  const seoTitle = textField(formData, 'seoTitle', 200)
  const seoDescription = textField(formData, 'seoDescription', 500)
  const requestedStatus = formData.get('status')
  const status = typeof requestedStatus === 'string' ? requestedStatus : null
  const isSupportedStatus = status === 'draft' || status === 'published'
    || (current && status === current.status && ['scheduled', 'schedule_blocked'].includes(current.status))
  if (!title || !slug || (!validateAdminBlogSlug(slug) && slug !== current?.slug)
    || excerpt === null || typeof content !== 'string' || content.length > 100_000
    || !Number.isSafeInteger(categoryId) || categoryId < 1
    || thumbnailUrl === null || coverImageUrl === null
    || (!mediaUrl(thumbnailUrl) && thumbnailUrl !== current?.thumbnail_url)
    || (!mediaUrl(coverImageUrl) && coverImageUrl !== current?.cover_image_url)
    || seoTitle === null || seoDescription === null || !isSupportedStatus) {
    redirect(`${destination}?error=invalid`)
  }
  if (status === 'published' && !staff.capabilities.includes('blog:publish')) {
    redirect(`${destination}?error=forbidden`)
  }
  const categories = await getAdminBlogCategories()
  if (!categories?.some((category) => category.id === categoryId)) redirect(`${destination}?error=category`)

  const input = {
    title, slug, excerpt, content, category_id: categoryId,
    thumbnail_url: thumbnailUrl || null, cover_image_url: coverImageUrl || null,
    seo_title: seoTitle || null, seo_description: seoDescription || null, status,
  }
  const client = await createAdminServerClient()
  const { error } = await client.schema('public').rpc('leo542_admin_blog_put', {
    p_post_id: id,
    p_expected_version: id === null ? null : expectedVersion,
    p_input: input,
    p_idempotency_key: idempotencyKey,
    p_request_id: crypto.randomUUID(),
  })
  if (error) {
    const message = error.message || ''
    if (message.includes('STALE_VERSION')) redirect(`${destination}?error=stale`)
    if (message.includes('FORBIDDEN')) redirect(`${destination}?error=forbidden`)
    if (message.includes('IDEMPOTENCY_KEY_REUSED')) redirect(`${destination}?error=retry`)
    if (message.includes('RESOURCE_NOT_FOUND')) redirect('/blog?error=unavailable')
    redirect(`${destination}?error=save`)
  }
  revalidatePath('/blog')
  revalidatePath('/blog/[id]')
  redirect(id === null ? '/blog?saved=created' : `${destination}?saved=1`)
}

export async function updateAdminContent(formData: FormData): Promise<never> {
  const staff = await requireActiveStaff()
  const resource = formData.get('resource')
  const id = Number(formData.get('id'))
  if (!staff.capabilities.includes('categories:read') || !staff.capabilities.includes('categories:write')) {
    redirect('/content?error=forbidden')
  }
  if (!['banner', 'partner', 'project'].includes(String(resource)) || !Number.isSafeInteger(id) || id < 1) {
    redirect('/content?error=invalid')
  }
  const titleKey = resource === 'partner' ? 'name' : 'title'
  const title = textField(formData, 'title', 200)
  const sortOrder = Number(formData.get('sortOrder'))
  if (title === null || (resource !== 'banner' && title.length === 0)
    || !Number.isSafeInteger(sortOrder) || sortOrder < 0 || sortOrder > 100_000) {
    redirect('/content?error=invalid')
  }
  const patch: Record<string, unknown> = {
    [titleKey]: title,
    is_active: formData.get('isActive') === 'on',
    sort_order: sortOrder,
  }
  if (resource === 'project') patch.is_featured = formData.get('isFeatured') === 'on'

  const client = await createAdminServerClient()
  const { error } = await client.schema('public').rpc('leo542_admin_content_patch', {
    p_resource: resource,
    p_id: id,
    p_patch: patch,
    p_idempotency_key: crypto.randomUUID(),
    p_request_id: crypto.randomUUID(),
  })
  if (error) redirect(error.message?.includes('FORBIDDEN') ? '/content?error=forbidden' : '/content?error=save')
  revalidatePath('/content')
  redirect('/content?saved=1')
}
