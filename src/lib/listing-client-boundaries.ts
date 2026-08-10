type ListingSearchParams = Record<string, string | undefined>

const FILTER_PARAM_KEYS = new Set([
    'brand',
    'features',
    'material',
    'origin',
    'color',
    'type',
    'subtype',
    'price',
    'priceRange',
    'is_new',
    'is_promotion',
    'is_featured',
])

export function hasActiveListingFilterParams(searchParams: ListingSearchParams): boolean {
    return Object.entries(searchParams).some(([key, value]) =>
        Boolean(value) && (FILTER_PARAM_KEYS.has(key) || key.startsWith('sf_')),
    )
}
