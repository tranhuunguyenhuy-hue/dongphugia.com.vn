import { describe, expect, it } from 'vitest'

import {
  PUBLIC_APPLICATION_NAME,
  PUBLIC_CATALOGUE_CATEGORIES,
  PUBLIC_ROUTE_OWNERSHIP,
  getPublicCataloguePath,
  resolvePublicCatalogueRoute,
} from './routes'

describe('Public route ownership baseline', () => {
  it('owns the foundation and public catalogue route patterns', () => {
    expect(PUBLIC_APPLICATION_NAME).toBe('public')
    expect(PUBLIC_ROUTE_OWNERSHIP.map(({ path }) => path)).toEqual([
      '/', '/lien-he', '/ve-chung-toi', '/[categorySlug]',
      '/[categorySlug]/[subcategorySlug]',
      '/[categorySlug]/[subcategorySlug]/[productSlug]',
      '/robots.txt', '/sitemap.xml', '/api/health',
    ])
    expect(PUBLIC_ROUTE_OWNERSHIP.every(({ owner }) => owner === 'public')).toBe(true)
  })
})

describe('Public catalogue route contract', () => {
  it('resolves only canonical categories and known listing names', () => {
    expect(resolvePublicCatalogueRoute([])).toEqual({ kind: 'home' })
    for (const category of PUBLIC_CATALOGUE_CATEGORIES) {
      expect(resolvePublicCatalogueRoute([category.slug])).toMatchObject({ kind: 'category' })
      for (const listing of category.listings) {
        expect(resolvePublicCatalogueRoute([category.slug, listing.slug])).toMatchObject({ kind: 'listing' })
        expect(getPublicCataloguePath(category.slug, listing.slug)).toBe(`/${category.slug}/${listing.slug}`)
      }
    }
  })

  it('never resolves an invented product or malformed route', () => {
    expect(resolvePublicCatalogueRoute(['thiet-bi-ve-sinh', 'ban-cau', 'ban-cau-mot-khoi-cao-cap'])).toEqual({ kind: 'not-found' })
    expect(resolvePublicCatalogueRoute(['not-a-category'])).toEqual({ kind: 'not-found' })
    expect(resolvePublicCatalogueRoute(['thiet-bi-ve-sinh', 'not-a-listing'])).toEqual({ kind: 'not-found' })
    expect(resolvePublicCatalogueRoute(['thiet-bi-ve-sinh', 'ban-cau', 'UPPERCASE'])).toEqual({ kind: 'not-found' })
  })

  it('keeps known legacy listing aliases without inventing PDP destinations', () => {
    expect(resolvePublicCatalogueRoute(['gach-op-lat', 'gach-marble'])).toEqual({ kind: 'redirect', destination: '/gach-op-lat/gach-van-da-marble' })
    expect(resolvePublicCatalogueRoute(['thiet-bi-ve-sinh', 'bon-cau'])).toEqual({ kind: 'redirect', destination: '/thiet-bi-ve-sinh/ban-cau' })
    expect(resolvePublicCatalogueRoute(['thiet-bi-ve-sinh', 'bon-cau', 'ban-cau-mot-khoi-cao-cap'])).toEqual({ kind: 'not-found' })
  })
})
