import { expect, it } from 'vitest'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

it('builds the public sitemap from the exact product bucket and rejects count drift', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dpg-sitemap-'))
  const catalogue = join(root, '__catalogue/v1')
  await mkdir(join(catalogue, 'products'), { recursive: true })
  const manifest = { contract: 'dpg:public-catalogue-snapshot:v1', checkpoint: 'a'.repeat(40), products: 2,
    blogSnapshot: { asset: 'blog.json', contract: 'dpg:public-blog-snapshot:v1',
      asOf: '2026-11-13T12:00:00.000Z', categories: 1, posts: 1 },
    sitemapProductIds:[1],
    productBuckets: ['aa'], categories: [{ slug: 'thiet-bi-ve-sinh', listings: [{ slug: 'bon-cau' }] }] }
  try {
    await writeFile(join(catalogue, 'manifest.json'), JSON.stringify(manifest))
    await writeFile(join(catalogue, 'products/aa.json'), JSON.stringify({ contract: manifest.contract,
      checkpoint: manifest.checkpoint, products: [{ id: 1, url: '/thiet-bi-ve-sinh/bon-cau/san-pham-1' },
        {id:2,url:'/thiet-bi-ve-sinh/bon-cau/san-pham-khong-index'}] }))
    await writeFile(join(catalogue, 'blog.json'), JSON.stringify({
      contract: manifest.contract, checkpoint: manifest.checkpoint, blogContract: manifest.blogSnapshot.contract,
      asOf: manifest.blogSnapshot.asOf,
      categories: [{ id: 91, name: 'Tin mới', slug: 'tin-moi', description: null, thumbnail_url: null,
        seo_title: null, seo_description: null, sort_order: 1, is_active: true }],
      posts: [{ id: 81, title: 'New article', slug: 'new-article', category_id: 91,
        status: 'published', published_at: '2026-11-13T11:00:00.000Z' }],
    }))
    execFileSync(process.execPath, ['scripts/catalogue-direct/build-public-sitemap.mjs', root, 'https://www.dongphugia.vn'])
    const sitemap = await readFile(join(root, 'sitemap.xml'), 'utf8')
    expect(sitemap).toContain('https://www.dongphugia.vn/thiet-bi-ve-sinh/bon-cau/san-pham-1')
    expect(sitemap).not.toContain('/san-pham-khong-index')
    expect(sitemap).toContain('https://www.dongphugia.vn/blog')
    expect(sitemap).toContain('https://www.dongphugia.vn/blog/tin-moi/new-article')
    expect(() => execFileSync(process.execPath,
      ['scripts/catalogue-direct/build-public-sitemap.mjs','','https://www.dongphugia.vn'],{stdio:'pipe'}))
      .toThrow(/PUBLIC_SITEMAP_ARGUMENTS_INVALID/)
    await writeFile(join(catalogue, 'manifest.json'), JSON.stringify({ ...manifest, sitemapProductIds:[1,3] }))
    expect(() => execFileSync(process.execPath,
      ['scripts/catalogue-direct/build-public-sitemap.mjs', root, 'https://www.dongphugia.vn'], { stdio: 'pipe' }))
      .toThrow()
  } finally { await rm(root, { recursive: true, force: true }) }
})
