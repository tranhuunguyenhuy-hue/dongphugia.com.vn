import { publicPostgresEnabled } from './public-db'
import type {
  PublicHomeCategory,
  PublicHomeContent,
  PublicHomePageData,
} from '@dpg/app-contracts'
import {
  getPreviewCatalogueCategories,
  getPreviewCatalogueProducts,
  PUBLIC_CATALOGUE_FIXTURE_NOTICE,
} from './preview-public-catalogue'
import { usesPublicSnapshot } from './public-snapshot-mode'
import { readSnapshotManifest } from './public-snapshot-catalogue'
import { historicalBlogImage } from './legacy-blog'
import { getPublicBlogPosts } from './live-public-blog'

export async function getPublicHomeBanners(): Promise<PublicHomePageData['banners']> {
  if (process.env.APP_ENV !== 'production') return []
  // Owner-verified historical Production artwork, archived in the legacy Supabase Storage bucket.
  // These three objects correspond to inactive legacy DB rows (6, 4, 5); Owner confirmed
  // the artworks and order, independently of those historical is_active flags.
  // Keep the local /images/banner-*.jpg assets as a rollback option until assets are mirrored.
  return [
    {
      id: 6,
      title: 'Banner 1',
      imageUrl: 'https://tygjmrhandbffjllxveu.supabase.co/storage/v1/object/public/images/banners/1776486977694-87cnaa.png',
      mobileImageUrl: 'https://tygjmrhandbffjllxveu.supabase.co/storage/v1/object/public/images/banners/1776486977694-87cnaa.png',
      desktopImageUrl: 'https://tygjmrhandbffjllxveu.supabase.co/storage/v1/object/public/images/banners/1776486977694-87cnaa.png',
      desktopLargeImageUrl: 'https://tygjmrhandbffjllxveu.supabase.co/storage/v1/object/public/images/banners/1776486977694-87cnaa.png',
      linkUrl: null,
    },
    {
      id: 4,
      title: 'Banner 2',
      imageUrl: 'https://tygjmrhandbffjllxveu.supabase.co/storage/v1/object/public/images/banners/1776485447824-r0eml8.png',
      mobileImageUrl: 'https://tygjmrhandbffjllxveu.supabase.co/storage/v1/object/public/images/banners/1776485447824-r0eml8.png',
      desktopImageUrl: 'https://tygjmrhandbffjllxveu.supabase.co/storage/v1/object/public/images/banners/1776485447824-r0eml8.png',
      desktopLargeImageUrl: 'https://tygjmrhandbffjllxveu.supabase.co/storage/v1/object/public/images/banners/1776485447824-r0eml8.png',
      linkUrl: null,
    },
    {
      id: 5,
      title: 'Banner 3',
      imageUrl: 'https://tygjmrhandbffjllxveu.supabase.co/storage/v1/object/public/images/banners/1776485426606-t2pflg.png',
      mobileImageUrl: 'https://tygjmrhandbffjllxveu.supabase.co/storage/v1/object/public/images/banners/1776485426606-t2pflg.png',
      desktopImageUrl: 'https://tygjmrhandbffjllxveu.supabase.co/storage/v1/object/public/images/banners/1776485426606-t2pflg.png',
      desktopLargeImageUrl: 'https://tygjmrhandbffjllxveu.supabase.co/storage/v1/object/public/images/banners/1776485426606-t2pflg.png',
      linkUrl: null,
    },
  ]
}

export async function getPublicHomeContent(): Promise<PublicHomeContent> {
  const blogPosts = await getPublicBlogPosts()
  const catalogueManifest = usesPublicSnapshot() && !publicPostgresEnabled() ? await readSnapshotManifest() : null
  const categories: readonly PublicHomeCategory[] = await Promise.all((await getPreviewCatalogueCategories()).map(async (category) => {
    const listing = category.listings[0]
    const products = listing
      ? (await getPreviewCatalogueProducts(category.slug, listing.slug)).slice(0, 8)
      : []
    const availableBrands = products.reduce<Array<{ name: string; slug: string }>>((brands, product) => {
      const brand = product.brands as { name: string; slug: string } | undefined
      if (brand && !brands.some(({ slug }) => slug === brand.slug)) brands.push(brand)
      return brands
    }, [])

    return {
      id: category.slug,
      label: category.name,
      basePath: `/${category.slug}`,
      products,
      totalCount: 'totalCount' in category ? Number(category.totalCount) : products.length,
      availableBrands,
      availableSubcategories: category.listings.map(({ name, slug }) => ({ name, slug })),
    }
  }))

  return {
    categories,
    posts: process.env.APP_ENV === 'production' ? blogPosts.slice(0, 3).map((post) => ({
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          thumbnailUrl: historicalBlogImage(post.thumbnail_url),
          publishedAt: post.published_at,
          category: { name: post.category.name, slug: post.category.slug },
        })) : [],
    previewNotice: process.env.APP_ENV === 'production' ? undefined : catalogueManifest
      ? `${PUBLIC_CATALOGUE_FIXTURE_NOTICE} Checkpoint: ${catalogueManifest.checkpoint}. Banner và Blog được ẩn vì chưa xác minh được tuyến nội dung công khai. Dữ liệu Admin riêng tư, xác thực, đơn hàng và mọi thao tác ghi không khả dụng trong môi trường này.`
      : PUBLIC_CATALOGUE_FIXTURE_NOTICE,
  }
}
