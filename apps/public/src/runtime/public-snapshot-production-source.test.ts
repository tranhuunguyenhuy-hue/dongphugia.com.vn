import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getSnapshotProduct, getSnapshotProducts, getSnapshotSearchProducts, readSnapshotManifest } from './public-snapshot-catalogue'

const checkpoint = 'a'.repeat(40)
const origin = 'https://www.dongphugia.vn'

function makeManifest() {
  return {
    contract: 'dpg:public-catalogue-snapshot:v1',
    checkpoint,
    m3CodeSha: 'b'.repeat(40),
    m3RunId: 'test-run-001',
    notice: 'Synthetic fixture used only by this isolated test.',
    categories: [
      { slug: 'thiet-bi-ve-sinh', listings: [] },
      { slug: 'thiet-bi-bep', listings: [{ slug: 'bep-dien-tu', totalCount: 2 }] },
      { slug: 'vat-lieu-nuoc', listings: [] },
      { slug: 'gach-op-lat', listings: [] },
    ],
    productBuckets: Array.from({ length: 256 }, (_, index) => index.toString(16).padStart(2, '0')),
    searchShards: ['0', '1', '2', '3'],
    products: 2,
    listingProducts: 2,
    searchProducts: 2,
  }
}

function makeListing(checkpointValue = checkpoint) {
  return {
    contract: 'dpg:public-catalogue-snapshot:v1',
    checkpoint: checkpointValue,
    totalCount: 2,
    page: 1,
    products: [
      { id: 1, price: 3699200, sale_price: 3699200, price_provenance: 'legacy-manual-2026-07-02' },
      { id: 2, price: null, sale_price: null, price_provenance: null },
    ],
  }
}

