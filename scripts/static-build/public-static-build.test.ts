import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ACCEPTED_INVENTORY,
  CATEGORY_ROOTS,
  EXPECTED_CANONICAL_PRODUCT_COUNT,
  STATIC_CONTENT_ROUTES,
  buildStaticArtifact,
  validateStaticBuildInput,
  validateStaticArtifact,
  type StaticBuildInput,
  type StaticProduct,
} from './public-static-build.mts'
import {
  canonicalMemberKeys,
  existingMemberKeys,
  groupKeyForMs885Member,
} from '../quality/product-family-preservation-contract'

function product(index: number, categoryIndex: number): StaticProduct {
  const [categorySlug, categoryName] = CATEGORY_ROOTS[categoryIndex]
  const subcategorySlug = `sub-${categoryIndex}-${index % 31}`
  return {
    id: index + 1,
    slug: `product-${index + 1}`,
    name: `Sản phẩm ${index + 1}`,
    description: 'Mô tả sản phẩm dùng trong fixture kiểm tra static build.',
    seo_title: null,
    seo_description: null,
    image_main_url: index === 0 ? 'https://cdn.dongphugia.com.vn/products/product-1.webp' : null,
    sku: `FIXTURE-${index + 1}`,
    updated_at: '2026-08-28T00:00:00.000Z',
    product_type: null,
    category_slug: categorySlug,
    category_name: categoryName,
    subcategory_slug: subcategorySlug,
    subcategory_name: `Phân loại ${index % 31}`,
    stock_status: index % 2 === 0 ? 'in_stock' : 'pre_order',
    price: 1000000,
    original_price: null,
    list_price: 1000000,
    sale_price: null,
    brand_slug: index % 3 === 0 ? 'toto' : null,
    brand_name: index % 3 === 0 ? 'TOTO' : null,
    primary_taxons: [{
      slug: subcategorySlug,
      name: `Phân loại ${index % 31}`,
      canonical_path: `${categorySlug}/${subcategorySlug}`,
      parent_id: null,
      is_active: true,
      is_listing_enabled: true,
    }],
  }
}

function buildInput(): StaticBuildInput {
  return {
    products: Array.from(
      { length: EXPECTED_CANONICAL_PRODUCT_COUNT },
      (_, index) => product(index, index % CATEGORY_ROOTS.length),
    ),
    subcategories: Array.from({ length: 31 }, (_, index) => ({
      category_slug: CATEGORY_ROOTS[index % CATEGORY_ROOTS.length][0],
      category_name: CATEGORY_ROOTS[index % CATEGORY_ROOTS.length][1],
      slug: `sub-${index % CATEGORY_ROOTS.length}-${index}`,
      name: `Phân loại ${index}`,
    })),
  }
}

