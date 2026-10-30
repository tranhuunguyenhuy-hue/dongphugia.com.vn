import { describe, expect, it } from 'vitest'

import { buildPreviewRouteMetadata } from './preview-route-metadata'

describe('Preview route metadata', () => {
  it('sets a canonical root path and keeps Preview pages noindex', () => {
    expect(buildPreviewRouteMetadata('Thiết Bị Bếp', ['thiet-bi-bep'])).toMatchObject({
      title: 'Thiết Bị Bếp',
      alternates: { canonical: '/thiet-bi-bep' },
      robots: { index: false, follow: false },
    })
  })

  it('uses route segments for Listing and PDP canonicals, without query state', () => {
    const listing = buildPreviewRouteMetadata('Gạch Inax', ['gach-op-lat', 'gach-inax-ecocarat'])
    const product = buildPreviewRouteMetadata('Gạch Mosaic', [
      'gach-op-lat',
      'gach-inax-ecocarat',
      'gach-noi-that-ecocarat-plus-luxury-mosaic-inax-ecp-25netlux-15071',
    ])

    expect(listing.alternates?.canonical).toBe('/gach-op-lat/gach-inax-ecocarat')
    expect(product.alternates?.canonical).toBe(
      '/gach-op-lat/gach-inax-ecocarat/gach-noi-that-ecocarat-plus-luxury-mosaic-inax-ecp-25netlux-15071',
    )
    expect(listing.robots).toEqual({ index: false, follow: false })
    expect(product.robots).toEqual({ index: false, follow: false })
  })
})
