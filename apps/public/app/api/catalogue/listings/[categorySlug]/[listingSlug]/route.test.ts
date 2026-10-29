import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getShard: vi.fn() }))
vi.mock('../../../../../../src/runtime/public-snapshot-listing', () => ({
    getPublicSnapshotListingShard: mocks.getShard,
}))

import { GET } from './route'

const params = Promise.resolve({ categorySlug: 'thiet-bi-bep', listingSlug: 'voi-rua-chen' })
const shard = {
    contract: 'dpg:public-catalogue-listing-shard:v1',
    checkpoint: 'a'.repeat(40),
    categorySlug: 'thiet-bi-bep',
    listingSlug: 'voi-rua-chen',
    page: 1,
    pageSize: 48,
    totalCount: 1,
    totalPages: 1,
    products: [{ id: 1, price: null, is_promotion: false, is_featured: true }],
}

describe('public snapshot listing shard endpoint', () => {
    beforeEach(() => mocks.getShard.mockReset())

    it('returns only the public shard contract with private no-store/noindex headers', async () => {
        mocks.getShard.mockResolvedValue(shard)
        const response = await GET(new Request('https://preview.invalid/api/catalogue/listings/thiet-bi-bep/voi-rua-chen'), { params })
        expect(response.status).toBe(200)
        expect(response.headers.get('cache-control')).toBe('private, no-store')
        expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
        expect(response.headers.get('content-type')).toContain('application/json')
        expect(await response.json()).toEqual(shard)
        expect(mocks.getShard).toHaveBeenCalledWith('thiet-bi-bep', 'voi-rua-chen', 1)
    })

    it('rejects unsupported and malformed query strings before reading snapshot assets', async () => {
        const unsupported = await GET(new Request('https://preview.invalid/api/catalogue/listings/thiet-bi-bep/voi-rua-chen?price=1'), { params })
        const duplicate = await GET(new Request('https://preview.invalid/api/catalogue/listings/thiet-bi-bep/voi-rua-chen?page=1&page=2'), { params })
        const malformed = await GET(new Request('https://preview.invalid/api/catalogue/listings/thiet-bi-bep/voi-rua-chen?page=0'), { params })
        expect(unsupported.status).toBe(400)
        expect(duplicate.status).toBe(400)
        expect(malformed.status).toBe(400)
        expect(mocks.getShard).not.toHaveBeenCalled()
    })

    it('keeps not-found and unavailable states distinct', async () => {
        mocks.getShard.mockResolvedValueOnce(null)
        const missing = await GET(new Request('https://preview.invalid/api/catalogue/listings/thiet-bi-bep/voi-rua-chen'), { params })
        expect(missing.status).toBe(404)

        mocks.getShard.mockRejectedValueOnce(new Error('PUBLIC_CATALOGUE_UNAVAILABLE'))
        const unavailable = await GET(new Request('https://preview.invalid/api/catalogue/listings/thiet-bi-bep/voi-rua-chen'), { params })
        expect(unavailable.status).toBe(503)
        expect(await unavailable.text()).not.toContain('PUBLIC_CATALOGUE_UNAVAILABLE')
    })
})
