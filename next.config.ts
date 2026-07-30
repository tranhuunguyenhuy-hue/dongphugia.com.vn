import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  poweredByHeader: false,
  reactCompiler: true,
  images: {
    // Product media already comes from image CDNs. Bypass Vercel's optimizer so
    // exhausted optimization quota cannot turn valid images into HTTP 402s.
    unoptimized: true,
    qualities: [75, 100],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'tygjmrhandbffjllxveu.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'vietceramics.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      // Hita CDN (primary)
      {
        protocol: 'https',
        hostname: 'cdn.hita.com.vn',
        pathname: '/**',
      },
      // Hita direct (163 products — non-CDN URLs from crawl)
      {
        protocol: 'https',
        hostname: 'hita.com.vn',
        pathname: '/**',
      },
      // Dong Phu Gia CDN (3,383 products — TBVS + Gach)
      {
        protocol: 'https',
        hostname: 'cdn.dongphugia.com.vn',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns', 'lodash'],
  },
  async rewrites() {
    return [
      {
        source: '/admin/tin-tuc/:path*',
        destination: '/admin/blog/:path*',
      },
      {
        source: '/sitemap_product_:id.xml',
        destination: '/api/sitemap/:id',
      }
    ]
  },

  // 301 redirects: category query-param → clean URLs
  // Product slug redirects are handled in middleware.ts (3,000+ entries)
  async redirects() {
    const CATEGORIES = [
      'thiet-bi-ve-sinh',
      'thiet-bi-bep',
      'vat-lieu-nuoc',
      'gach-op-lat',
    ]
    const categoryRedirects = CATEGORIES.map((cat) => ({
      source: `/${cat}`,
      has: [{ type: 'query' as const, key: 'sub', value: '(?<sub>.+)' }],
      destination: `/${cat}/:sub`,
      permanent: true,
    }))

    return [
      {
        source: '/tin-tuc',
        destination: '/blog',
        permanent: true,
      },
      {
        source: '/tin-tuc/:path*',
        destination: '/blog/:path*',
        permanent: true,
      },
      ...categoryRedirects,
    ]
  },

  // LEO-392 Security Headers (SECURITY_AUDIT.md — P2)
  async headers() {
    const enforceHttps =
      (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.dongphugia.vn')
        .startsWith('https://')
    const cspDirectives = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'self'",
      "form-action 'self'",
      "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://cdn.dongphugia.com.vn https://tygjmrhandbffjllxveu.supabase.co https://vietceramics.com https://images.unsplash.com https://cdn.hita.com.vn https://hita.com.vn https://www.transparenttextures.com",
      "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://www.googletagmanager.com",
      "frame-src 'self' https://maps.google.com",
      ...(enforceHttps ? ['upgrade-insecure-requests'] : []),
    ].join('; ')

    return [
      {
        source: '/',
        headers: [
          {
            key: 'Link',
            value: '</api/homepage-hero?width=720>; rel=preload; as=image; type=image/webp; media="(max-width: 767px)", </api/homepage-hero?width=1280>; rel=preload; as=image; type=image/webp; media="(min-width: 768px)"',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          // Prevent clickjacking
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // Prevent MIME type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Control referrer information
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Disable unnecessary browser features
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
          // Enforce HTTPS on HTTPS deployments only. Subdomains/preload remain intentionally disabled.
          ...(enforceHttps ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }] : []),
          {
            key: 'Content-Security-Policy',
            value: cspDirectives,
          },
        ],
      },
    ]
  },
};

export default nextConfig;
