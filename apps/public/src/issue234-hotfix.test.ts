import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getPublicHomeBanners, getPublicHomeContent } from './runtime/preview-public-home'

const root = resolve(import.meta.dirname, '../../..')
afterEach(() => vi.unstubAllEnvs())

describe('Owner Production homepage hotfix', () => {
  it('shows three Owner-verified legacy PNG slides in the canonical Production carousel', async () => {
    vi.stubEnv('APP_ENV', 'production')
    const banners = await getPublicHomeBanners()
    const archive = 'https://tygjmrhandbffjllxveu.supabase.co/storage/v1/object/public/images/banners/'
    expect(banners.map(({ id }) => id)).toEqual([6, 4, 5])
    expect(banners.map(({ imageUrl }) => imageUrl)).toEqual([
      archive + '1776486977694-87cnaa.png',
      archive + '1776485447824-r0eml8.png',
      archive + '1776485426606-t2pflg.png',
    ])
    expect(banners.map(({ linkUrl }) => linkUrl)).toEqual([null, null, null])
    for (const banner of banners) {
      expect(banner.mobileImageUrl).toBe(banner.imageUrl)
      expect(banner.desktopImageUrl).toBe(banner.imageUrl)
      expect(banner.desktopLargeImageUrl).toBe(banner.imageUrl)
    }
    // Preserve the previously approved local images for a bounded rollback.
    for (const filename of ['banner-1.jpg', 'banner-2.jpg', 'banner-3.jpg']) {
      expect(existsSync(resolve(root, 'public/images', filename))).toBe(true)
    }
    const carousel = readFileSync(resolve(root, 'src/components/home/hero-banner.tsx'), 'utf8')
    expect(carousel).toContain('items.length > 1')
    expect(carousel).toContain('aspect-[1606/752]')
    const controls = readFileSync(resolve(root, 'src/components/home/hero-banner-controls.tsx'), 'utf8')
    expect(controls).toContain('isPngOriginal')
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
