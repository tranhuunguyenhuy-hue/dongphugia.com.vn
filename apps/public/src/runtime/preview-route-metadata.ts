import type { Metadata } from 'next'

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
