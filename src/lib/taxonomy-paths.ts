type CatalogTaxonRef = {
  slug: string
  name: string
  canonical_path: string
  parent_id: number | null
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
  product_taxon_assignments?: ProductTaxonAssignmentRef[]
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
  urlPath: string
}

function getPrimaryTaxon(input: ProductPathInput) {
  return (
    input.product_taxon_assignments?.find(
      (assignment) => assignment.is_primary && assignment.catalog_taxons
    )?.catalog_taxons ?? null
  )
}

function getLegacySubcategorySlug(input: ProductPathInput) {
  if (input.subcategories?.slug) return input.subcategories.slug
  if (input.product_type) return input.product_type
  if (input.categories?.slug === 'gach-op-lat') return 'gach-op-lat'
  return 'all'
}

export function getCanonicalProductPath(input: ProductPathInput): CanonicalProductPath {
  const primaryTaxon = getPrimaryTaxon(input)

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
    urlPath: `/${categorySlug}/${subcategorySlug}/${input.slug}`,
  }
}

export function getCategoryRootFilter(categorySlug: string) {
  return {
    product_taxon_assignments: {
      some: {
        is_primary: true,
        catalog_taxons: {
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
          slug: { in: slugs },
        },
      },
    },
  }
}

export const primaryTaxonAssignmentSelect = {
  where: { is_primary: true },
  take: 1,
  select: {
    is_primary: true,
    catalog_taxons: {
      select: {
        slug: true,
        name: true,
        canonical_path: true,
        parent_id: true,
      },
    },
  },
} as const
