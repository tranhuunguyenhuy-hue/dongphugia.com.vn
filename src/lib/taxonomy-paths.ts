import type { Prisma } from '@prisma/client'

type CatalogTaxonRef = {
  slug: string
  name: string
  canonical_path: string
  parent_id: number | null
  is_active?: boolean
  is_listing_enabled?: boolean
}

type ProductTaxonAssignmentRef = {
  is_primary: boolean
  catalog_taxons: CatalogTaxonRef | null
}

type ProductPathInput = {
  slug: string
  product_type?: string | null
  categories?: { slug: string; name?: string | null } | null
  subcategories?: { slug: string; name?: string | null } | null
  product_taxon_assignments?: readonly ProductTaxonAssignmentRef[]
}

const ROOT_CATEGORY_NAMES: Record<string, string> = {
  'thiet-bi-ve-sinh': 'Thiết bị vệ sinh',
  'thiet-bi-bep': 'Thiết bị bếp',
  'vat-lieu-nuoc': 'Vật liệu nước',
  'gach-op-lat': 'Gạch ốp lát',
}

export type CanonicalProductPath = {
  categorySlug: string
  subcategorySlug: string
  categoryName: string | null
  subcategoryName: string | null
  canonicalTaxonomyPath: string | null
  usedTaxonomyPrimary: boolean
  taxonomyDisposition: 'normalized_primary' | 'legacy_fallback' | 'manual_review'
  taxonomyException: 'multiple_primary_assignments' | 'missing_primary_taxon' | 'inactive_primary_taxon' | 'invalid_canonical_path' | null
  urlPath: string
}

function getPrimaryTaxon(input: ProductPathInput): {
  taxon: CatalogTaxonRef | null
  exception: CanonicalProductPath['taxonomyException']
} {
  const primaryAssignments = input.product_taxon_assignments?.filter((assignment) => assignment.is_primary) ?? []

  if (primaryAssignments.length === 0) return { taxon: null, exception: null }
  if (primaryAssignments.length > 1) {
    return { taxon: null, exception: 'multiple_primary_assignments' }
  }

  const taxon = primaryAssignments[0].catalog_taxons
  if (!taxon) return { taxon: null, exception: 'missing_primary_taxon' }
  if (taxon.is_active === false) return { taxon: null, exception: 'inactive_primary_taxon' }

  const segments = taxon.canonical_path.split('/').filter(Boolean)
  if (segments.length < 2) return { taxon: null, exception: 'invalid_canonical_path' }

  return { taxon, exception: null }
}

function getLegacySubcategorySlug(input: ProductPathInput) {
  if (input.subcategories?.slug) return input.subcategories.slug
  if (input.product_type) return input.product_type
  if (input.categories?.slug === 'gach-op-lat') return 'gach-op-lat'
  return 'all'
}

export function getCanonicalProductPath(input: ProductPathInput): CanonicalProductPath {
  const primary = getPrimaryTaxon(input)
  const primaryTaxon = primary.taxon

  if (primaryTaxon?.canonical_path) {
    const segments = primaryTaxon.canonical_path.split('/').filter(Boolean)
    const categorySlug = segments[0] ?? input.categories?.slug ?? 'san-pham'
    const subcategorySlug = segments[1] ?? segments[0] ?? getLegacySubcategorySlug(input)

    return {
      categorySlug,
      subcategorySlug,
      categoryName: ROOT_CATEGORY_NAMES[categorySlug] ?? input.categories?.name ?? null,
      subcategoryName: primaryTaxon.name ?? input.subcategories?.name ?? null,
      canonicalTaxonomyPath: primaryTaxon.canonical_path,
      usedTaxonomyPrimary: true,
      taxonomyDisposition: 'normalized_primary',
      taxonomyException: null,
      urlPath: `/${categorySlug}/${subcategorySlug}/${input.slug}`,
    }
  }

  const categorySlug = input.categories?.slug ?? 'san-pham'
  const subcategorySlug = getLegacySubcategorySlug(input)

  return {
    categorySlug,
    subcategorySlug,
    categoryName: input.categories?.name ?? ROOT_CATEGORY_NAMES[categorySlug] ?? null,
    subcategoryName: input.subcategories?.name ?? null,
    canonicalTaxonomyPath: null,
    usedTaxonomyPrimary: false,
    taxonomyDisposition: primary.exception ? 'manual_review' : 'legacy_fallback',
    taxonomyException: primary.exception,
    urlPath: `/${categorySlug}/${subcategorySlug}/${input.slug}`,
  }
}

export function getCategoryRootFilter(categorySlug: string) {
  return {
    product_taxon_assignments: {
      some: {
        is_primary: true,
        catalog_taxons: {
          is_active: true,
          canonical_path: {
            startsWith: `${categorySlug}/`,
          },
        },
      },
    },
  }
}

export function getTaxonomyLeafFilter(slugs: string[]) {
  return {
    product_taxon_assignments: {
      some: {
        is_primary: true,
        catalog_taxons: {
          is_active: true,
          is_listing_enabled: true,
          slug: { in: slugs },
        },
      },
    },
  }
}

export function getTaxonomyPreferredCategoryFilter(categorySlug: string): Prisma.productsWhereInput {
  return {
    OR: [
      getCategoryRootFilter(categorySlug),
      {
        AND: [
          {
            product_taxon_assignments: {
              none: {
                is_primary: true,
                catalog_taxons: { is_active: true },
              },
            },
          },
          { categories: { slug: categorySlug } },
        ],
      },
    ],
  }
}

export function getTaxonomyPreferredLeafFilter(
  slugs: string[],
  legacyFilter: Prisma.productsWhereInput,
): Prisma.productsWhereInput {
  return {
    OR: [
      getTaxonomyLeafFilter(slugs),
      {
        AND: [
          {
            product_taxon_assignments: {
              none: {
                is_primary: true,
                catalog_taxons: { is_active: true, is_listing_enabled: true },
              },
            },
          },
          legacyFilter,
        ],
      },
    ],
  }
}

export const primaryTaxonAssignmentSelect = {
  where: { is_primary: true },
  select: {
    is_primary: true,
    catalog_taxons: {
      select: {
        slug: true,
        name: true,
        canonical_path: true,
        parent_id: true,
        is_active: true,
        is_listing_enabled: true,
      },
    },
  },
} as const
