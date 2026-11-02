import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import archive from './runtime/legacy-blog-snapshot.json'
import {
  blogCategories,
  blogCategoriesWithPosts,
  blogPosts,
  blogPostPath,
  getLegacyBlogCategory,
  getLegacyBlogPost,
  getLegacyBlogPostsForCategory,
  historicalBlogImage,
} from './runtime/legacy-blog'

const root = resolve(import.meta.dirname, '../../..')

describe('Owner-requested legacy blog restoration', () => {
  it('preserves the eight original published article bodies and six category records', () => {
    expect(archive.contract).toBe('dpg:verified-legacy-blog-snapshot:v1')
    expect(archive.source_project).toBe('tygjmrhandbffjllxveu')
    expect(blogPosts).toHaveLength(8)
    expect(blogCategories).toHaveLength(6)
    expect(blogCategoriesWithPosts).toHaveLength(3)
    expect(new Set(blogPosts.map((post) => post.id)).size).toBe(8)
    expect(new Set(blogPosts.map((post) => post.slug)).size).toBe(8)
    for (const post of blogPosts) {
      expect(post.status).toBe('published')
      expect(post.content.length).toBeGreaterThan(6000)
      expect(createHash('md5').update(post.content).digest('hex')).toBe(post.content_md5)
      expect(post.category.id).toBe(post.category_id)
      expect(blogPostPath(post)).toBe(`/blog/${post.category.slug}/${post.slug}`)
      expect(getLegacyBlogPost(post.category.slug, post.slug)?.id).toBe(post.id)
      expect(getLegacyBlogPost('incorrect-category', post.slug)).toBeNull()
    }
  })

  it('keeps category memberships and empties factual, without invented articles', () => {
    expect(getLegacyBlogPostsForCategory('huong-dan-chon')).toHaveLength(5)
    expect(getLegacyBlogPostsForCategory('xu-huong')).toHaveLength(2)
    expect(getLegacyBlogPostsForCategory('kien-thuc')).toHaveLength(1)
    expect(getLegacyBlogPostsForCategory('tin-tuc')).toHaveLength(0)
    expect(getLegacyBlogPostsForCategory('du-an')).toHaveLength(0)
    expect(getLegacyBlogPostsForCategory('thi-cong')).toHaveLength(0)
    expect(getLegacyBlogCategory('not-a-category')).toBeNull()
    expect(archive.posts.every((post) => Boolean(post.seo_description || post.excerpt))).toBe(true)
  })

  it('rejects unsafe image URLs while preserving the original public asset URLs', () => {
    expect(historicalBlogImage('javascript:alert(1)')).toBeNull()
    expect(historicalBlogImage('http://tygjmrhandbffjllxveu.supabase.co/a')).toBeNull()
    expect(historicalBlogImage('https://example.com/image.png')).toBeNull()
    expect(historicalBlogImage('https://tygjmrhandbffjllxveu.supabase.co/storage/v1/object/public/images/blog/test.png'))
      .toContain('/blog/test.png')
  })

  it('restores actual Worker routes and removes the news placeholder from smoke tests', () => {
    const listing = readFileSync(resolve(root, 'apps/public/app/blog/page.tsx'), 'utf8')
    const category = readFileSync(resolve(root, 'apps/public/app/blog/[categorySlug]/page.tsx'), 'utf8')
    const detail = readFileSync(resolve(root, 'apps/public/app/blog/[categorySlug]/[postSlug]/page.tsx'), 'utf8')
    const smoke = readFileSync(resolve(root, 'scripts/catalogue-direct/public-production-smoke.mjs'), 'utf8')
    const homepage = readFileSync(resolve(root, 'apps/public/src/runtime/preview-public-home.ts'), 'utf8')
    expect(listing).toContain('blogPosts')
    expect(category).toContain('getLegacyBlogPostsForCategory')
    expect(detail).toContain('sanitizeRichHtml')
    expect(detail).toContain('application/ld+json')
    expect(smoke).toContain("fail('NEWS_RESTORE')")
    expect(homepage).toContain('blogPosts.slice(0, 3)')
    for (const post of blogPosts) {
      expect(smoke).toContain(blogPostPath(post))
    }
  })
})
