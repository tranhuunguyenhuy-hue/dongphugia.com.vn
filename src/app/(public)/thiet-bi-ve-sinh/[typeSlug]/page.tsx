import { redirect } from "next/navigation"

interface PageProps {
    params: Promise<{ typeSlug: string }>
    searchParams: Promise<{ [key: string]: string | undefined }>
}

/**
 * Route /thiet-bi-ve-sinh/[typeSlug] is unified into /thiet-bi-ve-sinh?type=[slug].
 * Redirect permanently to preserve any incoming links.
 */
export default async function TypeRedirectPage({ params, searchParams }: PageProps) {
    const { typeSlug } = await params
    const sp = await searchParams

    // Build the new query string
    const params2 = new URLSearchParams({ type: typeSlug })
    if (sp.collection) params2.set("collection", sp.collection)
    if (sp.color) params2.set("color", sp.color)
    if (sp.surface) params2.set("surface", sp.surface)
    if (sp.size) params2.set("size", sp.size)
    if (sp.origin) params2.set("origin", sp.origin)
    if (sp.location) params2.set("location", sp.location)

    redirect(`/thiet-bi-ve-sinh?${params2.toString()}`)
}
