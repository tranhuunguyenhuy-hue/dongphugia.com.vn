import { redirect } from "next/navigation"

interface PageProps {
    params: Promise<{ patternSlug: string }>
    searchParams: Promise<{ [key: string]: string | undefined }>
}

/**
 * Old route /gach-op-lat/[patternSlug] is now unified into /gach-op-lat?pattern=[slug].
 * Redirect permanently to preserve any incoming links.
 */
export default async function PatternTypeRedirectPage({ params, searchParams }: PageProps) {
    const { patternSlug } = await params
    const sp = await searchParams

    // Build the new query string
    const params2 = new URLSearchParams({ pattern: patternSlug })
    if (sp.collection) params2.set("collection", sp.collection)
    if (sp.color) params2.set("color", sp.color)
    if (sp.surface) params2.set("surface", sp.surface)
    if (sp.size) params2.set("size", sp.size)
    if (sp.origin) params2.set("origin", sp.origin)
    if (sp.location) params2.set("location", sp.location)

    redirect(`/gach-op-lat?${params2.toString()}`)
}
