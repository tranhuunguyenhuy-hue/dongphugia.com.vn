import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { requireActiveStaff, getAdminBlogCategories, getAdminBlogPost, createAdminServerClient, rpc, redirect, revalidatePath } = vi.hoisted(() => ({
  requireActiveStaff: vi.fn(), getAdminBlogCategories: vi.fn(), getAdminBlogPost: vi.fn(),
  createAdminServerClient: vi.fn(), rpc: vi.fn(), redirect: vi.fn(), revalidatePath: vi.fn(),
}))

vi.mock('../../src/auth/require-staff', () => ({ requireActiveStaff }))
vi.mock('../../src/cms/queries', () => ({ getAdminBlogCategories, getAdminBlogPost }))
vi.mock('../../src/supabase/server', () => ({ createAdminServerClient }))
vi.mock('next/navigation', () => ({ redirect }))
vi.mock('next/cache', () => ({ revalidatePath }))

import { saveAdminBlogPost, updateAdminContent } from './actions'

const current = {
  id: 12, title: 'Bài thử', slug: 'bai-thu', status: 'draft', version: 2, published_at: null,
  updated_at: '2026-11-06T10:00:00Z', thumbnail_url: null, cover_image_url: null, excerpt: null,
  content: '<p>Old</p>', category_id: 3, seo_title: null, seo_description: null,
  seo_keywords: null, author_name: 'Synthetic',
}

function blogForm() {
  const form = new FormData()
  form.set('postId', '12'); form.set('version', '2'); form.set('idempotencyKey', '01234567-89ab-4cde-8f01-234567890abc')
  form.set('title', 'Bài thử cập nhật'); form.set('slug', 'bai-thu'); form.set('excerpt', 'Synthetic excerpt')
  form.set('content', '<p>Safe test content</p>'); form.set('categoryId', '3'); form.set('thumbnailUrl', '')
  form.set('coverImageUrl', ''); form.set('seoTitle', ''); form.set('seoDescription', ''); form.set('status', 'draft')
  return form
}

describe('Admin CMS actions', () => {
  beforeEach(() => {
    requireActiveStaff.mockReset().mockResolvedValue({ capabilities: ['blog:read', 'blog:write', 'categories:read', 'categories:write'] })
    getAdminBlogPost.mockReset().mockResolvedValue(current)
    getAdminBlogCategories.mockReset().mockResolvedValue([{ id: 3, name: 'Tin tức', slug: 'tin-tuc' }])
    rpc.mockReset().mockResolvedValue({ error: null })
    createAdminServerClient.mockReset().mockResolvedValue({ schema: () => ({ rpc }) })
    redirect.mockReset().mockImplementation((path: string) => { throw new Error(`REDIRECT:${path}`) })
    revalidatePath.mockReset()
  })

  it('denies Blog writes and invalid slugs before the RPC', async () => {
    requireActiveStaff.mockResolvedValueOnce({ capabilities: ['blog:read'] })
    await expect(saveAdminBlogPost(blogForm())).rejects.toThrow('REDIRECT:/blog?error=forbidden')
    const invalid = blogForm(); invalid.set('slug', '../unsafe')
    await expect(saveAdminBlogPost(invalid)).rejects.toThrow('REDIRECT:/blog/12?error=invalid')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('uses the audited versioned Blog RPC after validating the active category', async () => {
    await expect(saveAdminBlogPost(blogForm())).rejects.toThrow('REDIRECT:/blog/12?saved=1')
    expect(rpc).toHaveBeenCalledWith('leo542_admin_blog_put', expect.objectContaining({
      p_post_id: 12, p_expected_version: 2,
      p_input: expect.objectContaining({ title: 'Bài thử cập nhật', slug: 'bai-thu', category_id: 3, status: 'draft' }),
    }))
    expect(revalidatePath).toHaveBeenCalledWith('/blog')
  })

  it('requires the publish capability and rejects a stale Blog version', async () => {
    requireActiveStaff.mockResolvedValueOnce({ capabilities: ['blog:read', 'blog:write'] })
    const publishForm = blogForm(); publishForm.set('status', 'published')
    await expect(saveAdminBlogPost(publishForm)).rejects.toThrow('REDIRECT:/blog/12?error=forbidden')
    getAdminBlogPost.mockResolvedValueOnce({ ...current, version: 4 })
    await expect(saveAdminBlogPost(blogForm())).rejects.toThrow('REDIRECT:/blog/12?error=stale')
  })

  it('checks Site Content capability and sends only allowlisted module fields', async () => {
    requireActiveStaff.mockResolvedValueOnce({ capabilities: ['categories:read'] })
    const form = new FormData(); form.set('resource', 'project'); form.set('id', '8'); form.set('title', 'Synthetic project'); form.set('sortOrder', '4'); form.set('isActive', 'on'); form.set('isFeatured', 'on')
    await expect(updateAdminContent(form)).rejects.toThrow('REDIRECT:/content?error=forbidden')
    requireActiveStaff.mockResolvedValueOnce({ capabilities: ['categories:read', 'categories:write'] })
    await expect(updateAdminContent(form)).rejects.toThrow('REDIRECT:/content?saved=1')
    expect(rpc).toHaveBeenCalledWith('leo542_admin_content_patch', expect.objectContaining({
      p_resource: 'project', p_id: 8,
      p_patch: { title: 'Synthetic project', is_active: true, sort_order: 4, is_featured: true },
    }))
  })

  it('rejects missing required site-content names before an RPC write', async () => {
    requireActiveStaff.mockResolvedValueOnce({ capabilities: ['categories:read', 'categories:write'] })
    const form = new FormData(); form.set('resource', 'partner'); form.set('id', '8'); form.set('title', '  '); form.set('sortOrder', '1')
    await expect(updateAdminContent(form)).rejects.toThrow('REDIRECT:/content?error=invalid')
    expect(rpc).not.toHaveBeenCalled()
  })
})
