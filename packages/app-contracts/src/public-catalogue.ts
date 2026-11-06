export const PUBLIC_CATALOGUE_CONTRACT_VERSION = 'dongphugia:public-catalogue:v1'

export const PUBLIC_CATALOGUE_LIMITS = {
  defaultPage: 1,
  maximumPage: 1000,
  defaultPageSize: 24,
  maximumPageSize: 24,
  maximumValuesPerFacet: 20,
  maximumSpecificationFilters: 12,
  maximumSearchCharacters: 120,
  maximumFilterTextCharacters: 120,
} as const

export const PUBLIC_CATALOGUE_ROUTE_PATTERNS = {
  category: '/[categorySlug]',
  listing: '/[categorySlug]/[subcategorySlug]',
  product: '/[categorySlug]/[subcategorySlug]/[productSlug]',
  search: '/tim-kiem',
  sitemap: '/sitemap.xml',
} as const

export const PUBLIC_CATALOGUE_HTTP_STATUS = {
  notFound: 404,
  permanentRedirect: 301,
  unavailable: 503,
} as const

export const PUBLIC_CATALOGUE_ROBOTS = {
  indexable: 'index,follow',
  search: 'noindex,follow',
  preview: 'noindex,nofollow',
} as const

export const PUBLIC_CATALOGUE_SITEMAP_POLICY = {
  includesCanonicalPathsOnly: true,
  excludesSearch: true,
  requiresSitemapVisibility: true,
} as const

/**
 * Source-side eligibility semantics for adapters. These flags are not part of
 * a public Product DTO; only Products passing the matching surface gate may be
 * returned by the read port.
 */
export const PUBLIC_CATALOGUE_VISIBILITY_POLICY = {
  base: {
    active: true,
    excludedStockStatus: 'discontinued',
    sellableStatus: 'sellable',
    publicationStatus: 'public',
    pdpVisibility: 'public',
  },
  listing: {
    listingVisibility: ['default', 'low_priority'],
  },
  search: {
    searchVisibility: 'visible',
  },
  sitemap: {
    sitemapInclude: true,
    excludedSeoIndexing: 'noindex',
  },
} as const

export type PublicCataloguePath = `/${string}`
export type PublicCatalogueAvailability = 'InStock' | 'PreOrder' | 'QuoteOnly'
export type PublicCatalogueRobots =
  | typeof PUBLIC_CATALOGUE_ROBOTS.indexable
  | typeof PUBLIC_CATALOGUE_ROBOTS.search
  | typeof PUBLIC_CATALOGUE_ROBOTS.preview

export type PublicCataloguePagination = Readonly<{
  page: number
  pageSize: number
}>

export type PublicCatalogueSort =
  | 'default'
  | 'newest'
  | 'name_asc'
  | 'price_asc'
  | 'price_desc'
  | 'relevance'

export type PublicCatalogueSpecificationFilter = Readonly<{
  name: string
  value: string
}>

export type PublicCatalogueFilters = Readonly<{
  brandSlugs?: readonly string[]
  colorSlugs?: readonly string[]
  materialSlugs?: readonly string[]
  originSlugs?: readonly string[]
  featureSlugs?: readonly string[]
  productTypeSlugs?: readonly string[]
  productSubTypeSlugs?: readonly string[]
  priceRange?: Readonly<{ min?: number; max?: number }>
  isFeatured?: boolean
  isPromotion?: boolean
  specificationValues?: readonly PublicCatalogueSpecificationFilter[]
}>

export type PublicCataloguePrice = Readonly<{
  /** The canonical positive Dongphugia retail price, serialized as VND. */
  amount: number
  currency: 'VND'
}>

export type PublicCatalogueImage = Readonly<{
  url: string
  alt: string | null
}>

export type PublicCatalogueLabel = Readonly<{
  slug: string
  name: string
}>

export type PublicCatalogueFacetOption = PublicCatalogueLabel & Readonly<{
  productCount: number
}>

export type PublicCatalogueFacets = Readonly<{
  brands: readonly PublicCatalogueFacetOption[]
  colors: readonly PublicCatalogueFacetOption[]
  materials: readonly PublicCatalogueFacetOption[]
  origins: readonly PublicCatalogueFacetOption[]
  features: readonly PublicCatalogueFacetOption[]
  productTypes: readonly PublicCatalogueFacetOption[]
  productSubTypes: readonly PublicCatalogueFacetOption[]
  specifications: readonly Readonly<{
    name: string
    values: readonly PublicCatalogueFacetOption[]
  }>[]
}>

