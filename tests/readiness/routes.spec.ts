import { expect, test } from '@playwright/test'

const REQUIRED_PROJECTS = new Set(['mobile-390', 'desktop-1440'])

const PAGE_ROUTES = [
    '/',
    '/thiet-bi-ve-sinh',
    '/thiet-bi-bep',
    '/vat-lieu-nuoc',
    '/gach-op-lat',
    '/thiet-bi-ve-sinh/bon-cau',
    '/thiet-bi-ve-sinh/bon-cau/stg-demo-bon-cau-smoke-test',
    '/thiet-bi-ve-sinh/bon-cau/stg-demo-bon-cau-route-a',
    '/thiet-bi-ve-sinh/bon-cau/stg-demo-bon-cau-route-b',
    '/thiet-bi-ve-sinh/sen-tam/stg-demo-sen-tam-smoke-test',
    '/thiet-bi-bep/voi-rua-chen/stg-demo-voi-bep-smoke-test',
    '/tim-kiem?q=STG-DEMO',
    '/blog',
    '/lien-he',
    '/gio-hang',
    '/dieu-kien-giao-dich',
    '/admin/login',
] as const

const ENDPOINT_ROUTES = [
    '/robots.txt',
    '/sitemap.xml',
    '/api/health',
] as const

test.describe('synthetic public route acceptance', () => {
    test.describe.configure({ mode: 'serial' })

    test('renders required pages without same-origin route or asset failures', async ({
        page,
    }, testInfo) => {
        test.skip(
            !REQUIRED_PROJECTS.has(testInfo.project.name),
            'The acceptance matrix requires desktop and mobile projects only.',
        )

        const failures: string[] = []
        page.on('response', (response) => {
            if (response.url().startsWith('http://localhost:3000') && response.status() >= 400) {
                failures.push(`${response.status()} ${response.url()}`)
            }
        })
        page.on('requestfailed', (request) => {
            const failure = request.failure()?.errorText
            if (failure && failure !== 'net::ERR_ABORTED' && request.url().startsWith('http://localhost:3000')) {
                failures.push(`${failure} ${request.url()}`)
            }
        })

        for (const route of PAGE_ROUTES) {
            const response = await page.goto(route, { waitUntil: 'domcontentloaded' })
            expect(response?.status(), route).toBeLessThan(400)
            await expect(page.locator('body'), route).toBeVisible()
            await expect(page, route).toHaveTitle(/.+/)
            await expect(page.locator('body'), route).not.toContainText('Application error')

            const canonicalLink = page.locator('link[rel="canonical"]').first()
            const canonical = (await canonicalLink.count()) > 0
                ? await canonicalLink.getAttribute('href')
                : null
            if (canonical) {
                expect(canonical, route).not.toContain('dongphugia.com.vn')
                expect(canonical, route).not.toContain('sslip.io')
            }
        }

        expect(failures).toEqual([])
    })

    test('serves safe local metadata and readiness endpoints', async ({ page }, testInfo) => {
        test.skip(
            !REQUIRED_PROJECTS.has(testInfo.project.name),
            'The acceptance matrix requires desktop and mobile projects only.',
        )

        const [robots, sitemap, health] = await Promise.all(
            ENDPOINT_ROUTES.map((route) => page.request.get(route)),
        )

        expect(robots.status()).toBe(200)
        expect(await robots.text()).toContain('Disallow: /')

        expect(sitemap.status()).toBe(200)
        const sitemapBody = await sitemap.text()
        expect(sitemapBody).toContain('http://localhost:3000')
        expect(sitemapBody).not.toContain('dongphugia.com.vn')
        expect(sitemapBody).not.toContain('sslip.io')

        expect(health.status()).toBe(200)
        expect(await health.json()).toEqual({ ok: true })
    })
})
