import { expect, test } from '@playwright/test'

test.describe('homepage technical readiness', () => {
    test('has stable landmarks, bounded DOM and no horizontal overflow', async ({
        page,
    }) => {
        const consoleErrors: string[] = []
        const failedResources: string[] = []
        page.on('console', (message) => {
            if (message.type() === 'error') consoleErrors.push(message.text())
        })
        page.on('response', (response) => {
            if (response.status() >= 400) {
                failedResources.push(`${response.status()} ${response.url()}`)
            }
        })
        page.on('requestfailed', (request) => {
            const errorText = request.failure()?.errorText ?? 'request failed'
            if (errorText === 'net::ERR_ABORTED') return
            failedResources.push(
                `${errorText} ${request.url()}`,
            )
        })

        await page.goto('/', { waitUntil: 'load' })

        await expect(page.locator('h1')).toHaveCount(1)
        await expect(page.locator('main#main-content')).toHaveCount(1)
        await expect(
            page.getByRole('link', { name: 'Chuyển đến nội dung chính' }),
        ).toHaveAttribute('href', '#main-content')

        const pageMetrics = await page.evaluate(() => ({
            domNodes: document.getElementsByTagName('*').length,
            hasOverflow:
                document.documentElement.scrollWidth >
                document.documentElement.clientWidth,
            heroSlides: document.querySelectorAll(
                '[aria-roledescription="slide"]',
            ).length,
        }))

        expect(pageMetrics.domNodes).toBeLessThan(1500)
        expect(pageMetrics.hasOverflow).toBe(false)
        expect(pageMetrics.heroSlides).toBeLessThanOrEqual(1)
        expect(failedResources).toEqual([])
        expect(consoleErrors).toEqual([])
    })

    test('exposes named controls and keyboard-operable desktop menus', async ({
        page,
    }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' })

        await expect(page.getByRole('button', { name: /tìm kiếm/i }).first())
            .toBeVisible()

        if ((page.viewportSize()?.width ?? 0) < 1024) {
            await expect(
                page.getByRole('button', { name: 'Mở menu điều hướng' }),
            ).toBeVisible()
            return
        }

        const productsButton = page.getByRole('button', {
            name: 'Sản phẩm',
        })
        await productsButton.click()
        await expect(productsButton).toHaveAttribute('aria-expanded', 'true')
        await page.keyboard.press('Escape')
        await expect(productsButton).toHaveAttribute('aria-expanded', 'false')
        await expect(productsButton).toBeFocused()
    })

    test('shows the responsive campaign carousel on mobile', async ({
        page,
    }) => {
        test.skip(
            (page.viewportSize()?.width ?? 0) >= 768,
            'Mobile regression only',
        )

        const campaignRequests: string[] = []
        page.on('request', (request) => {
            if (
                request.url().includes('/api/homepage-hero?width=720')
                || request.url().includes('/banners/banner-kitchen.hero.w720.webp')
            ) {
                campaignRequests.push(request.url())
            }
        })

        await page.goto('/', { waitUntil: 'networkidle' })
        await expect(
            page.getByRole('group', { name: '1 trên 3' }),
        ).toBeVisible()
        await expect(
            page.getByText('Xem ưu đãi hiện tại', { exact: true }),
        ).toHaveCount(0)
        expect(campaignRequests).toHaveLength(1)
        expect(campaignRequests[0]).toMatch(
            /\/api\/homepage-hero\?width=720|\/banners\/banner-kitchen\.hero\.w720\.webp/,
        )
    })

    test('shows twelve public sanitary product cards with canonical, unique links', async ({ page }) => {
        await page.goto('/', { waitUntil: 'networkidle' })

        const grid = page.getByTestId('home-products-thiet-bi-ve-sinh')
        const cards = grid.locator(':scope > a')
        await expect(cards).toHaveCount(12)

        const hrefs = await cards.evaluateAll((links) => links.map((link) => link.getAttribute('href')))
        expect(hrefs.every((href) => href?.startsWith('/thiet-bi-ve-sinh/'))).toBe(true)
        expect(new Set(hrefs).size).toBe(12)

        const priorityRepresentativeHrefs = [
            '/thiet-bi-ve-sinh/bon-cau/hq-tbvs-toilet-representative',
            '/thiet-bi-ve-sinh/lavabo/hq-tbvs-lavabo-representative',
            '/thiet-bi-ve-sinh/bon-tam/hq-tbvs-bathtub-representative',
            '/thiet-bi-ve-sinh/sen-tam/hq-tbvs-shower-representative',
        ]
        const fallbackHrefs = [
            '/thiet-bi-ve-sinh/chau-rua/hq-tbvs-fallback-one',
            '/thiet-bi-ve-sinh/chau-rua/hq-tbvs-fallback-two',
        ]

        for (const href of priorityRepresentativeHrefs) {
            expect(hrefs).toContain(href)
        }
        for (const href of fallbackHrefs) {
            expect(hrefs).toContain(href)
        }
        expect(Math.max(...priorityRepresentativeHrefs.map((href) => hrefs.indexOf(href))))
            .toBeLessThan(Math.min(...fallbackHrefs.map((href) => hrefs.indexOf(href))))

        expect(hrefs).not.toContain('/thiet-bi-ve-sinh/bon-cau/hq-tbvs-toilet-variant-a')
        expect(hrefs).not.toContain('/thiet-bi-ve-sinh/phu-kien/hq-tbvs-accessory-control')
    })
})
