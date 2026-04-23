'use server'

import { getFeaturedProductsByCategorySlug } from "@/lib/public-api-products"

export async function fetchFeaturedProductsAction(
    categorySlug: string, 
    brandSlug?: string | null, 
    subcategorySlug?: string | null, 
    skip = 0, 
    take = 20
) {
    // This is simply a wrapper around the cached data fetching function to expose it to client components.
    // The underlying getFeaturedProductsByCategorySlug handles the Prisma query safely.
    return await getFeaturedProductsByCategorySlug(categorySlug, brandSlug, subcategorySlug, skip, take)
}
