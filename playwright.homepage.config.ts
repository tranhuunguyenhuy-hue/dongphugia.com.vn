import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
    testDir: './tests/readiness',
    fullyParallel: false,
    retries: 1,
    reporter: [['list'], ['html', {
        outputFolder: 'scripts/output/playwright-report',
        open: 'never',
    }]],
    use: {
        baseURL: 'http://localhost:3000',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    projects: [
        {
            name: 'mobile-390',
            use: {
                ...devices['iPhone 13'],
                browserName: 'chromium',
                viewport: { width: 390, height: 844 },
            },
        },
        {
            name: 'tablet-768',
            use: {
                viewport: { width: 768, height: 1024 },
            },
        },
        {
            name: 'desktop-1440',
            use: {
                viewport: { width: 1440, height: 1000 },
            },
        },
    ],
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120_000,
    },
})
