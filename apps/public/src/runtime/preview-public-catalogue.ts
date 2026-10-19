import toiletImage from '../../../../public/images/assets-v2/thumb-toilet.152w.webp'
import lavaboImage from '../../../../public/images/assets-v2/thumb-lavabo.png'
import showerImage from '../../../../public/images/assets-v2/thumb-shower.152w.webp'

import { getPublicAppEnvironment } from '../config/env'
import {
  PUBLIC_CATALOGUE_FIXTURE_PRODUCTS,
  PUBLIC_CATALOGUE_CATEGORIES,
  getPublicCataloguePath,
  resolvePublicCatalogueRoute,
} from '../routes'

const FIXTURE_IMAGES: Readonly<Record<string, string>> = {
  'thumb-toilet.152w.webp': toiletImage.src,
  'thumb-lavabo.png': lavaboImage.src,
  'thumb-shower.152w.webp': showerImage.src,
}

export const PUBLIC_CATALOGUE_FIXTURE_NOTICE =
  'Dữ liệu minh họa cục bộ cho Preview — không phải dữ liệu được khôi phục từ Production.'

function assertFixtureRuntime() {
  if (getPublicAppEnvironment().environment === 'production') {
    throw new Error('PUBLIC_CATALOGUE_FIXTURES_FORBIDDEN_IN_PRODUCTION')
  }
}

export function getPreviewCatalogueCategories() {
  assertFixtureRuntime()
  return PUBLIC_CATALOGUE_CATEGORIES
}

export function getPreviewCatalogueListings(categorySlug: string) {
  assertFixtureRuntime()
  const route = resolvePublicCatalogueRoute([categorySlug])
  return route.kind === 'category' ? route.category.listings : []
}

export function getPreviewCatalogueProducts(categorySlug: string, listingSlug: string) {
  assertFixtureRuntime()
  const route = resolvePublicCatalogueRoute([categorySlug, listingSlug])
  if (route.kind !== 'listing') return []

  return PUBLIC_CATALOGUE_FIXTURE_PRODUCTS.map((product, index) => ({
    id: index + 1,
    name: product.name,
    display_name: product.name,
    slug: product.slug,
    sku: product.sku,
    price: null,
    price_display: 'Liên hệ',
    image_main_url: FIXTURE_IMAGES[product.image] ?? null,
    stock_status: 'in_stock',
    is_active: true,
    is_featured: index === 0,
    is_promotion: false,
    variant_options: [],
    categories: { name: route.category.name, slug: route.category.slug },
    subcategories: { name: route.listing.name, slug: route.listing.slug },
    brands: product.brand,
    url: getPublicCataloguePath(route.category.slug, route.listing.slug, product.slug),
    canonical_category_slug: route.category.slug,
    canonical_subcategory_slug: route.listing.slug,
    fixtureOnly: product.fixtureOnly,
  }))
}

export function getPreviewCatalogueProduct(
  categorySlug: string,
  listingSlug: string,
  productSlug: string,
) {
  assertFixtureRuntime()
  const route = resolvePublicCatalogueRoute([categorySlug, listingSlug, productSlug])
  if (route.kind !== 'product') return null

  const imageUrl = FIXTURE_IMAGES[route.product.image] ?? null
  return {
    ...route.product,
    imageUrl,
    categoryName: route.category.name,
    listingName: route.listing.name,
    categoryPath: getPublicCataloguePath(route.category.slug),
    listingPath: getPublicCataloguePath(route.category.slug, route.listing.slug),
    productPath: getPublicCataloguePath(
      route.category.slug,
      route.listing.slug,
      route.product.slug,
    ),
    priceDisplay: 'Liên hệ',
  }
}