describe('canonical public static build', () => {
  it('generates the accepted Product route inventory and SEO controls', async () => {
    const output = await mkdtemp(path.join(os.tmpdir(), 'dongphugia-static-build-'))
    try {
      const result = await buildStaticArtifact(buildInput(), {
        output,
        mode: 'production',
        sourceIdentity: 'test fixture matching accepted route cardinality',
      })
      const checked = await validateStaticArtifact(output, result.productPaths, 'production')
      console.info('STATIC_BUILD_INVENTORY', JSON.stringify(result.inventory))
      expect(result.productPaths).toHaveLength(EXPECTED_CANONICAL_PRODUCT_COUNT)
      expect(new Set(result.productPaths).size).toBe(EXPECTED_CANONICAL_PRODUCT_COUNT)
      expect(checked.sitemapUrlCount).toBe(EXPECTED_CANONICAL_PRODUCT_COUNT)
      expect(result.redirects.some((redirect) => redirect.source === '/tin-tuc')).toBe(true)
      expect(result.report.routes.brands).toBe(1)
      await expect(readFile(path.join(output, 'thuong-hieu', 'toto', 'index.html'), 'utf8')).resolves.toContain('Sản phẩm 1')
      expect(result.inventory.fileCount).toBeGreaterThanOrEqual(STATIC_CONTENT_ROUTES.length + EXPECTED_CANONICAL_PRODUCT_COUNT)
      expect(result.inventory.fileCount).toBeLessThan(20_000)
      expect(result.inventory.largestFile.bytes).toBeLessThan(25 * 1024 * 1024)
      expect(result.inventory.totalBytes).toBeGreaterThan(0)
      expect(ACCEPTED_INVENTORY.files).toBe(4_093)
      await expect(readFile(path.join(output, 'robots.txt'), 'utf8')).resolves.toContain('Sitemap: https://www.dongphugia.vn/sitemap.xml')
    } finally {
      await rm(output, { recursive: true, force: true })
    }
  }, 30_000)

  it('creates noindex preview controls and preserves exact Bunny media URLs', async () => {
    const output = await mkdtemp(path.join(os.tmpdir(), 'dongphugia-static-preview-'))
    try {
      const result = await buildStaticArtifact(buildInput(), {
        output,
        mode: 'preview',
        sourceIdentity: 'test fixture',
        publishingCdnHostname: 'media.example.com',
      })
      await validateStaticArtifact(output, result.productPaths, 'preview')
      const html = await readFile(path.join(output, 'thiet-bi-ve-sinh', 'sub-0-0', 'product-1', 'index.html'), 'utf8')
      expect(html).toContain('noindex,nofollow')
      expect(html).toContain('https://cdn.dongphugia.com.vn/products/product-1.webp')
      const headers = await readFile(path.join(output, '_headers'), 'utf8')
      expect(headers).toContain('X-Robots-Tag: noindex, nofollow')
      expect(headers).toContain('https://media.example.com')
      expect(headers).toContain('https://www.transparenttextures.com')
    } finally {
      await rm(output, { recursive: true, force: true })
    }
  }, 30_000)

  it('renders Blog routes as static Article documents with sanitized content', async () => {
    const output = await mkdtemp(path.join(os.tmpdir(), 'dongphugia-static-blog-'))
    try {
      const data = buildInput()
      data.blogCategories = [{ slug: 'tu-van', name: 'Tư vấn' }]
      data.blogPosts = [{
        slug: 'chon-thiet-bi',
        title: 'Chọn thiết bị phù hợp',
        excerpt: 'Tư vấn lựa chọn thiết bị.',
        content: '<script>alert("blocked")</script><p>Nội dung sạch.</p>',
        seo_title: 'Chọn thiết bị phù hợp | Đông Phú Gia',
        seo_description: 'Tư vấn thiết bị.',
        author_name: 'Ban Biên Tập Đông Phú Gia',
        cover_image_url: 'https://cdn.dongphugia.com.vn/blog/cover.webp',
        updated_at: '2026-08-28T00:00:00.000Z',
        published_at: '2026-08-27T00:00:00.000Z',
        category_slug: 'tu-van',
        category_name: 'Tư vấn',
      }]
      const result = await buildStaticArtifact(data, {
        output,
        mode: 'production',
        sourceIdentity: 'test Blog fixture',
      })
      const html = await readFile(path.join(output, 'blog', 'tu-van', 'chon-thiet-bi', 'index.html'), 'utf8')
      expect(html).toContain('application/ld+json')
      expect(html).toContain('Article')
      expect(html).toContain('Nội dung sạch.')
      expect(html).not.toContain('<script>alert')
      expect(result.report.routes.blogPosts).toBe(1)
    } finally {
      await rm(output, { recursive: true, force: true })
    }
  }, 30_000)

  it('fails closed when canonical Product coverage changes', async () => {
    await expect(buildStaticArtifact({ ...buildInput(), products: buildInput().products.slice(0, -1) }, {
      output: path.join(os.tmpdir(), 'unused-static-build-output'),
      mode: 'production',
      sourceIdentity: 'invalid fixture',
    })).rejects.toThrow('STATIC_BUILD_PRODUCT_COUNT_FAILED')
  })

  it('fails closed unless the build snapshot preserves the accepted MS885 Family contract', () => {
    const data = buildInput()
    data.preservationSnapshot = {
      familyKey: 'toto:ms885',
      canonicalMemberKeys: [...canonicalMemberKeys],
      memberships: existingMemberKeys.map((memberKey) => ({
        memberKey,
        groupKey: groupKeyForMs885Member(memberKey)!,
      })),
      catalogueGapKeys: ['MS885DW4#XW', 'MS885DW18#XW'],
      deferredOutsideFamily: ['MS885DE6#XW'],
    }
    expect(validateStaticBuildInput(data)).toHaveLength(EXPECTED_CANONICAL_PRODUCT_COUNT)
  })
})
