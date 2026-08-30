import type { NextConfig } from 'next'

import { getAdminAppEnvironment } from './src/config/env'

const appEnvironment = getAdminAppEnvironment()

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async generateBuildId() {
    return process.env.BUILD_SOURCE_SHA?.trim() || 'local-admin-foundation'
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
    ]
  },
}

void appEnvironment

export default nextConfig
