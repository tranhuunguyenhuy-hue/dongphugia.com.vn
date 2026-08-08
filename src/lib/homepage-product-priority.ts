import type { Prisma } from '@prisma/client'
import { buildPublicListingVisibilityWhere } from '@/lib/public-product-visibility'
import { getCategoryRootFilter } from '@/lib/taxonomy-paths'

export const HOMEPAGE_PRIORITY_SANITARY_SUBCATEGORY_SLUGS = [
    'bon-cau',
    'lavabo',
    'bon-tam',
    'sen-tam',
] as const

// Homepage merchandising intentionally omits component-level products. These
// markers are evaluated only against catalog fields, never display names.
export const HOMEPAGE_ACCESSORY_SLUG_MARKERS = [
    'phu-kien',
    'linh-kien',
    'bo-xa',
    'tay-sen',
    'dau-sen',
    'day-sen',
    'bat-sen',
    'gia-do',
    'ke-goc',
    'moc-treo',
    'van-xa',
    'van-chia',
    'van-khoa',
    'ong-xa',
    'xi-phong',
    'siphon',
    'nap-bon-cau',
] as const

type HomepageTaxon = {
    slug: string
    canonical_path: string
} | null

export type HomepageProductCandidate = {
    id: number
    is_featured: boolean
    sort_order: number
    created_at: Date | string
    variant_group?: string | null
    product_type?: string | null
    product_sub_type?: string | null
    subcategories?: { slug: string } | null
    secondary_subcategories?: Array<{ subcategories: { slug: string } }>
    product_types?: { slug: string } | null
    product_sub_types?: { slug: string } | null
    product_taxon_assignments?: Array<{ catalog_taxons: HomepageTaxon }>
}

function hasSlugMarker(value: string | null | undefined) {
    const normalized = value?.trim().toLowerCase() ?? ''
    return HOMEPAGE_ACCESSORY_SLUG_MARKERS.some((marker) =>
        normalized === marker
        || normalized.startsWith(`${marker}-`)
        || normalized.endsWith(`-${marker}`)
        || normalized.includes(`-${marker}-`)
    )
}

function hasTaxonomyPathMarker(value: string | null | undefined) {
    const normalized = value?.trim().toLowerCase() ?? ''
    return HOMEPAGE_ACCESSORY_SLUG_MARKERS.some((marker) =>
        normalized === marker
        || normalized.startsWith(`${marker}/`)
        || normalized.endsWith(`/${marker}`)
        || normalized.includes(`/${marker}/`)
    )
}

function getCandidateCatalogValues(product: HomepageProductCandidate) {
    return [
        product.product_type,
        product.product_sub_type,
        product.subcategories?.slug,
        ...((product.secondary_subcategories ?? []).map((entry) => entry.subcategories.slug)),
        product.product_types?.slug,
        product.product_sub_types?.slug,
        ...((product.product_taxon_assignments ?? []).flatMap((assignment) => [
            assignment.catalog_taxons?.slug,
            assignment.catalog_taxons?.canonical_path,
        ])),
    ]
}

export function isHomepageAccessoryCandidate(product: HomepageProductCandidate) {
    return getCandidateCatalogValues(product).some((value) =>
        value?.includes('/') ? hasTaxonomyPathMarker(value) : hasSlugMarker(value)
    )
}

export function isPrioritySanitaryCandidate(product: HomepageProductCandidate) {
    const prioritySlugs = new Set<string>(HOMEPAGE_PRIORITY_SANITARY_SUBCATEGORY_SLUGS)
    return [
        product.subcategories?.slug,
        ...((product.secondary_subcategories ?? []).map((entry) => entry.subcategories.slug)),
        ...((product.product_taxon_assignments ?? []).map((assignment) => assignment.catalog_taxons?.slug)),
    ].some((slug) => Boolean(slug && prioritySlugs.has(slug)))
}

function compareProducts<T extends HomepageProductCandidate>(left: T, right: T) {
    return Number(right.is_featured) - Number(left.is_featured)
        || right.sort_order - left.sort_order
        || new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
        || left.id - right.id
}

function groupKey(product: HomepageProductCandidate) {
    const value = product.variant_group?.trim()
    return value ? value.toLowerCase() : null
}

