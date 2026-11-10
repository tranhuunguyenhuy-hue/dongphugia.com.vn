import { usesPublicSnapshot, PUBLIC_SNAPSHOT_NOTICE, getSnapshotCategories, getSnapshotProducts, getSnapshotProduct, resolveSnapshotRoute } from './public-snapshot-catalogue'
import toiletImage from '../../../../public/images/assets-v2/thumb-toilet.152w.webp'
import lavaboImage from '../../../../public/images/assets-v2/thumb-lavabo.png'
import showerImage from '../../../../public/images/assets-v2/thumb-shower.152w.webp'

import { getPublicAppEnvironment } from '../config/env'
import {
  PUBLIC_CATALOGUE_FIXTURE_PRODUCTS,
  PUBLIC_CATALOGUE_CATEGORIES,
  getPublicCataloguePath,
  resolvePublicCatalogueRoute as resolveFixturePublicCatalogueRoute,
} from '../routes'
import { selectSnapshotVariantData } from './variant-selection-contract'
import type { SnapshotVariantMember } from './variant-selection-contract'
import type { VariantSibling } from '../../../../src/lib/public-api-products'

type PreviewVariantMember = SnapshotVariantMember & VariantSibling & {
  list_price: number | null
  sale_price: number | null
  variant_group: string
  variant_type: 'seat_type'
  variant_label: string
}

const FIXTURE_IMAGES: Readonly<Record<string, string>> = {
  'thumb-toilet.152w.webp': toiletImage.src,
  'thumb-lavabo.png': lavaboImage.src,
  'thumb-shower.152w.webp': showerImage.src,
}

export const PUBLIC_CATALOGUE_FIXTURE_NOTICE = usesPublicSnapshot() ? PUBLIC_SNAPSHOT_NOTICE :
  'Dữ liệu minh họa cục bộ cho Preview — không phải dữ liệu được khôi phục từ Production; tên sản phẩm, thương hiệu và liên kết sản phẩm/danh mục chỉ là fixture kiểm thử, chưa xác minh với catalogue chính thức.'

function assertFixtureRuntime() {
  if (getPublicAppEnvironment().environment === 'production') {
    throw new Error('PUBLIC_CATALOGUE_FIXTURES_FORBIDDEN_IN_PRODUCTION')
  }
}

export async function getPreviewCatalogueCategories() {
  if (usesPublicSnapshot()) return getSnapshotCategories()
  assertFixtureRuntime()
  return PUBLIC_CATALOGUE_CATEGORIES
}

export async function getPreviewCatalogueListings(categorySlug: string) {
  if (usesPublicSnapshot()) return (await getSnapshotCategories()).find(c => c.slug === categorySlug)?.listings ?? []
  assertFixtureRuntime()
  const route = resolveFixturePublicCatalogueRoute([categorySlug])
  return route.kind === 'category' ? route.category.listings : []
}

export async function getPreviewCatalogueProducts(categorySlug: string, listingSlug: string, page = 1) {
  if (usesPublicSnapshot()) return (await getSnapshotProducts(categorySlug, listingSlug, page)).products
  assertFixtureRuntime()
  const route = resolveFixturePublicCatalogueRoute([categorySlug, listingSlug])
  if (route.kind !== 'listing') return []
  if (route.category.slug !== 'preview-synthetic' || route.listing.slug !== 'sku-options') return []

  return PUBLIC_CATALOGUE_FIXTURE_PRODUCTS
    .filter(product => product.productId && product.priceVnd && product.variantGroup)
    .map((product, index) => {
      const record = buildFixtureProductRecord(product, route.category, route.listing)
      return {
        ...record,
        is_featured: index === 0,
        is_promotion: false,
        variant_options: [],
        fixtureOnly: true as const,
      }
    })
}

