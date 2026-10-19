import { describe, expect, it, vi } from 'vitest'

const cacheContract = vi.hoisted(() => ({
  keyParts: [] as string[],
  options: undefined as { revalidate: number; tags: string[] } | undefined,
  query: vi.fn().mockResolvedValue({ products: [], total: 0 }),
  findMany: vi.fn().mockResolvedValue([]),
}))

vi.mock('next/cache', () => ({
  unstable_cache: (
    callback: (...args: unknown[]) => unknown,
    keyParts: string[],
    options: { revalidate: number; tags: string[] },
  ) => {
    cacheContract.keyParts = keyParts
    cacheContract.options = options
    return (...args: unknown[]) => callback(...args)
  },
}))

vi.mock('@/lib/homepage-data', () => ({ getHomepageBanners: vi.fn().mockResolvedValue([]) }))
vi.mock('@/lib/media/media-profiles', () => ({ createResponsiveMediaUrl: (url: string) => url }))
vi.mock('@/lib/prisma', () => ({
  default: {
    brands: { findMany: cacheContract.findMany },
    subcategories: { findMany: cacheContract.findMany },
    blog_posts: { findMany: cacheContract.findMany },
  },
}))
vi.mock('@/lib/public-api-products', () => ({
  getFeaturedProductsByCategorySlug: cacheContract.query,
}))
vi.mock('@/lib/public-product-visibility', () => ({ buildPublicListingVisibilityWhere: () => ({}) }))
vi.mock('@/lib/runtime-query-diagnostics', () => ({
  withRuntimeQueryDiagnostic: (_name: string, callback: () => unknown) => callback(),
}))

import { getPublicHomeContent } from './legacy-public-home'

describe('legacy public homepage content cache', () => {
  it('keeps the established one-hour cache and homepage invalidation tag', async () => {
    await getPublicHomeContent()

    expect(cacheContract.keyParts).toEqual(['homepage-content-data-v1'])
    expect(cacheContract.options).toEqual({ revalidate: 3600, tags: ['homepage'] })
  })
})