export type PublicCatalogueSeo = Readonly<{
  title: string
  description: string | null
  canonicalPath: PublicCataloguePath
  robots: PublicCatalogueRobots
}>

export type PublicCatalogueCategory = PublicCatalogueLabel & Readonly<{
  canonicalPath: PublicCataloguePath
  productCount: number
}>

export type PublicCatalogueListing = PublicCatalogueLabel & Readonly<{
  categorySlug: string
  canonicalPath: PublicCataloguePath
  productCount: number
}>

export type PublicCatalogueProductCard = Readonly<{
  slug: string
  sku: string
  name: string
  price: PublicCataloguePrice
  availability: PublicCatalogueAvailability
  brand: PublicCatalogueLabel | null
  mainImage: PublicCatalogueImage | null
  /** Must be the path derived from the single active primary taxonomy leaf. */
  canonicalPath: PublicCataloguePath
}>

export type PublicCatalogueProduct = PublicCatalogueProductCard & Readonly<{
  description: string | null
  images: readonly PublicCatalogueImage[]
  specifications: readonly Readonly<{ name: string; value: string }>[]
  seo: PublicCatalogueSeo
}>

export type PublicCataloguePage<T> = Readonly<{
  items: readonly T[]
  /** Values must be normalized before the read port is called. */
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}>

export type PublicCatalogueSitemapEntry = Readonly<{
  canonicalPath: PublicCataloguePath
  lastModified: string | null
}>

export type PublicCatalogueReadRequest =
  | Readonly<{ kind: 'home' }>
  | Readonly<{ kind: 'category'; categorySlug: string }>
  | Readonly<{
      kind: 'listing'
      categorySlug: string
      listingSlug: string
      pagination: PublicCataloguePagination
      sort: PublicCatalogueSort
      filters?: PublicCatalogueFilters
    }>
  | Readonly<{
      kind: 'product'
      categorySlug: string
      listingSlug: string
      productSlug: string
    }>
  | Readonly<{
      kind: 'search'
      query: string
      pagination: PublicCataloguePagination
      sort: PublicCatalogueSort
      filters?: PublicCatalogueFilters
    }>
  | Readonly<{ kind: 'sitemap'; shard: number }>

export type PublicCatalogueReadResponse =
  | Readonly<{
      kind: 'home'
      categories: readonly PublicCatalogueCategory[]
      featuredProducts: readonly PublicCatalogueProductCard[]
      seo: PublicCatalogueSeo
    }>
  | Readonly<{
      kind: 'category'
      category: PublicCatalogueCategory
      listings: readonly PublicCatalogueListing[]
      featuredProducts: readonly PublicCatalogueProductCard[]
      seo: PublicCatalogueSeo
    }>
  | Readonly<{
      kind: 'listing'
      category: PublicCatalogueCategory
      listing: PublicCatalogueListing
      products: PublicCataloguePage<PublicCatalogueProductCard>
      facets: PublicCatalogueFacets
      seo: PublicCatalogueSeo
    }>
  | Readonly<{
      kind: 'product'
      product: PublicCatalogueProduct
      breadcrumbs: readonly PublicCatalogueLabel[]
    }>
  | Readonly<{
      kind: 'search'
      query: string
      products: PublicCataloguePage<PublicCatalogueProductCard>
      facets: PublicCatalogueFacets
      seo: PublicCatalogueSeo
    }>
  | Readonly<{
      kind: 'sitemap'
      entries: readonly PublicCatalogueSitemapEntry[]
      nextShard: number | null
    }>

export type PublicCatalogueReadResult =
  | Readonly<{ kind: 'found'; data: PublicCatalogueReadResponse }>
  | Readonly<{
      kind: 'redirect'
      status: typeof PUBLIC_CATALOGUE_HTTP_STATUS.permanentRedirect
      location: PublicCataloguePath
    }>
  | Readonly<{ kind: 'not_found' }>
  | Readonly<{ kind: 'unavailable' }>

/**
 * A transport-neutral seam for read-only public catalogue data. Implementors
 * must return unavailable on read failure; there is intentionally no fixture,
 * stale-data, or default-catalogue fallback result.
 */
export interface PublicCatalogueReadPort {
  read(request: PublicCatalogueReadRequest): Promise<PublicCatalogueReadResult>
}

