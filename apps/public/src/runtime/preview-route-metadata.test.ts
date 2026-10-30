import { describe, expect, it } from 'vitest'

import { buildPreviewRouteMetadata, buildSnapshotRouteMetadata } from './preview-route-metadata'

describe('Preview route metadata', () => {
  it('sets a canonical root path and keeps Preview pages noindex', () => {
    expect(buildPreviewRouteMetadata('Thiết Bị Bếp', ['thiet-bi-bep'])).toMatchObject({
      title: 'Thiết Bị Bếp',
      alternates: { canonical: '/thiet-bi-bep' },
      robots: { index: false, follow: false },
    })
  })

  it('uses canonical Listing and PDP route data, without query state', () => {
    const listing = buildSnapshotRouteMetadata({
      kind: 'listing',
      category: { slug: 'gach-op-lat' },
      listing: { name: 'Gạch Inax', slug: 'gach-inax-ecocarat' },
    })
    const product = buildSnapshotRouteMetadata({
      kind: 'product',
      product: {
        name: 'Gạch Mosaic',
        url: '/gach-op-lat/gach-inax-ecocarat/gach-noi-that-ecocarat-plus-mosaic',
      },
    })

    expect(listing.alternates?.canonical).toBe('/gach-op-lat/gach-inax-ecocarat')
    expect(product.alternates?.canonical).toBe('/gach-op-lat/gach-inax-ecocarat/gach-noi-that-ecocarat-plus-mosaic')
    expect(listing.robots).toEqual({ index: false, follow: false })
    expect(product.robots).toEqual({ index: false, follow: false })
  })
})
