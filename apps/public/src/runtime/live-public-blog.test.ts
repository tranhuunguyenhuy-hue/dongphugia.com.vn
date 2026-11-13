import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ enabled: false, readPublicRows: vi.fn() }))
vi.mock('./public-db', () => ({
  publicPostgresEnabled: () => mocks.enabled,
  readPublicRows: mocks.readPublicRows,
}))

import { getPublicBlogCategories, getPublicBlogPosts } from './live-public-blog'

describe('live public Blog projection', () => {
  beforeEach(() => {
    mocks.enabled = true
    mocks.readPublicRows.mockReset()
  })

  it('keeps the rollback snapshot behind the same narrow Public DTO', async () => {
    mocks.enabled = false
    const posts = await getPublicBlogPosts()
    expect(posts).toHaveLength(10)
    expect(posts.every((post) => post.status === 'published')).toBe(true)
    expect(posts[0]).not.toHaveProperty('content_md5')
    expect(posts[0]).not.toHaveProperty('view_count')
    expect(mocks.readPublicRows).not.toHaveBeenCalled()
  })

  it('selects only public article fields, filters published rows and drops internal publishing metadata', async () => {
    mocks.readPublicRows.mockResolvedValueOnce([{
      post: {
        id: 17,
        title: 'Bài viết công khai',
        slug: 'bai-viet-cong-khai',
        excerpt: 'Tóm tắt',
        content: '<p>Nội dung</p>',
        category_id: 3,
        thumbnail_url: null,
        cover_image_url: null,
        seo_title: null,
        seo_description: null,
        seo_keywords: null,
        reading_time: 4,
        view_count: 12,
        status: 'published',
        published_at: '2026-08-26T00:00:00.000Z',
        author_name: 'Đông Phú Gia',
        author_avatar: null,
        is_featured: false,
        is_pinned: true,
        created_at: '2026-08-25T00:00:00.000Z',
        updated_at: '2026-08-26T00:00:00.000Z',
        publishing_identity_id: 'private-id',
        scheduled_for: '2026-09-01T00:00:00.000Z',
      },
      category: {
        id: 3,
        name: 'Tin tức',
        slug: 'tin-tuc',
        description: null,
        thumbnail_url: null,
        is_active: true,
        sort_order: 1,
        seo_title: null,
        seo_description: null,
        created_at: '2026-08-01T00:00:00.000Z',
      },
    }])

    const posts = await getPublicBlogPosts()
    const statement = mocks.readPublicRows.mock.calls[0][0] as string
    expect(statement).toContain("p.status = 'published'")
    expect(statement).toContain('p.published_at DESC, p.is_pinned DESC, p.id DESC')
    expect(statement).not.toContain('to_jsonb(')
    expect(statement).not.toContain('publishing_identity_id')
    expect(statement).not.toContain('scheduled_for')
    expect(posts[0]).toMatchObject({ id: 17, slug: 'bai-viet-cong-khai', status: 'published', category: { slug: 'tin-tuc' } })
    expect(posts[0]).not.toHaveProperty('publishing_identity_id')
    expect(posts[0]).not.toHaveProperty('scheduled_for')
    expect(posts[0]).not.toHaveProperty('content_md5')
    expect(posts[0]).not.toHaveProperty('is_pinned')
  })

  it('reads only active categories through an explicit public projection', async () => {
    mocks.readPublicRows.mockResolvedValueOnce([])
    await expect(getPublicBlogCategories()).resolves.toEqual([])
    const statement = mocks.readPublicRows.mock.calls[0][0] as string
    expect(statement).toContain('WHERE is_active = true')
    expect(statement).toContain('seo_description')
    expect(statement).not.toContain('created_at')
    expect(statement).not.toContain('updated_at')
  })
})
