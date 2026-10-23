import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { GET as getRobots } from '../app/robots.txt/route'
import { GET as getSitemap } from '../app/sitemap.xml/route'

const root = resolve(import.meta.dirname, '../../..')
const source = (path: string) => readFileSync(resolve(root, path), 'utf8')

afterEach(() => vi.unstubAllEnvs())

function setAppEnvironment(preview: boolean) {
  vi.stubEnv('APP_ENV', preview ? 'preview' : 'production')
  vi.stubEnv('APP_BUILD_TARGET', 'public')
  vi.stubEnv('APP_ORIGIN', preview ? 'https://public-preview.invalid' : 'https://www.dongphugia.vn')
  vi.stubEnv('PREVIEW_NOINDEX', preview ? 'true' : 'false')
}

describe('canonical Public shell and truthful gates', () => {
  it('selects the approved page, layout, and visual components, without emergency branches', () => {
    expect(source('apps/public/app/page.tsx')).toContain("export { default } from '@/app/(public)/page'")
    expect(source('apps/public/app/layout.tsx')).toContain('<CanonicalPublicLayout>{children}</CanonicalPublicLayout>')
    const page = source('src/app/(public)/page.tsx')
    const layout = source('src/app/(public)/layout.tsx')
    for (const section of ['HeroBanner', 'BrandSlider', 'HomeCategoryBlockAlt', 'LazyContactSection']) expect(page).toContain(section)
    for (const section of ['Header', 'Footer', 'FloatingContact']) expect(layout).toContain(section)
    expect(page).not.toContain('EmergencyPublicHomePage')
    expect(layout).not.toContain('emergencyShell')
    expect(existsSync(resolve(root, 'src/components/layout/emergency-public-shell.tsx'))).toBe(false)
  })

  it('keeps Preview controls read-only and does not package invented products', () => {
    expect(source('apps/public/src/runtime/preview-public-ui-policy.ts')).toContain('PUBLIC_UI_READ_ONLY = true')
    expect(source('apps/public/src/runtime/preview-public-ui-policy.ts')).toContain('PUBLIC_UI_READ_ONLY_MENU')
    for (const path of ['src/components/layout/header.tsx', 'src/components/layout/footer.tsx', 'src/components/layout/floating-contact.tsx', 'src/components/home/search-bar.tsx', 'src/components/home/lazy-contact-section.tsx']) {
      expect(source(path)).toContain('PUBLIC_UI_READ_ONLY')
    }
    expect(existsSync(resolve(root, 'apps/public/src/runtime/preview-public-catalogue.ts'))).toBe(false)
    expect(existsSync(resolve(root, 'apps/public/app/[categorySlug]/[subcategorySlug]/page.tsx'))).toBe(false)
    expect(existsSync(resolve(root, 'apps/public/app/[categorySlug]/[subcategorySlug]/[productSlug]/page.tsx'))).toBe(false)
    expect(source('apps/public/src/runtime/preview-public-home.ts')).not.toMatch(/fixtureOnly|sku:|price_display:|stock_status:/i)
  })

  it('keeps Preview non-indexable and publishes only truthful routes in Production sitemap', async () => {
    setAppEnvironment(true)
    expect((await getRobots().text())).toContain('Disallow: /')
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
