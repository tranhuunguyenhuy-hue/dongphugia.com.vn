import { describe, expect, it } from 'vitest'

import {
  PUBLIC_APPLICATION_NAME,
  PUBLIC_CATALOGUE_CATEGORIES,
  PUBLIC_CATALOGUE_FIXTURE_PRODUCTS,
  PUBLIC_ROUTE_OWNERSHIP,
  getPublicCataloguePath,
  resolvePublicCatalogueRoute,
} from './routes'

describe('Public route ownership baseline', () => {
  it('owns the foundation and public catalogue route patterns', () => {
    expect(PUBLIC_APPLICATION_NAME).toBe('public')
    expect(PUBLIC_ROUTE_OWNERSHIP.map(({ path }) => path)).toEqual([
      '/',
      '/[categorySlug]',
      '/[categorySlug]/[subcategorySlug]',
      '/[categorySlug]/[subcategorySlug]/[productSlug]',
      '/robots.txt',
      '/api/health',
    ])
    expect(PUBLIC_ROUTE_OWNERSHIP.every(({ owner }) => owner === 'public')).toBe(true)
  })
})

describe('Public catalogue route contract', () => {
  it('resolves the home, each canonical category, and known category listings', () => {
    expect(resolvePublicCatalogueRoute([])).toEqual({ kind: 'home' })
    expect(resolvePublicCatalogueRoute(['thiet-bi-ve-sinh'])).toMatchObject({
      kind: 'category',
      category: { slug: 'thiet-bi-ve-sinh' },
    })
    expect(resolvePublicCatalogueRoute(['thiet-bi-bep', 'chau-rua-chen'])).toMatchObject({
      kind: 'listing',
      category: { slug: 'thiet-bi-bep' },
      listing: { slug: 'chau-rua-chen' },
    })
    expect(resolvePublicCatalogueRoute(['vat-lieu-nuoc', 'may-bom-nuoc'])).toMatchObject({
      kind: 'listing',
      category: { slug: 'vat-lieu-nuoc' },
      listing: { slug: 'may-bom-nuoc' },
    })
    expect(resolvePublicCatalogueRoute(['gach-op-lat', 'gach-van-da-marble'])).toMatchObject({
      kind: 'listing',
      category: { slug: 'gach-op-lat' },
      listing: { slug: 'gach-van-da-marble' },
    })
  })

  it('resolves only the explicitly labeled local fixture product slugs', () => {
    expect(
      resolvePublicCatalogueRoute([
        'thiet-bi-ve-sinh',
        'bon-cau',
        'ban-cau-mot-khoi-cao-cap',
      ]),
    ).toMatchObject({ kind: 'product', product: { fixtureOnly: true } })
  })

  it('keeps the homepage category links, canonical listings, and fixture PDP links connected', () => {
    for (const category of PUBLIC_CATALOGUE_CATEGORIES) {
      expect(resolvePublicCatalogueRoute([category.slug])).toMatchObject({ kind: 'category' })
      for (const listing of category.listings) {
        expect(resolvePublicCatalogueRoute([category.slug, listing.slug])).toMatchObject({
          kind: 'listing',
        })
        for (const product of PUBLIC_CATALOGUE_FIXTURE_PRODUCTS) {
          expect(
            resolvePublicCatalogueRoute([category.slug, listing.slug, product.slug]),
          ).toMatchObject({ kind: 'product', product: { slug: product.slug, fixtureOnly: true } })
          expect(getPublicCataloguePath(category.slug, listing.slug, product.slug)).toBe(
            `/${category.slug}/${listing.slug}/${product.slug}`,
          )
        }
      }
    }
  })

  it('rejects unknown categories, listings, products, and malformed slugs', () => {
    expect(resolvePublicCatalogueRoute(['not-a-category'])).toEqual({ kind: 'not-found' })
    expect(resolvePublicCatalogueRoute(['thiet-bi-ve-sinh', 'not-a-listing'])).toEqual({
      kind: 'not-found',
    })
    expect(
      resolvePublicCatalogueRoute(['thiet-bi-ve-sinh', 'bon-cau', 'not-a-product']),
    ).toEqual({ kind: 'not-found' })
    expect(
      resolvePublicCatalogueRoute(['thiet-bi-ve-sinh', 'bon-cau', 'UPPERCASE']),
    ).toEqual({ kind: 'not-found' })
  })

  it('redirects supported legacy fixture URLs to their canonical route shape', () => {
    expect(resolvePublicCatalogueRoute(['gach-op-lat', 'gach-marble'])).toEqual({
      kind: 'redirect',
      destination: '/gach-op-lat/gach-van-da-marble',
    })
    expect(
      resolvePublicCatalogueRoute(['thiet-bi-ve-sinh', 'ban-cau-mot-khoi-cao-cap']),
    ).toEqual({
      kind: 'redirect',
      destination: '/thiet-bi-ve-sinh/bon-cau/ban-cau-mot-khoi-cao-cap',
    })
    expect(
      resolvePublicCatalogueRoute([
        'gach-op-lat',
        'gach-marble',
        'ban-cau-mot-khoi-cao-cap',
      ]),
    ).toEqual({
      kind: 'redirect',
      destination:
        '/gach-op-lat/gach-van-da-marble/ban-cau-mot-khoi-cao-cap',
    })
  })
})
