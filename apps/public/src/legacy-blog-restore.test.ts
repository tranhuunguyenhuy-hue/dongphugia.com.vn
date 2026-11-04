import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import archive from './runtime/legacy-blog-snapshot.json'
import media from './runtime/legacy-blog-media.json'
import {
  blogCategories,
  blogCategoriesWithPosts,
  blogPosts,
  blogPostPath,
  getLegacyBlogCategory,
  getLegacyBlogPost,
  getLegacyBlogPostsForCategory,
  historicalBlogImage,
  restoreHistoricalBlogArticleLinks,
} from './runtime/legacy-blog'

const root = resolve(import.meta.dirname, '../../..')

describe('Owner-requested legacy blog restoration', () => {
  it('preserves eight prior articles and adds two verified consumer articles from the backup', () => {
    expect(archive.contract).toBe('dpg:verified-legacy-blog-snapshot:v1')
    expect(archive.source_project).toBe('tygjmrhandbffjllxveu')
    expect(blogPosts).toHaveLength(10)
    expect(blogCategories).toHaveLength(6)
    expect(blogCategoriesWithPosts).toHaveLength(3)
    expect(new Set(blogPosts.map((post) => post.id)).size).toBe(10)
    expect(new Set(blogPosts.map((post) => post.slug)).size).toBe(10)
    expect(blogPosts.slice(0, 2).map((post) => post.id)).toEqual([18, 17])
    for (const post of blogPosts) {
      expect(post.status).toBe('published')
      expect(post.content.length).toBeGreaterThan(5000)
      expect(createHash('md5').update(post.content).digest('hex')).toBe(post.content_md5)
      expect(post.category.id).toBe(post.category_id)
      expect(blogPostPath(post)).toBe(`/blog/${post.category.slug}/${post.slug}`)
      expect(getLegacyBlogPost(post.category.slug, post.slug)?.id).toBe(post.id)
      expect(getLegacyBlogPost('incorrect-category', post.slug)).toBeNull()
    }
    expect(archive.source_backup.published_rows).toBe(14)
    expect(archive.source_backup.consumer_posts_added).toEqual([17, 18])
    expect(archive.source_backup.internal_canary_rows_excluded).toEqual([12, 13, 14, 15])
    expect(createHash('sha256').update(blogPosts.find((post) => post.id === 17)!.content).digest('hex'))
      .toBe('1492a64adc68d606c2407fbf1c984cfd6b9ce2e331b937bc2a1dd72847354e31')
    expect(createHash('sha256').update(blogPosts.find((post) => post.id === 18)!.content).digest('hex'))
      .toBe('aaf81f9826e86635b5bad026bfb967f4e1bd37cb6a0b7dfd1327cbf60ec4531f')
  })

  it('keeps category memberships and empties factual, without invented articles', () => {
    expect(getLegacyBlogPostsForCategory('huong-dan-chon')).toHaveLength(6)
    expect(getLegacyBlogPostsForCategory('xu-huong')).toHaveLength(2)
    expect(getLegacyBlogPostsForCategory('kien-thuc')).toHaveLength(2)
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
    expect(media.assets).toHaveLength(8)
    for (const asset of media.assets) {
      expect(asset.mime).toBe('image/webp')
      expect(asset.sha256).toMatch(/^[a-f0-9]{64}$/)
      expect(historicalBlogImage(asset.sourceUrl)).toBe(asset.sourceUrl)
      expect(historicalBlogImage(asset.deliveryUrl)).toBe(asset.deliveryUrl)
    }
    expect(historicalBlogImage('https://media.dongphugia.vn/publishing/unverified.webp')).toBeNull()
  })

  it('routes the verified old Blog images through Bunny', () => {
    const cases = [
      {
        id: 11,
        expected: 'https://dpg-products.b-cdn.net/blog/1782900852828-h356on.png',
      },
      {
        id: 10,
        expected: 'https://dpg-products.b-cdn.net/blog/1782811954060-lm1xt.png',
      },
    ]
    for (const { id, expected } of cases) {
      const post = blogPosts.find((item) => item.id === id)
      expect(post).toBeDefined()
      expect(historicalBlogImage(post!.thumbnail_url)).toBe(expected)
      expect(historicalBlogImage(post!.cover_image_url)).toBe(post!.cover_image_url?.replace('https://cdn.dongphugia.com.vn/','https://dpg-products.b-cdn.net/'))
    }
    expect(historicalBlogImage('https://cdn.dongphugia.com.vn/blog/not-verified.png'))
      .toBeNull()
    const html=restoreHistoricalBlogArticleLinks('<p><img src="https://cdn.dongphugia.com.vn/blog/1782900583342-xau1gc.png"><a href="https://www.dongphugia.com.vn/thiet-bi-ve-sinh/bon-cau?sub=bon-cau&amp;brand=toto">Xem</a></p>')
    expect(html).toContain('https://dpg-products.b-cdn.net/blog/1782900583342-xau1gc.png')
    expect(html).toContain('https://www.dongphugia.vn/thiet-bi-ve-sinh/bon-cau?brand=toto')
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
