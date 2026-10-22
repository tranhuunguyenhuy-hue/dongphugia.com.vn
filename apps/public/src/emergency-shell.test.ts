import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { GET as getRobots } from '../app/robots.txt/route'
import { GET as getSitemap } from '../app/sitemap.xml/route'

const repositoryRoot = resolve(import.meta.dirname, '../../..')

afterEach(() => vi.unstubAllEnvs())

function setAppEnvironment(preview: boolean) {
  vi.stubEnv('APP_ENV', preview ? 'preview' : 'production')
  vi.stubEnv('APP_BUILD_TARGET', 'public')
  vi.stubEnv('APP_ORIGIN', preview ? 'https://public-preview.invalid' : 'https://www.dongphugia.vn')
  vi.stubEnv('PREVIEW_NOINDEX', preview ? 'true' : 'false')
}

describe('GO-FAST-1 truthful emergency shell', () => {
  it('selects canonical Public page and layout variants without active commerce controls', () => {
    const page = readFileSync(resolve(repositoryRoot, 'apps/public/app/page.tsx'), 'utf8')
    const layout = readFileSync(resolve(repositoryRoot, 'apps/public/app/layout.tsx'), 'utf8')
    const canonicalPage = readFileSync(resolve(repositoryRoot, 'src/app/(public)/page.tsx'), 'utf8')
    const shellHome = canonicalPage.split('export function EmergencyPublicHomePage()')[1]?.split('async function HomepageContentSections()')[0]
    const shellLayout = readFileSync(resolve(repositoryRoot, 'src/components/layout/emergency-public-shell.tsx'), 'utf8')
    const category = readFileSync(resolve(repositoryRoot, 'apps/public/app/[categorySlug]/page.tsx'), 'utf8')

    expect(page).toContain("from '@/app/(public)/page'")
    expect(page).toContain('EmergencyPublicHomePage')
    expect(layout).toContain('CanonicalPublicLayout emergencyShell')
    expect(shellHome).toBeTruthy()
    expect(shellHome).not.toMatch(/getPublicHomeContent|getPreviewCatalogue|ProductCard|BrandSlider|LazyContactSection|HeroBanner/)
    expect(shellHome).toContain('/images/banner-3.jpg')
    expect(shellHome).toContain('Hình ảnh minh họa')
    expect(shellLayout).not.toMatch(/SearchBar|CartIcon|LazyCartDrawer|FloatingContact|Newsletter/)
    expect(category).not.toMatch(/getPreviewCatalogue|ProductCard|fixture/i)
  })

  it('keeps Preview non-indexable and publishes only truthful routes in Production sitemap', async () => {
    setAppEnvironment(true)
    const previewRobots = getRobots()
    expect(previewRobots.status).toBe(200)
    expect(await previewRobots.text()).toContain('Disallow: /')
    expect(getSitemap().status).toBe(404)

    setAppEnvironment(false)
    const productionRobots = getRobots()
    expect(productionRobots.status).toBe(200)
    expect(await productionRobots.text()).toContain('Sitemap: https://www.dongphugia.vn/sitemap.xml')
    expect(productionRobots.headers.has('x-robots-tag')).toBe(false)

    const sitemap = getSitemap()
    expect(sitemap.status).toBe(200)
    const body = await sitemap.text()
    expect(body).toContain('<loc>https://www.dongphugia.vn/</loc>')
    expect(body).toContain('<loc>https://www.dongphugia.vn/lien-he</loc>')
    expect((body.match(/<loc>/g) || [])).toHaveLength(6)
    expect(body).not.toMatch(/<loc>[^<]*(?:ban-cau|may-bom|gach-marble)/)
  })
})
