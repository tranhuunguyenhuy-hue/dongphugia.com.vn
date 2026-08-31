import type { NextConfig } from 'next'

import { getPublicAppEnvironment } from './src/config/env'
import { PUBLIC_PREVIEW_ROBOTS_HEADER } from './src/worker-policy'

const appEnvironment = getPublicAppEnvironment()

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  ...(appEnvironment.previewNoindex
    ? [{ key: 'X-Robots-Tag', value: PUBLIC_PREVIEW_ROBOTS_HEADER }]
    : []),
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async generateBuildId() {
    return process.env.BUILD_SOURCE_SHA?.trim() || 'local-public-foundation'
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store' },
        ],
      },
    ]
  },
}

export default nextConfig
