import { describe, expect, it } from 'vitest'

import {
  parseAdminBlogCategories,
  parseAdminBlogPost,
  parseAdminBlogSummaries,
  parseAdminManagedContent,
  validateAdminBlogSlug,
} from './contracts'

const summary = {
  id: 12, title: 'Bài thử', slug: 'bai-thu', status: 'draft', version: 2,
  published_at: null, updated_at: '2026-11-06T10:00:00Z', thumbnail_url: null, cover_image_url: null,
}

describe('Admin CMS boundary contracts', () => {
  it('parses bounded Blog summaries, details and active categories', () => {
    expect(parseAdminBlogSummaries([summary])).toEqual([summary])
    expect(parseAdminBlogPost({ ...summary, category_id: 3, excerpt: null, content: '<p>Synthetic</p>',
      seo_title: null, seo_description: null, seo_keywords: null, author_name: 'Synthetic' })?.content).toBe('<p>Synthetic</p>')
    expect(parseAdminBlogCategories([{ id: 3, name: 'Tin tức', slug: 'tin-tuc' }])).toEqual([
      { id: 3, name: 'Tin tức', slug: 'tin-tuc' },
    ])
  })

  it('fails closed on malformed or oversized data', () => {
    expect(parseAdminBlogSummaries([{ ...summary, id: 'not-an-id' }])).toBeNull()
    expect(parseAdminBlogCategories(Array.from({ length: 201 }, (_, index) => ({ id: index + 1, name: 'x', slug: 'x' })))).toBeNull()
    expect(parseAdminBlogPost({ ...summary, category_id: 0, content: '' })).toBeNull()
  })

  it('parses only bounded content modules and validates safe article slugs', () => {
    expect(parseAdminManagedContent({
      banners: [{ id: 1, title: 'Banner', image_url: 'https://example.test/a.jpg', link_url: null, is_active: true, sort_order: 1 }],
      partners: [], projects: [],
    })?.banners).toHaveLength(1)
    expect(parseAdminManagedContent({ banners: [{ id: -1 }], partners: [], projects: [] })).toBeNull()
    expect(validateAdminBlogSlug('bai-viet-phase-2')).toBe(true)
    expect(validateAdminBlogSlug('javascript:alert')).toBe(false)
    expect(validateAdminBlogSlug('../unsafe')).toBe(false)
  })
})
