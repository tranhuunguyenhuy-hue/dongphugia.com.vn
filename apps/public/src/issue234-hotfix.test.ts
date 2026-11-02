import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getPublicHomeBanners, getPublicHomeContent } from './runtime/preview-public-home'

const root = resolve(import.meta.dirname, '../../..')
afterEach(() => vi.unstubAllEnvs())

describe('Owner Production homepage hotfix', () => {
  it('uses existing price-free historical hero assets and hides only the Production notice', async () => {
    vi.stubEnv('APP_ENV', 'production')
    const banners = await getPublicHomeBanners()
    expect(banners).toHaveLength(1)
    for (const url of [banners[0].mobileImageUrl, banners[0].desktopImageUrl, banners[0].desktopLargeImageUrl]) {
      expect(existsSync(resolve(root, 'public', url!.slice(1)))).toBe(true)
    }
    expect(banners[0].linkUrl).toBe('/thiet-bi-bep')
    const home = readFileSync(resolve(root, 'apps/public/src/runtime/preview-public-home.ts'), 'utf8')
    expect(home).toContain("process.env.APP_ENV === 'production' ? undefined")
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
