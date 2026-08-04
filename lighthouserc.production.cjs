const baseUrl = process.env.PRODUCTION_BASE_URL || 'https://www.dongphugia.vn'

let parsedBaseUrl
try {
    parsedBaseUrl = new URL(baseUrl)
} catch {
    throw new Error('PRODUCTION_BASE_URL must be an absolute HTTPS URL')
}

if (parsedBaseUrl.protocol !== 'https:') {
    throw new Error('Production Lighthouse must use HTTPS')
}

const allowedHosts = new Set([
    'www.dongphugia.vn',
    'dongphugia.vn',
])

if (!allowedHosts.has(parsedBaseUrl.hostname)) {
    throw new Error('Production Lighthouse refuses non-.vn hosts')
}

// Keep the strict SEO assertion on indexable pages. The search route is
// intentionally noindex and is covered by the read-only HTTPS route probe.
const paths = [
    '/',
    '/gach-op-lat',
]

const urls = paths.map((path) => new URL(path, parsedBaseUrl).toString())

module.exports = {
    ci: {
        collect: {
            url: urls,
            numberOfRuns: 5,
            settings: {
                formFactor: 'mobile',
                screenEmulation: {
                    mobile: true,
                    width: 390,
                    height: 844,
                    deviceScaleFactor: 2,
                    disabled: false,
                },
                throttlingMethod: 'simulate',
                saveAssets: false,
                onlyCategories: [
                    'performance',
                    'accessibility',
                    'best-practices',
                    'seo',
                ],
            },
        },
        assert: {
            assertions: {
                'categories:performance': ['error', { minScore: 0.9 }],
                'categories:accessibility': ['error', { minScore: 0.95 }],
                'categories:best-practices': ['error', { minScore: 0.95 }],
                'categories:seo': ['error', { minScore: 0.95 }],
                'largest-contentful-paint': [
                    'error',
                    { maxNumericValue: 2500 },
                ],
                'cumulative-layout-shift': [
                    'error',
                    { maxNumericValue: 0.1 },
                ],
                'total-blocking-time': [
                    'error',
                    { maxNumericValue: 200 },
                ],
                'total-byte-weight': [
                    'error',
                    { maxNumericValue: 2 * 1024 * 1024 },
                ],
                'dom-size': ['error', { maxNumericValue: 1500 }],
                'errors-in-console': ['error', { maxLength: 0 }],
            },
        },
        upload: {
            target: 'filesystem',
            outputDir: './scripts/output/lighthouse-production',
        },
    },
}