export function normalizePublicCataloguePagination(input: {
  page?: unknown
  pageSize?: unknown
} = {}): PublicCataloguePagination | null {
  const page = input.page === undefined
    ? PUBLIC_CATALOGUE_LIMITS.defaultPage
    : input.page
  const pageSize = input.pageSize === undefined
    ? PUBLIC_CATALOGUE_LIMITS.defaultPageSize
    : input.pageSize

  if (
    !Number.isSafeInteger(page)
    || typeof page !== 'number'
    || page < PUBLIC_CATALOGUE_LIMITS.defaultPage
    || page > PUBLIC_CATALOGUE_LIMITS.maximumPage
    || !Number.isSafeInteger(pageSize)
    || typeof pageSize !== 'number'
    || pageSize < 1
    || pageSize > PUBLIC_CATALOGUE_LIMITS.maximumPageSize
  ) {
    return null
  }

  return { page, pageSize }
}

export function isPublicCatalogueSearchQuery(value: unknown): value is string {
  return typeof value === 'string'
    && value.trim().length > 0
    && value.length <= PUBLIC_CATALOGUE_LIMITS.maximumSearchCharacters
}

const FILTER_ARRAY_KEYS = [
  'brandSlugs',
  'colorSlugs',
  'materialSlugs',
  'originSlugs',
  'featureSlugs',
  'productTypeSlugs',
  'productSubTypeSlugs',
] as const

const FILTER_KEYS = [
  ...FILTER_ARRAY_KEYS,
  'priceRange',
  'isFeatured',
  'isPromotion',
  'specificationValues',
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isPublicCataloguePrice(value: unknown): value is PublicCataloguePrice {
  if (!isRecord(value) || Object.keys(value).length !== 2) return false
  if (!Object.hasOwn(value, 'amount') || !Object.hasOwn(value, 'currency')) return false

  return typeof value.amount === 'number'
    && Number.isFinite(value.amount)
    && value.amount > 0
    && value.currency === 'VND'
}

function isBoundedText(value: unknown): value is string {
  return typeof value === 'string'
    && value.trim().length > 0
    && value.length <= PUBLIC_CATALOGUE_LIMITS.maximumFilterTextCharacters
}

function isPublicSlug(value: unknown): value is string {
  return typeof value === 'string'
    && value.length <= 80
    && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
}

function isPriceRange(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (!Object.keys(value).every((key) => key === 'min' || key === 'max')) return false

  const { min, max } = value
  if (min === undefined && max === undefined) return false
  if (min !== undefined && (typeof min !== 'number' || !Number.isFinite(min) || min < 0)) return false
  if (max !== undefined && (typeof max !== 'number' || !Number.isFinite(max) || max < 0)) return false
  if (min !== undefined && max !== undefined && min > max) return false

  return true
}

function isSpecificationFilters(value: unknown): boolean {
  return Array.isArray(value)
    && value.length <= PUBLIC_CATALOGUE_LIMITS.maximumSpecificationFilters
    && value.every((entry) => (
      isRecord(entry)
      && Object.keys(entry).every((key) => key === 'name' || key === 'value')
      && isBoundedText(entry.name)
      && isBoundedText(entry.value)
    ))
}

/**
 * Runtime guard for the small allowlist used by listing and search requests.
 * It rejects unknown fields and oversized facet/specification lists rather
 * than silently dropping or forwarding them.
 */
export function isPublicCatalogueFilters(value: unknown): value is PublicCatalogueFilters {
  if (!isRecord(value)) return false
  if (!Object.keys(value).every((key) => (FILTER_KEYS as readonly string[]).includes(key))) {
    return false
  }

  for (const key of FILTER_ARRAY_KEYS) {
    const values = value[key]
    if (values === undefined) continue
    if (
      !Array.isArray(values)
      || values.length > PUBLIC_CATALOGUE_LIMITS.maximumValuesPerFacet
      || !values.every(isPublicSlug)
    ) {
      return false
    }
  }

  if (value.priceRange !== undefined && !isPriceRange(value.priceRange)) return false
  if (value.isFeatured !== undefined && typeof value.isFeatured !== 'boolean') return false
  if (value.isPromotion !== undefined && typeof value.isPromotion !== 'boolean') return false
  if (
    value.specificationValues !== undefined
    && !isSpecificationFilters(value.specificationValues)
  ) {
    return false
  }

  return true
}