describe('direct Production-published public catalogue reads', () => {
  let manifest: ReturnType<typeof makeManifest>
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.stubEnv('APP_ENV', 'preview')
    vi.stubEnv('APP_ORIGIN', 'http://127.0.0.1:8787')
    vi.stubEnv('PREVIEW_NOINDEX', 'true')
    vi.stubEnv('PUBLIC_CATALOGUE_SOURCE', 'production-published-snapshot')
    vi.stubEnv('PUBLIC_CATALOGUE_CHECKPOINT', '')
    manifest = makeManifest()
    fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      if (url.origin !== origin) return new Response('wrong origin', { status: 500 })
      if (url.pathname === '/__catalogue/v1/manifest.json') return Response.json(manifest)
      if (url.pathname === '/__catalogue/v1/listings/thiet-bi-bep/bep-dien-tu/1.json') {
        return Response.json(makeListing())
      }
      if (url.pathname.startsWith('/__catalogue/v1/products/')) {
        return Response.json({ contract: manifest.contract, checkpoint, products: [{
          id: 1,
          url: '/thiet-bi-bep/bep-dien-tu/sample',
          categories: { name: 'Thiết Bị Bếp', slug: 'thiet-bi-bep' },
          subcategories: { name: 'Bếp điện từ', slug: 'bep-dien-tu' },
          brands: null,
          image_main_url: null,
        }] })
      }
      if (url.pathname === '/__catalogue/v1/search/0.json') {
        return Response.json({ contract: manifest.contract, checkpoint, products: [{ id: 1 }, { id: 2 }] })
      }
      if (/^\/__catalogue\/v1\/search\/[1-3]\.json$/.test(url.pathname)) {
        return Response.json({ contract: manifest.contract, checkpoint, products: [] })
      }
      return new Response('not found', { status: 404, headers: { 'content-type': 'text/plain' } })
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('uses the fixed Production origin and the manifest checkpoint for a declared listing', async () => {
    const result = await getSnapshotProducts('thiet-bi-bep', 'bep-dien-tu', 1)

    expect(result).toMatchObject({ page: 1, totalCount: 2 })
    expect(result.products).toHaveLength(2)
    expect(result.products[0]).toMatchObject({ price: 3699200, sale_price: 3699200, price_provenance: 'legacy-manual-2026-07-02' })
    const paths = fetchMock.mock.calls.map(([input]) => new URL(String(input)).pathname)
    expect(paths).toContain('/__catalogue/v1/manifest.json')
    expect(paths).toContain('/__catalogue/v1/listings/thiet-bi-bep/bep-dien-tu/1.json')
    expect(paths.every((path) => path.startsWith('/__catalogue/v1/'))).toBe(true)
    for (const [input, init] of fetchMock.mock.calls) {
      expect(new URL(String(input)).origin).toBe(origin)
      expect(init).toMatchObject({ method: 'GET', cache: 'no-store', credentials: 'omit', redirect: 'manual' })
      const headers = new Headers(init?.headers)
      expect(headers.get('accept')).toBe('application/json')
      expect(headers.has('authorization')).toBe(false)
      expect(headers.has('cookie')).toBe(false)
      expect(headers.has('referer')).toBe(false)
    }
  })

  it('parses independent response bodies during concurrent listing reads', async () => {
    const [first, second] = await Promise.all([
      getSnapshotProducts('thiet-bi-bep', 'bep-dien-tu', 1),
      getSnapshotProducts('thiet-bi-bep', 'bep-dien-tu', 1),
    ])

    expect(first.products).toHaveLength(2)
    expect(second.products).toHaveLength(2)
    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes('/listings/thiet-bi-bep/bep-dien-tu/1.json')))
      .toHaveLength(2)
  })

  it('fails closed when a catalogue asset checkpoint differs from the manifest', async () => {
    fetchMock.mockImplementation(async (input: string | URL | Request) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      if (url.pathname === '/__catalogue/v1/manifest.json') return Response.json(manifest)
      if (url.pathname === '/__catalogue/v1/listings/thiet-bi-bep/bep-dien-tu/1.json') {
        return Response.json(makeListing('c'.repeat(40)))
      }
      return new Response('not found', { status: 404 })
    })

    await expect(getSnapshotProducts('thiet-bi-bep', 'bep-dien-tu', 1))
      .rejects.toThrow('PUBLIC_CATALOGUE_CHECKPOINT_MISMATCH')
  })

  it('does not request a listing absent from the Production manifest', async () => {
    await readSnapshotManifest()
    const result = await getSnapshotProducts('thiet-bi-bep', 'unpublished-listing', 1)

    expect(result.products).toEqual([])
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/listings/thiet-bi-bep/unpublished-listing/')))
      .toBe(false)
  })

  it('reads product buckets and all declared search shards from the same checkpoint', async () => {
    const product = await getSnapshotProduct('thiet-bi-bep', 'bep-dien-tu', 'sample')
    const searchProducts = await getSnapshotSearchProducts()

    expect(product?.productPath).toBe('/thiet-bi-bep/bep-dien-tu/sample')
    expect(searchProducts).toHaveLength(2)
    const paths = fetchMock.mock.calls.map(([input]) => new URL(String(input)).pathname)
    expect(paths.some((path) => /^\/__catalogue\/v1\/products\/[a-f0-9]{2}\.json$/.test(path))).toBe(true)
    expect(paths).toContain('/__catalogue/v1/search/0.json')
    expect(paths).toContain('/__catalogue/v1/search/1.json')
    expect(paths).toContain('/__catalogue/v1/search/2.json')
    expect(paths).toContain('/__catalogue/v1/search/3.json')
  })

  it('rejects a malformed manifest contract and missing build provenance metadata', async () => {
    manifest = { ...makeManifest(), contract: 'unknown' }
    await expect(readSnapshotManifest()).rejects.toThrow('PUBLIC_CATALOGUE_UNAVAILABLE')

    vi.stubEnv('PUBLIC_CATALOGUE_SOURCE', 'production-published-snapshot')
    manifest = { ...makeManifest(), m3CodeSha: '' }
    await expect(readSnapshotManifest()).rejects.toThrow('PUBLIC_CATALOGUE_UNAVAILABLE')
  })

  it('does not silently fall back when Production returns a redirect or unavailable manifest', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockImplementation(async (input: string | URL | Request) => {
      return new Response(null, { status: 302, headers: { location: 'https://attacker.invalid/data.json' } })
    })
    await expect(readSnapshotManifest()).rejects.toThrow('PUBLIC_CATALOGUE_UNAVAILABLE')

    fetchMock.mockImplementation(async (input: string | URL | Request) => {
      return new Response('unavailable', { status: 503 })
    })
    await expect(readSnapshotManifest()).rejects.toThrow('PUBLIC_CATALOGUE_UNAVAILABLE')
  })

  it('logs only the allowlisted path and status when an upstream read fails', async () => {
    fetchMock.mockImplementation(async () => new Response('synthetic-fixture-secret', {
      status: 503,
      headers: { 'content-type': 'text/plain', 'x-internal-detail': 'synthetic private fixture' },
    }))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(readSnapshotManifest()).rejects.toThrow('PUBLIC_CATALOGUE_UNAVAILABLE')

    expect(log).toHaveBeenCalledWith(JSON.stringify({
      event: 'PUBLIC_CATALOGUE_READ_FAILED', path: 'manifest.json', reason: 'http-status', status: 503,
    }))
    expect(JSON.stringify(log.mock.calls)).not.toContain('synthetic-fixture-secret')
    expect(JSON.stringify(log.mock.calls)).not.toContain('synthetic private fixture')
    log.mockRestore()
  })
})