function rankCohort<T extends HomepageProductCandidate>(
    cohort: T[],
    allEligibleProducts: T[],
    excludedVariantGroups = new Set<string>(),
) {
    const allGroups = new Map<string, T[]>()
    for (const product of allEligibleProducts) {
        const key = groupKey(product)
        if (!key) continue
        const members = allGroups.get(key) ?? []
        members.push(product)
        allGroups.set(key, members)
    }

    const cohortGroups = new Map<string, T[]>()
    const ungrouped: T[] = []
    for (const product of cohort) {
        const key = groupKey(product)
        if (!key) {
            ungrouped.push(product)
            continue
        }
        if (excludedVariantGroups.has(key)) continue
        const members = cohortGroups.get(key) ?? []
        members.push(product)
        cohortGroups.set(key, members)
    }

    const groupedRepresentatives = [...cohortGroups.entries()]
        .map(([key, members]) => ({
            key,
            representative: [...members].sort(compareProducts)[0],
            activePublicVariantCount: allGroups.get(key)?.length ?? members.length,
        }))
        .sort((left, right) =>
            right.activePublicVariantCount - left.activePublicVariantCount
            || compareProducts(left.representative, right.representative)
            || left.key.localeCompare(right.key),
        )

    return {
        products: [
            ...groupedRepresentatives.map((entry) => entry.representative),
            ...ungrouped.sort(compareProducts),
        ],
        variantGroups: new Set(groupedRepresentatives.map((entry) => entry.key)),
    }
}

/**
 * Produces one card per variant family. Priority sanitary leaves are exhausted
 * before the public, non-accessory category fallback is considered.
 */
export function rankHomepageSanitaryProducts<T extends HomepageProductCandidate>(
    products: T[],
    take = 12,
) {
    const eligible = products.filter((product) => !isHomepageAccessoryCandidate(product))
    const priority = eligible.filter(isPrioritySanitaryCandidate)
    const firstPass = rankCohort(priority, eligible)

    if (firstPass.products.length >= take) return firstPass.products.slice(0, take)

    const priorityIds = new Set(firstPass.products.map((product) => product.id))
    const fallback = eligible.filter((product) => !priorityIds.has(product.id))
    const secondPass = rankCohort(fallback, eligible, firstPass.variantGroups)

    return [...firstPass.products, ...secondPass.products].slice(0, take)
}

export function buildHomepageNonAccessoryWhere(): Prisma.productsWhereInput {
    const accessoryMatches: Prisma.productsWhereInput[] = HOMEPAGE_ACCESSORY_SLUG_MARKERS.flatMap((marker) => {
        // Product fields store catalog slugs. Match slug/path boundaries so a
        // marker never suppresses a legitimate product merely by substring.
        const slug: Prisma.StringFilter[] = [
            { equals: marker, mode: 'insensitive' },
            { startsWith: `${marker}-`, mode: 'insensitive' },
            { endsWith: `-${marker}`, mode: 'insensitive' },
            { contains: `-${marker}-`, mode: 'insensitive' },
        ]
        const taxonomyPath: Prisma.StringFilter<'catalog_taxons'>[] = [
            { equals: marker, mode: 'insensitive' },
            { startsWith: `${marker}/`, mode: 'insensitive' },
            { endsWith: `/${marker}`, mode: 'insensitive' },
            { contains: `/${marker}/`, mode: 'insensitive' },
        ]
        return [
            // Nullable legacy text fields must be guarded explicitly. Without
            // this, SQL's NOT (NULL LIKE ...) evaluates to NULL and wrongly
            // drops otherwise public products that have no legacy text value.
            {
                AND: [
                    { product_type: { not: null } },
                    { OR: slug.map((filter) => ({ product_type: filter })) },
                ],
            },
            {
                AND: [
                    { product_sub_type: { not: null } },
                    { OR: slug.map((filter) => ({ product_sub_type: filter })) },
                ],
            },
            { OR: slug.map((filter) => ({ subcategories: { slug: filter } })) },
            { OR: slug.map((filter) => ({ product_types: { slug: filter } })) },
            { OR: slug.map((filter) => ({ product_sub_types: { slug: filter } })) },
            { OR: slug.map((filter) => ({ secondary_subcategories: { some: { subcategories: { slug: filter } } } })) },
            {
                OR: [
                    ...slug.map((filter) => ({
                        product_taxon_assignments: { some: { catalog_taxons: { slug: filter } } },
                    })),
                    ...taxonomyPath.map((filter) => ({
                        product_taxon_assignments: { some: { catalog_taxons: { canonical_path: filter } } },
                    })),
                ],
            },
        ]
    })

    return {
        NOT: {
            OR: accessoryMatches,
        },
    }
}

/**
 * Shared public, category, and non-accessory contract for both homepage
 * selection phases. It intentionally keeps this policy in the database query
 * rather than relying on display-name heuristics after fetching card payloads.
 */
export function buildHomepageSanitaryWhere(): Prisma.productsWhereInput {
    return {
        is_active: true,
        AND: [
            buildPublicListingVisibilityWhere(),
            buildHomepageNonAccessoryWhere(),
        ],
        OR: [
            { categories: { slug: 'thiet-bi-ve-sinh' } },
            getCategoryRootFilter('thiet-bi-ve-sinh'),
        ],
    }
}
