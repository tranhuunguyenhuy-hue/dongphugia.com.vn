import { existsSync } from 'node:fs'
import path from 'node:path'

import type {
  PublicHomeBanner,
  PublicHomeCategory,
  PublicHomePageData,
  PublicHomePost,
  PublicHomeProduct,
} from '@dpg/app-contracts'

import { getHomepageBanners } from '@/lib/homepage-data'
import { createResponsiveMediaUrl } from '@/lib/media/media-profiles'
import prisma from '@/lib/prisma'
import { getFeaturedProductsByCategorySlug } from '@/lib/public-api-products'
import { buildPublicListingVisibilityWhere } from '@/lib/public-product-visibility'
import { withRuntimeQueryDiagnostic } from '@/lib/runtime-query-diagnostics'

function localResponsiveAsset(url: string, width: number) {
  if (!url.startsWith('/')) return null
  const candidate = createResponsiveMediaUrl(url, width)
  return existsSync(path.join(process.cwd(), 'public', candidate))
    ? candidate
    : null
}

function serializeBanner(banner: {
  id: number
  title: string | null
  image_url: string
  link_url: string | null
}): PublicHomeBanner {
  return {
    id: banner.id,
    title: banner.title,
    imageUrl: banner.image_url,
    linkUrl: banner.link_url,
    mobileImageUrl: localResponsiveAsset(banner.image_url, 720),
    desktopImageUrl: localResponsiveAsset(banner.image_url, 1280),
    desktopLargeImageUrl: localResponsiveAsset(banner.image_url, 1600),
  }
}

export async function getPublicHomeBanners(): Promise<PublicHomeBanner[]> {
  const banners = await getHomepageBanners()
  return banners.map(serializeBanner)
}

export async function getPublicHomeContent(): Promise<
  Pick<PublicHomePageData, 'categories' | 'posts'>
> {
  const publicTbvsProducts = {
    ...buildPublicListingVisibilityWhere(),
    categories: { slug: 'thiet-bi-ve-sinh' },
  }
  const publicKitchenProducts = {
    ...buildPublicListingVisibilityWhere(),
    categories: { slug: 'thiet-bi-bep' },
  }

  const [
    tbvsData,
    kitchenData,
    tileData,
    waterData,
    tbvsBrands,
    tbvsSubcategories,
    kitchenSubcategories,
    kitchenBrands,
    posts,
  ] = await Promise.all([
    withRuntimeQueryDiagnostic('homepage_featured_tbvs', () =>
      getFeaturedProductsByCategorySlug('thiet-bi-ve-sinh', ['toto', 'inax'], null, 0, 3),
    ),
    withRuntimeQueryDiagnostic('homepage_featured_kitchen', () =>
      getFeaturedProductsByCategorySlug('thiet-bi-bep', null, null, 0, 3),
    ),
    withRuntimeQueryDiagnostic('homepage_featured_tiles', () =>
      getFeaturedProductsByCategorySlug('gach-op-lat', null, null, 0, 3),
    ),
    withRuntimeQueryDiagnostic('homepage_featured_water', () =>
      getFeaturedProductsByCategorySlug('vat-lieu-nuoc', null, null, 0, 3),
    ),
    withRuntimeQueryDiagnostic('homepage_brands_tbvs', () =>
      prisma.brands.findMany({
        where: { products: { some: publicTbvsProducts } },
        select: { name: true, slug: true },
      }),
    ),
    withRuntimeQueryDiagnostic('homepage_subcategories_tbvs', () =>
      prisma.subcategories.findMany({
        where: {
          categories: { slug: 'thiet-bi-ve-sinh' },
          products: { some: publicTbvsProducts },
        },
        select: { name: true, slug: true },
      }),
    ),
    withRuntimeQueryDiagnostic('homepage_subcategories_kitchen', () =>
      prisma.subcategories.findMany({
        where: {
          categories: { slug: 'thiet-bi-bep' },
          slug: { notIn: ['thiet-bi-bep-khac'] },
          products: { some: publicKitchenProducts },
        },
        select: { name: true, slug: true },
      }),
    ),
    withRuntimeQueryDiagnostic('homepage_brands_kitchen', () =>
      prisma.brands.findMany({
        where: { products: { some: publicKitchenProducts } },
        select: { name: true, slug: true },
      }),
    ),
    prisma.blog_posts.findMany({
      where: { status: 'published', published_at: { lte: new Date() } },
      include: { blog_categories: true },
      orderBy: { created_at: 'desc' },
      take: 3,
    }),
  ])

  const categories: PublicHomeCategory[] = [
    {
      id: 'thiet-bi-ve-sinh',
      label: 'Thiết Bị Vệ Sinh',
      basePath: '/thiet-bi-ve-sinh',
      products: tbvsData.products as PublicHomeProduct[],
      totalCount: tbvsData.total,
      availableBrands: tbvsBrands,
      availableSubcategories: tbvsSubcategories,
    },
    {
      id: 'thiet-bi-bep',
      label: 'Thiết Bị Bếp',
      basePath: '/thiet-bi-bep',
      products: kitchenData.products as PublicHomeProduct[],
      totalCount: kitchenData.total,
      availableBrands: kitchenBrands,
      availableSubcategories: kitchenSubcategories,
    },
    {
      id: 'vat-lieu-nuoc',
      label: 'Vật Liệu Nước',
      basePath: '/vat-lieu-nuoc',
      products: waterData.products as PublicHomeProduct[],
      totalCount: waterData.total,
    },
    {
      id: 'gach-op-lat',
      label: 'Gạch Ốp Lát',
      basePath: '/gach-op-lat',
      products: tileData.products as PublicHomeProduct[],
      totalCount: tileData.total,
    },
  ].filter((category) => category.products.length > 0)

  const serializedPosts: PublicHomePost[] = posts.map((post) => ({
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    thumbnailUrl: post.thumbnail_url,
    publishedAt: (post.published_at ?? post.created_at).toISOString(),
    category: post.blog_categories
      ? { name: post.blog_categories.name, slug: post.blog_categories.slug }
      : null,
  }))

  return {
    categories,
    posts: serializedPosts,
  }
}
