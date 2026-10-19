import {
  PUBLIC_ROUTE_OWNERSHIP,
  type ApplicationName,
} from '@dpg/app-contracts'

export const PUBLIC_APPLICATION_NAME: ApplicationName = 'public'
export { PUBLIC_ROUTE_OWNERSHIP }

export type PublicCatalogueListing = Readonly<{
  slug: string
  name: string
  legacySlugs?: readonly string[]
}>

export type PublicCatalogueCategory = Readonly<{
  slug: string
  name: string
  listings: readonly PublicCatalogueListing[]
}>

export type PublicCatalogueFixtureProduct = Readonly<{
  name: string
  slug: string
  sku: string
  image: string
  brand: Readonly<{ name: string; slug: string }>
  fixtureOnly: true
}>

export const PUBLIC_CATALOGUE_CATEGORIES: readonly PublicCatalogueCategory[] = [
  {
    slug: 'thiet-bi-ve-sinh',
    name: 'Thiết bị vệ sinh',
    listings: [{ slug: 'bon-cau', name: 'Bồn cầu' }],
  },
  {
    slug: 'thiet-bi-bep',
    name: 'Thiết bị bếp',
    listings: [{ slug: 'chau-rua-chen', name: 'Chậu rửa chén' }],
  },
  {
    slug: 'vat-lieu-nuoc',
    name: 'Vật liệu nước',
    listings: [{ slug: 'may-bom-nuoc', name: 'Máy bơm nước' }],
  },
  {
    slug: 'gach-op-lat',
    name: 'Gạch ốp lát',
    listings: [
      {
        slug: 'gach-van-da-marble',
        name: 'Gạch vân đá marble',
        legacySlugs: ['gach-marble'],
      },
    ],
  },
]

export const PUBLIC_CATALOGUE_FIXTURE_PRODUCTS: readonly PublicCatalogueFixtureProduct[] = [
  {
    name: 'Bàn cầu một khối cao cấp',
    slug: 'ban-cau-mot-khoi-cao-cap',
    sku: 'DPG-PREVIEW-001',
    image: 'thumb-toilet.152w.webp',
    brand: { name: 'TOTO', slug: 'toto' },
    fixtureOnly: true,
  },
  {
    name: 'Chậu rửa hiện đại',
    slug: 'chau-rua-hien-dai',
    sku: 'DPG-PREVIEW-002',
    image: 'thumb-lavabo.png',
    brand: { name: 'INAX', slug: 'inax' },
    fixtureOnly: true,
  },
  {
    name: 'Vòi sen phòng tắm',
    slug: 'voi-sen-phong-tam',
    sku: 'DPG-PREVIEW-003',
    image: 'thumb-shower.152w.webp',
    brand: { name: 'Grohe', slug: 'grohe' },
    fixtureOnly: true,
  },
]

export type PublicCatalogueRoute =
  | { kind: 'home' }
  | { kind: 'category'; category: PublicCatalogueCategory }
  | {
      kind: 'listing'
      category: PublicCatalogueCategory
      listing: PublicCatalogueListing
    }
  | {
      kind: 'product'
      category: PublicCatalogueCategory
      listing: PublicCatalogueListing
      product: PublicCatalogueFixtureProduct
    }
  | { kind: 'redirect'; destination: string }
  | { kind: 'not-found' }

const SAFE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function resolvePublicCatalogueRoute(segments: readonly string[]): PublicCatalogueRoute {
  if (segments.length === 0) return { kind: 'home' }
  if (segments.some((segment) => !SAFE_SLUG_PATTERN.test(segment))) {
    return { kind: 'not-found' }
  }

  const category = PUBLIC_CATALOGUE_CATEGORIES.find(({ slug }) => slug === segments[0])
  if (!category) return { kind: 'not-found' }
  if (segments.length === 1) return { kind: 'category', category }
  if (segments.length > 3) return { kind: 'not-found' }

  const requestedListing = segments[1]
  const canonicalListing = category.listings.find(({ slug }) => slug === requestedListing)
  if (!canonicalListing && segments.length === 2) {
    const legacyProduct = PUBLIC_CATALOGUE_FIXTURE_PRODUCTS.find(
      ({ slug }) => slug === requestedListing,
    )
    const defaultListing = category.listings[0]
    if (legacyProduct && defaultListing) {
      return {
        kind: 'redirect',
        destination: getPublicCataloguePath(category.slug, defaultListing.slug, legacyProduct.slug),
      }
    }
  }

  const listing =
    canonicalListing ??
    category.listings.find(({ legacySlugs }) => legacySlugs?.includes(requestedListing))
  if (!listing) return { kind: 'not-found' }
  if (segments.length === 2) {
    return canonicalListing
      ? { kind: 'listing', category, listing }
      : { kind: 'redirect', destination: getPublicCataloguePath(category.slug, listing.slug) }
  }

  const product = PUBLIC_CATALOGUE_FIXTURE_PRODUCTS.find(({ slug }) => slug === segments[2])
  if (!product) return { kind: 'not-found' }
  if (!canonicalListing) {
    return {
      kind: 'redirect',
      destination: getPublicCataloguePath(category.slug, listing.slug, product.slug),
    }
  }
  return { kind: 'product', category, listing, product }
}

export function getPublicCataloguePath(
  categorySlug: string,
  listingSlug?: string,
  productSlug?: string,
) {
  return `/${[categorySlug, listingSlug, productSlug].filter(Boolean).join('/')}`
}
