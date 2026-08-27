import { defineConfig, devices } from '@playwright/test'

const remoteBaseUrl = process.env.STAGING_BROWSER_BASE_URL
if (remoteBaseUrl && !/^http:\/\/127\.0\.0\.1:\d+$/.test(remoteBaseUrl)) {
    throw new Error('STAGING_BROWSER_BASE_URL must be a local HTTP port-forward URL')
}

export default defineConfig({
    testDir: './tests/readiness',
    fullyParallel: false,
    retries: 1,
    reporter: [['list'], ['html', {
        outputFolder: 'scripts/output/playwright-report',
        open: 'never',
    }]],
    use: {
        baseURL: remoteBaseUrl ?? 'http://localhost:3000',
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
    webServer: remoteBaseUrl ? undefined : {
        command: 'node .next/standalone/server.js',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120_000,
    },
})
