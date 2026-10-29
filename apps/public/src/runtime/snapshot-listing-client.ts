import {
    filterPublicSnapshotListing,
    isPublicSnapshotListingShard,
    PUBLIC_SNAPSHOT_LISTING_MAX_PAGES,
    PUBLIC_SNAPSHOT_LISTING_PAGE_SIZE,
    type PublicSnapshotListingFilters,
    type PublicSnapshotListingProduct,
    type PublicSnapshotListingShard,
} from './snapshot-listing-contract'

const MAX_PARALLEL_SHARD_REQUESTS = 4

export type LoadedPublicSnapshotListing = {
    checkpoint: string
    totalCount: number
    products: PublicSnapshotListingProduct[]
}

function shardUrl(categorySlug: string, listingSlug: string, page: number) {
    return `/api/catalogue/listings/${encodeURIComponent(categorySlug)}/${encodeURIComponent(listingSlug)}?page=${page}`
}

async function fetchShard(
    fetcher: typeof fetch,
    categorySlug: string,
    listingSlug: string,
    page: number,
    signal?: AbortSignal,
    checkpoint?: string,
): Promise<PublicSnapshotListingShard> {
    const response = await fetcher(shardUrl(categorySlug, listingSlug, page), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        credentials: 'same-origin',
        signal,
    })
    if (!response.ok) throw new Error('PUBLIC_LISTING_SHARD_UNAVAILABLE')

    let value: unknown
    try {
        value = await response.json()
    } catch {
        throw new Error('PUBLIC_LISTING_SHARD_INVALID')
    }
    if (!isPublicSnapshotListingShard(value, { categorySlug, listingSlug, page, checkpoint })) {
        throw new Error('PUBLIC_LISTING_SHARD_INVALID')
    }
    return value
}

export async function loadPublicSnapshotListing(
    categorySlug: string,
    listingSlug: string,
    options: { fetcher?: typeof fetch; signal?: AbortSignal } = {},
): Promise<LoadedPublicSnapshotListing> {
    const fetcher = options.fetcher ?? fetch
    const first = await fetchShard(fetcher, categorySlug, listingSlug, 1, options.signal)
    if (first.totalPages > PUBLIC_SNAPSHOT_LISTING_MAX_PAGES) {
        throw new Error('PUBLIC_LISTING_SHARD_INVALID')
    }

    const shards: Array<PublicSnapshotListingShard | undefined> = new Array(first.totalPages)
    shards[0] = first
    let nextPage = 2
    let failure: unknown

    const loadNext = async () => {
        while (!failure && !options.signal?.aborted) {
            const page = nextPage++
            if (page > first.totalPages) return
            try {
                shards[page - 1] = await fetchShard(
                    fetcher,
                    categorySlug,
                    listingSlug,
                    page,
                    options.signal,
                    first.checkpoint,
                )
            } catch (error) {
                failure = error
            }
        }
    }

    const workerCount = Math.min(MAX_PARALLEL_SHARD_REQUESTS, first.totalPages - 1)
    await Promise.all(Array.from({ length: workerCount }, () => loadNext()))
    if (options.signal?.aborted) throw new Error('PUBLIC_LISTING_LOAD_ABORTED')
    if (failure) throw failure

    if (shards.some((shard) => shard === undefined)) throw new Error('PUBLIC_LISTING_SHARD_INVALID')
    const completeShards = shards as PublicSnapshotListingShard[]
    const products = completeShards.flatMap((shard) => shard.products)
    if (completeShards.length !== first.totalPages
        || completeShards.some((shard, index) => shard.page !== index + 1
            || shard.totalCount !== first.totalCount
            || shard.totalPages !== first.totalPages
            || shard.pageSize !== PUBLIC_SNAPSHOT_LISTING_PAGE_SIZE)
        || products.length !== first.totalCount
        || new Set(products.map((product) => product.id)).size !== products.length
        || new Set(products.map((product) => product.url)).size !== products.length) {
        throw new Error('PUBLIC_LISTING_SHARD_INVALID')
    }

    return { checkpoint: first.checkpoint, totalCount: first.totalCount, products }
}

export function selectPublicSnapshotListingPage(
    listing: LoadedPublicSnapshotListing,
    filters: PublicSnapshotListingFilters,
    pageSize: 12 | 24,
) {
    return filterPublicSnapshotListing(listing.products, filters, pageSize)
}
