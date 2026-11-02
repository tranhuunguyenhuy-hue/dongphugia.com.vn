import type { Metadata } from 'next'

type SnapshotMetadataRoute =
  | { kind: 'product'; product: { name: string; url: string } }
  | {
      kind: 'listing'
      category: { slug: string }
      listing: { name: string; slug: string }
    }

/** Build noindex Preview metadata with a canonical path independent of filters. */
export function buildPreviewRouteMetadata(
  title: string,
  canonicalSegments: readonly string[],
): Metadata {
  const canonical = `/${canonicalSegments.map((segment) => encodeURIComponent(segment)).join('/')}`

  return {
    title,
    alternates: { canonical },
    robots: { index: false, follow: false },
  }
}

export function buildSnapshotRouteMetadata(route: SnapshotMetadataRoute): Metadata {
  if (route.kind === 'product') {
    return buildPreviewRouteMetadata(
      route.product.name,
      route.product.url.split('/').filter(Boolean),
    )
  }

  return buildPreviewRouteMetadata(route.listing.name, [route.category.slug, route.listing.slug])
}
