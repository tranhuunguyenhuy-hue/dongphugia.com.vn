import { expect, test } from '@playwright/test'

const expectedSha = process.env.CANDIDATE_SHA

test.beforeAll(() => {
    expect(expectedSha).toMatch(/^[0-9a-f]{40}$/)
})

test('renders the exact synthetic candidate without production indicators', async ({ page }, testInfo) => {
    const response = await page.goto('/')
    expect(response?.status()).toBe(200)
    await expect(page.getByText(/STG-DEMO/).first()).toBeVisible()
    await expect(page.locator('body')).not.toContainText('vercel.app')
    await expect(page.locator('body')).not.toContainText('supabase.co')

    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href')
    expect(canonical).toMatch(/^https:\/\/dongphugia-staging\.47-131-92-97\.sslip\.io/)
    await page.screenshot({ path: testInfo.outputPath('homepage.png'), fullPage: true })
})

test('binds public revision and database isolation to the candidate', async ({ request }) => {
    const revisionResponse = await request.get('/api/revision')
    expect(revisionResponse.status()).toBe(200)
    expect(await revisionResponse.json()).toMatchObject({
        ok: true,
        sourceRevision: expectedSha,
        stagingPreview: true,
    })

    const identityResponse = await request.get('/api/staging-identity')
    expect(identityResponse.status()).toBe(200)
    const identity = await identityResponse.json()
    expect(identity).toMatchObject({
        ok: true,
        dataset: 'STG-DEMO',
        aggregates: {
            tableCount: 46,
            syntheticProducts: 3,
            canonicalSyntheticProducts: 3,
            sensitiveRows: 0,
        },
    })
    expect(identity.databaseFingerprintSha256).toMatch(/^[0-9a-f]{64}$/)
})

test('renders critical catalogue, product, search, and admin-boundary routes', async ({ page, request }, testInfo) => {
    const paths = [
        '/thiet-bi-ve-sinh',
        '/thiet-bi-ve-sinh/stg-demo-bon-cau/stg-demo-bon-cau-smoke-test',
        '/tim-kiem?q=STG-DEMO',
    ]

    for (const path of paths) {
        const response = await page.goto(path)
        expect(response?.status(), path).toBe(200)
        await expect(page.getByText(/STG-DEMO/).first(), path).toBeVisible()
    }
    await page.screenshot({ path: testInfo.outputPath('critical-product.png'), fullPage: true })

    for (const path of ['/robots.txt', '/sitemap.xml', '/admin/login']) {
        expect((await request.get(path)).status(), path).toBe(200)
    }
    const admin = await request.get('/admin', { maxRedirects: 0 })
    expect(admin.status()).toBe(307)
    expect(admin.headers().location).toMatch(/^\/admin\/login/)
})
