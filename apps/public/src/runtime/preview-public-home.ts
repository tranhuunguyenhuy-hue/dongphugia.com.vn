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

export async function getPublicHomeBanners(): Promise<PublicHomePageData['banners']> {
  if (process.env.APP_ENV !== 'production') return []
  return [{
    id: 1,
    title: 'Thiết bị bếp Đông Phú Gia',
    imageUrl: '/banners/banner-kitchen.jpg',
    mobileImageUrl: '/banners/banner-kitchen.hero.w720.webp',
    desktopImageUrl: '/banners/banner-kitchen.hero.w1280.webp',
    desktopLargeImageUrl: '/banners/banner-kitchen.hero.w1600.webp',
    linkUrl: '/thiet-bi-bep',
  }]
}

export async function getPublicHomeContent(): Promise<PublicHomeContent> {
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
    posts: [],
    previewNotice: process.env.APP_ENV === 'production' ? undefined : PUBLIC_CATALOGUE_FIXTURE_NOTICE,
  }
}
