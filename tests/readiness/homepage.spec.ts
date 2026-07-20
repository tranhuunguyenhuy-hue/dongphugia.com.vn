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

        await page.goto('/', { waitUntil: 'networkidle' })

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
            if (request.url().includes('/optimized-home/home-banner-')) {
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
        expect(campaignRequests[0]).toContain('.hero.w720.webp')
    })

    test('keeps each homepage category shelf in sync with its brand', async ({
        page,
    }) => {
        test.skip(
            (page.viewportSize()?.width ?? 0) >= 768,
            'Mobile interaction regression only',
        )

        await page.goto('/', { waitUntil: 'networkidle' })

        const section = page.locator(
            'section[aria-labelledby="home-category-thiet-bi-ve-sinh"]',
        )
        await section.scrollIntoViewIfNeeded()

        const brandGroup = section.getByRole('group', {
            name: 'Lọc Thiết Bị Vệ Sinh theo hãng',
        })
        await expect(
            brandGroup.getByRole('button', { name: 'Tất cả', exact: true }),
        ).toHaveAttribute('aria-pressed', 'true')
        await expect(
            section.getByRole('group', { name: 'Loại sản phẩm' }),
        ).toHaveCount(0)

        const totoButton = brandGroup.getByRole('button', {
            name: 'TOTO',
            exact: true,
        })
        await totoButton.click()
        await expect(totoButton).toHaveAttribute('aria-pressed', 'true')
        await expect(
            section.getByText(/sản phẩm nổi bật · TOTO/i),
        ).toBeVisible({ timeout: 15_000 })

        const productBrands = await section
            .locator('[data-home-product-brand]')
            .evaluateAll((elements) =>
                elements.map((element) =>
                    element.getAttribute('data-home-product-brand'),
                ),
            )
        expect(productBrands.length).toBeGreaterThan(0)
        expect(new Set(productBrands)).toEqual(new Set(['toto']))

        await expect(
            section.getByRole('link', { name: /xem danh mục TOTO/i }),
        ).toHaveAttribute('href', '/thiet-bi-ve-sinh?brands=TOTO')
        await expect(
            section.getByRole('button', {
                name: 'Xem sản phẩm Thiết Bị Vệ Sinh trước',
            }),
        ).toBeDisabled()
    })
})
