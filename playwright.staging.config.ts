import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.STAGING_SITE_URL

if (baseURL !== 'https://dongphugia-staging.47-131-92-97.sslip.io') {
    throw new Error('STAGING_SITE_URL must be the approved staging URL.')
}

export default defineConfig({
    testDir: './tests/staging-preview',
    testMatch: '**/*.e2e.ts',
    outputDir: 'artifacts/staging-preview/playwright',
    fullyParallel: false,
    forbidOnly: true,
    retries: 0,
    workers: 1,
    reporter: [
        ['list'],
        ['html', { outputFolder: 'artifacts/staging-preview/playwright-report', open: 'never' }],
    ],
    use: {
        baseURL,
        trace: 'on',
        screenshot: 'only-on-failure',
        ignoreHTTPSErrors: false,
    },
    projects: [
        {
            name: 'desktop-1440',
            use: {
                ...devices['Desktop Chrome'],
                viewport: { width: 1440, height: 1000 },
            },
        },
        {
            name: 'mobile-390',
            use: {
                ...devices['iPhone 13'],
                browserName: 'chromium',
                viewport: { width: 390, height: 844 },
            },
        },
    ],
})
