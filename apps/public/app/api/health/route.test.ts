import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ enabled: false, readPublicRows: vi.fn() }))
vi.mock('../../../src/runtime/public-db', () => ({
  publicPostgresEnabled: () => mocks.enabled,
  readPublicRows: mocks.readPublicRows,
}))
vi.mock('../../../src/runtime/public-snapshot-mode', () => ({
  usesPublicSnapshot: () => false,
  usesProductionPublishedCatalogue: () => false,
}))
vi.mock('../../../src/runtime/public-snapshot-catalogue', () => ({ readSnapshotManifest: vi.fn() }))
vi.mock('../../../src/config/env', () => ({ getPublicAppEnvironment: () => ({ previewNoindex: false }) }))
vi.mock('../../../src/worker-policy', () => ({ PUBLIC_PREVIEW_ROBOTS_HEADER: 'noindex, nofollow' }))

import { GET } from './route'

describe('Public PostgreSQL health route', () => {
  beforeEach(() => {
    mocks.enabled = true
    mocks.readPublicRows.mockReset()
  })

  it('counts only granted columns and reports the public listing and published Blog totals', async () => {
    mocks.readPublicRows.mockResolvedValueOnce([{
      public_products: '5964', listing_products: '5362', blog_posts: '10',
    }])

    const response = await GET()
    const body = await response.json()
    const [statement] = mocks.readPublicRows.mock.calls[0]

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      status: 'ok', catalogueMode: 'postgresql', publicProducts: 5964,
      listingProducts: 5362, publishedBlogs: 10,
    })
    expect(statement).toContain('count(p.id)')
    expect(statement).toContain("p.listing_visibility IN ('default','low_priority')")
    expect(statement).toContain("p.pdp_visibility='public'")
    expect(statement).toContain("p.slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'")
    expect(statement).toContain('count(b.id)')
    expect(statement).toContain("b.status='published'")
    expect(statement).not.toContain('count(*)')
  })
})
