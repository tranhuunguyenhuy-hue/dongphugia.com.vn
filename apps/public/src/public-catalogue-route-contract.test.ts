import { describe, expect, it } from 'vitest'

import {
  PUBLIC_CATALOGUE_HTTP_STATUS,
  PUBLIC_CATALOGUE_ROBOTS,
  PUBLIC_CATALOGUE_ROUTE_PATTERNS,
  PUBLIC_CATALOGUE_SITEMAP_POLICY,
  PUBLIC_PREVIEW_NOINDEX,
  PUBLIC_ROUTE_OWNERSHIP,
  type PublicCatalogueReadResult,
} from '@dpg/app-contracts'

describe('Public catalogue route contract', () => {
  it('matches the canonical category, listing, and Product route shapes', () => {
    const ownedPaths = PUBLIC_ROUTE_OWNERSHIP.map(({ path }) => path)

    expect(ownedPaths).toContain(PUBLIC_CATALOGUE_ROUTE_PATTERNS.category)
    expect(ownedPaths).toContain(PUBLIC_CATALOGUE_ROUTE_PATTERNS.listing)
    expect(ownedPaths).toContain(PUBLIC_CATALOGUE_ROUTE_PATTERNS.product)
    expect(PUBLIC_ROUTE_OWNERSHIP.every(({ owner }) => owner === 'public')).toBe(true)
  })

  it('returns 301 only with a canonical destination for a supported legacy URL', () => {
    const redirect = {
      kind: 'redirect',
      status: PUBLIC_CATALOGUE_HTTP_STATUS.permanentRedirect,
      location: '/thiet-bi-ve-sinh/ban-cau/ban-cau-mot-khoi',
    } satisfies PublicCatalogueReadResult

    expect(redirect).toEqual({
      kind: 'redirect',
      status: 301,
      location: '/thiet-bi-ve-sinh/ban-cau/ban-cau-mot-khoi',
    })
    expect(PUBLIC_CATALOGUE_HTTP_STATUS.notFound).toBe(404)
    expect(PUBLIC_CATALOGUE_HTTP_STATUS.unavailable).toBe(503)
  })

  it('keeps search and Preview noindexed and sitemap input canonical-only', () => {
    expect(PUBLIC_CATALOGUE_ROUTE_PATTERNS.search).toBe('/tim-kiem')
    expect(PUBLIC_CATALOGUE_ROUTE_PATTERNS.sitemap).toBe('/sitemap.xml')
    expect(PUBLIC_CATALOGUE_ROBOTS.search).toBe('noindex,follow')
    expect(PUBLIC_CATALOGUE_ROBOTS.preview).toBe(PUBLIC_PREVIEW_NOINDEX.htmlMeta)
    expect(PUBLIC_CATALOGUE_SITEMAP_POLICY).toEqual({
      includesCanonicalPathsOnly: true,
      excludesSearch: true,
      requiresSitemapVisibility: true,
    })
  })

  it('keeps not-found separate from read failure at the route seam', () => {
    const missing: PublicCatalogueReadResult = { kind: 'not_found' }
    const unavailable: PublicCatalogueReadResult = { kind: 'unavailable' }

    expect(missing.kind).not.toBe(unavailable.kind)
    expect(PUBLIC_CATALOGUE_HTTP_STATUS.notFound).not.toBe(
      PUBLIC_CATALOGUE_HTTP_STATUS.unavailable,
    )
  })
})
