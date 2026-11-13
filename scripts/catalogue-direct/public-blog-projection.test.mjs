import { expect, it } from 'vitest'
import {
  buildPublicBlogAsset,
  projectPublicBlog,
  PUBLIC_BLOG_PROJECTION_CONTRACT,
} from './public-blog-projection.mjs'

const asOf = new Date('2026-11-13T12:00:00.000Z')

it('projects only due published posts in active categories through the public sanitizer', () => {
  const projection = projectPublicBlog({
    asOf,
    categories: [
      { id: 1, name: 'Tin tức', slug: 'tin-tuc', is_active: true, sort_order: 2 },
      { id: 2, name: 'Ẩn', slug: 'an', is_active: false, sort_order: 1 },
    ],
    posts: [
      {
        id: 11, title: 'Published article', slug: 'published-article', excerpt: 'Safe excerpt',
        content: '<h2>Editorial</h2><p>Safe text.</p><script>privateToken="bad"</script><img src="https://evil.example/private.png">',
        category_id: 1, status: 'published', published_at: '2026-11-13T11:00:00.000Z',
        thumbnail_url: 'https://cdn.dongphugia.com.vn/blog/safe.png', cover_image_url: 'https://evil.example/cover.png',
        seo_title: 'Safe SEO title', seo_description: 'Safe SEO description', reading_time: 4,
        is_featured: true, is_pinned: true, author_name: 'Private employee', author_avatar: 'private-avatar',
        view_count: 500, version: 9, password_hash: 'must never project',
      },
      {
        id: 12, title: 'Draft article', slug: 'draft-article', content: '<p>Draft.</p>',
        category_id: 1, status: 'draft', published_at: '2026-11-13T10:00:00.000Z',
      },
      {
        id: 13, title: 'Future article', slug: 'future-article', content: '<p>Future.</p>',
        category_id: 1, status: 'published', published_at: '2026-11-14T10:00:00.000Z',
      },
      {
        id: 14, title: 'Inactive category article', slug: 'inactive-category', content: '<p>Hidden.</p>',
        category_id: 2, status: 'published', published_at: '2026-11-12T10:00:00.000Z',
      },
    ],
  })

  expect(projection.contract).toBe(PUBLIC_BLOG_PROJECTION_CONTRACT)
  expect(projection.posts.map((post) => post.slug)).toEqual(['published-article'])
  const [post] = projection.posts
  expect(post.author_name).toBe('Đông Phú Gia')
  expect(post.author_avatar).toBeNull()
  expect(post.thumbnail_url).toBe('https://cdn.dongphugia.com.vn/blog/safe.png')
  expect(post.cover_image_url).toBeNull()
  expect(post.content).toContain('<h2>Editorial</h2>')
  expect(post.content).not.toMatch(/script|privateToken|evil\.example/i)
  expect(post).not.toHaveProperty('view_count')
  expect(post).not.toHaveProperty('version')
  expect(post).not.toHaveProperty('password_hash')
})

it('binds the Blog artifact to the exact public catalogue checkpoint and rejects invalid input', () => {
  const projection = projectPublicBlog({ asOf, categories: [], posts: [] })
  const checkpoint = 'a'.repeat(40)
  expect(buildPublicBlogAsset(projection, checkpoint, 'dpg:public-catalogue-snapshot:v1')).toEqual({
    contract: 'dpg:public-catalogue-snapshot:v1',
    checkpoint,
    blogContract: PUBLIC_BLOG_PROJECTION_CONTRACT,
    asOf: asOf.toISOString(),
    categories: [],
    posts: [],
  })
  expect(() => buildPublicBlogAsset(projection, 'bad', 'dpg:public-catalogue-snapshot:v1'))
    .toThrow('PUBLIC_BLOG_ASSET_EVIDENCE_INVALID')
})
