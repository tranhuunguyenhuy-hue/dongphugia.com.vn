const toiletListingUrl = 'http://localhost:3000/thiet-bi-ve-sinh/bon-cau'

module.exports = {
    ci: {
        collect: {
            url: [toiletListingUrl],
            numberOfRuns: 3,
            startServerCommand: 'node .next/standalone/server.js',
            startServerReadyPattern: 'Ready in|Local:|http://',
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
                saveAssets: true,
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
                'errors-in-console': ['error', { maxLength: 0 }],
            },
        },
        upload: {
            target: 'filesystem',
            outputDir: './scripts/output/lighthouse-toilet',
        },
    },
}
