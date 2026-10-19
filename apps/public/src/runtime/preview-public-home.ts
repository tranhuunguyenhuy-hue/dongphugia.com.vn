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
  // The empty value intentionally exercises the canonical local fallback hero.
  return []
}

export async function getPublicHomeContent(): Promise<PublicHomeContent> {
  const categories: readonly PublicHomeCategory[] = getPreviewCatalogueCategories().map((category) => {
    const listing = category.listings[0]
    const products = listing
      ? getPreviewCatalogueProducts(category.slug, listing.slug)
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
      totalCount: products.length,
      availableBrands,
      availableSubcategories: category.listings.map(({ name, slug }) => ({ name, slug })),
    }
  })

  return {
    categories,
    posts: [],
    previewNotice: PUBLIC_CATALOGUE_FIXTURE_NOTICE,
  }
}
