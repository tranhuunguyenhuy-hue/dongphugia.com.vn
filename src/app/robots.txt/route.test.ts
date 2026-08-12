import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'

afterEach(() => vi.unstubAllEnvs())

describe('GET /robots.txt', () => {
    it('advertises only the canonical production sitemap', async () => {
        vi.stubEnv('DEPLOY_TARGET', 'production')
        vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.dongphugia.vn')
        const response = GET()
        const body = await response.text()

        expect(body).toContain('Allow: /')
        expect(body).toContain('Sitemap: https://www.dongphugia.vn/sitemap.xml')
        expect(body).not.toContain('noindex')
        expect(body).not.toContain('Disallow: /_next/')
    })

    it('blocks crawlers outside production', async () => {
        vi.stubEnv('DEPLOY_TARGET', 'staging')
        vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://dongphugia-staging.example.test')
        const response = GET()
        expect(await response.text()).toBe('User-agent: *\nDisallow: /\n')
    })
})
