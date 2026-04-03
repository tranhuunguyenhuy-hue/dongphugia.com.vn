import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    formats: ['image/avif', 'image/webp'],
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
      {
        protocol: 'https',
        hostname: 'www.tdm.vn',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'tdm.vn',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'tuandat.vn',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.hita.com.vn',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'www.tdm.vn',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'tdm.vn',
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
};

export default nextConfig;
