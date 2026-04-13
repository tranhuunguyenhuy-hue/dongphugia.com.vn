import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    unoptimized: true,
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
        source: '/tin-tuc',
        destination: '/blog',
      },
      {
        source: '/tin-tuc/:path*',
        destination: '/blog/:path*',
      },
      {
        source: '/admin/tin-tuc/:path*',
        destination: '/admin/blog/:path*',
      },
    ]
  },

  // LEO-392 Security Headers (SECURITY_AUDIT.md — P2)
  async headers() {
    return [
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
        ],
      },
    ]
  },
};

export default nextConfig;

