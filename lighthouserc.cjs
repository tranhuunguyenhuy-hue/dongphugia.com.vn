module.exports = {
    ci: {
        collect: {
            url: ['http://localhost:3000/'],
            numberOfRuns: 3,
            startServerCommand: 'npm run start',
            startServerReadyPattern: 'Ready in|Local:',
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
            outputDir: './scripts/output/lighthouse',
        },
    },
}
