import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
    revalidateTag: vi.fn(),
}))

vi.mock('next/cache', () => ({
    revalidateTag: mocks.revalidateTag,
}))

import { GET, POST } from './route'

function createRequest(secret?: string, tags = 'brands,categories') {
    return new NextRequest(`https://example.test/api/admin/revalidate?tags=${tags}`, {
        method: 'POST',
        headers: secret ? { 'x-revalidate-secret': secret } : undefined,
    })
}

describe('/api/admin/revalidate', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.unstubAllEnvs()
    })

    it('fails closed when no revalidation secret is configured', async () => {
        const response = await POST(createRequest('unused'))

        expect(response.status).toBe(503)
        expect(mocks.revalidateTag).not.toHaveBeenCalled()
    })

    it('rejects requests with a missing or wrong secret', async () => {
        vi.stubEnv('REVALIDATE_SECRET', 'correct-secret')

        const response = await POST(createRequest('wrong-secret'))

        expect(response.status).toBe(401)
        expect(mocks.revalidateTag).not.toHaveBeenCalled()
    })

    it('revalidates only after the configured secret matches', async () => {
        vi.stubEnv('REVALIDATE_SECRET', 'correct-secret')

        const response = await POST(createRequest('correct-secret', 'brands,categories'))
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body).toMatchObject({
            success: true,
            revalidated: ['brands', 'categories'],
        })
        expect(mocks.revalidateTag).toHaveBeenCalledWith('brands', 'max')
        expect(mocks.revalidateTag).toHaveBeenCalledWith('categories', 'max')
    })

    it('does not allow GET revalidation convenience calls', async () => {
        vi.stubEnv('REVALIDATE_SECRET', 'correct-secret')

        const response = await GET()

        expect(response.status).toBe(405)
        expect(response.headers.get('allow')).toBe('POST')
        expect(mocks.revalidateTag).not.toHaveBeenCalled()
    })
})
