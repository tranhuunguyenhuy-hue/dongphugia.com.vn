import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getPublicHomeBanners, getPublicHomeContent } from './runtime/preview-public-home'

const root = resolve(import.meta.dirname, '../../..')
afterEach(() => vi.unstubAllEnvs())

describe('Owner Production homepage hotfix', () => {
  it('shows three Owner-selected local banner slides in the canonical Production carousel', async () => {
    vi.stubEnv('APP_ENV', 'production')
    const banners = await getPublicHomeBanners()
    expect(banners.map((banner) => banner.imageUrl)).toEqual([
      '/images/banner-1.jpg',
      '/images/banner-2.jpg',
      '/images/banner-3.jpg',
    ])
    expect(banners.map((banner) => banner.linkUrl)).toEqual([null, null, null])
    for (const banner of banners) {
      for (const url of [banner.imageUrl, banner.mobileImageUrl, banner.desktopImageUrl, banner.desktopLargeImageUrl]) {
        if (url) expect(existsSync(resolve(root, 'public', url.slice(1)))).toBe(true)
      }
    }
    const carousel = readFileSync(resolve(root, 'src/components/home/hero-banner.tsx'), 'utf8')
    expect(carousel).toContain('items.length > 1')
    const home = readFileSync(resolve(root, 'apps/public/src/runtime/preview-public-home.ts'), 'utf8')
    expect(home).toContain("process.env.APP_ENV === 'production' ? undefined")
  })

  it('does not change the isolated Preview hero source', async () => {
    vi.stubEnv('APP_ENV', 'preview')
    expect(await getPublicHomeBanners()).toEqual([])
  })

  it('keeps tile routes but excludes its homepage section', () => {
    const page = readFileSync(resolve(root, 'src/app/(public)/page.tsx'), 'utf8')
    expect(page).toContain("cat.id !== 'gach-op-lat'")
    expect(existsSync(resolve(root, 'apps/public/app/[categorySlug]/page.tsx'))).toBe(true)
  })

  it('provides a factual news landing route without fabricated articles', () => {
    const page = readFileSync(resolve(root, 'apps/public/app/blog/page.tsx'), 'utf8')
    expect(page).toContain("canonical: '/blog'")
    expect(page).toContain('Bài viết đang được cập nhật')
  })
})