function buildFixtureProductRecord(
  product: (typeof PUBLIC_CATALOGUE_FIXTURE_PRODUCTS)[number],
  category: (typeof PUBLIC_CATALOGUE_CATEGORIES)[number],
  listing: (typeof PUBLIC_CATALOGUE_CATEGORIES)[number]['listings'][number],
) {
  const imageUrl = FIXTURE_IMAGES[product.image] ?? null
  const price = product.priceVnd ?? null
  const priceDisplay = price === null ? 'Liên hệ' : `Giá kiểm thử ${new Intl.NumberFormat('vi-VN').format(price)} ₫`
  const variantOptions = product.variantGroup && product.variantLabel && product.variantValue
    ? [{ axis: 'seat_type' as const, value: product.variantValue, label: product.variantLabel }]
    : []

  return {
    id: product.productId ?? PUBLIC_CATALOGUE_FIXTURE_PRODUCTS.findIndex(candidate => candidate.sku === product.sku) + 1,
    name: product.name,
    display_name: product.name,
    slug: product.slug,
    sku: product.sku,
    price,
    price_display: priceDisplay,
    original_price: null,
    list_price: null,
    sale_price: null,
    online_discount_amount: null,
    image_main_url: imageUrl,
    stock_status: price === null ? 'contact' as const : 'in_stock' as const,
    is_active: true as const,
    is_promotion: false,
    variant_options: variantOptions,
    variant_group: product.variantGroup,
    variant_type: product.variantGroup ? 'seat_type' as const : null,
    variant_label: product.variantLabel ?? null,
    categories: { name: category.name, slug: category.slug },
    subcategories: { name: listing.name, slug: listing.slug },
    brands: product.brand,
    url: getPublicCataloguePath(category.slug, listing.slug, product.slug),
    canonical_category_slug: category.slug,
    canonical_subcategory_slug: listing.slug,
    fixtureOnly: product.fixtureOnly,
  }
}

function previewVariantMembers() {
  const category = PUBLIC_CATALOGUE_CATEGORIES.find(value => value.slug === 'preview-synthetic')
  const listing = category?.listings.find(value => value.slug === 'sku-options')
  if (!category || !listing) return []
  return PUBLIC_CATALOGUE_FIXTURE_PRODUCTS
    .filter(product => product.productId && product.priceVnd && product.variantGroup)
    .map(product => buildFixtureProductRecord(product, category, listing) as PreviewVariantMember)
}

export function getPreviewVariantSelectionData(group: string, currentProductId: number) {
  return selectSnapshotVariantData<PreviewVariantMember>(
    group,
    currentProductId,
    previewVariantMembers(),
    [{ key: 'seat_type', label: 'Tùy chọn SKU' }],
  )
}

export async function getPreviewVariantSiblings(group: string, currentProductId: number) {
  return getPreviewVariantSelectionData(group, currentProductId).siblings
}

export async function getPreviewCatalogueProduct(
  categorySlug: string,
  listingSlug: string,
  productSlug: string,
) {
  if (usesPublicSnapshot()) return getSnapshotProduct(categorySlug, listingSlug, productSlug)
  assertFixtureRuntime()
  const route = resolveFixturePublicCatalogueRoute([categorySlug, listingSlug, productSlug])
  if (route.kind !== 'product') return null
  const imageUrl = FIXTURE_IMAGES[route.product.image] ?? null
  const product = buildFixtureProductRecord(route.product, route.category, route.listing)
  const priceDisplay = product.price_display
  return {
    ...product,
    is_featured: product.id === 1,
    is_promotion: false,
    image_main_url: imageUrl,
    seo_indexing: 'noindex',
    imageUrl,
    categoryName: route.category.name,
    listingName: route.listing.name,
    categoryPath: getPublicCataloguePath(route.category.slug),
    listingPath: getPublicCataloguePath(route.category.slug, route.listing.slug),
    productPath: getPublicCataloguePath(route.category.slug, route.listing.slug, route.product.slug),
    priceDisplay,
  }
}

export async function resolvePublicCatalogueRoute(segments: readonly string[]) {
  return usesPublicSnapshot() ? resolveSnapshotRoute(segments) : resolveFixturePublicCatalogueRoute(segments)
}
