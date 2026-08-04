import { afterEach, describe, expect, it, vi } from 'vitest'

const { submitQuoteRequest } = vi.hoisted(() => ({ submitQuoteRequest: vi.fn() }))

vi.mock('@/lib/actions', () => ({ submitQuoteRequest }))

import { GET, POST } from './route'

afterEach(() => {
    vi.unstubAllEnvs()
    submitQuoteRequest.mockReset()
})

describe('GET /api/quote-requests', () => {
    it('does not expose quote history by phone number', async () => {
        const response = await GET()
        const body = await response.json()

        expect(response.status).toBe(405)
        expect(response.headers.get('allow')).toBe('POST')
        expect(body).toMatchObject({
            success: false,
            code: 'METHOD_NOT_ALLOWED',
        })
    })
})

describe('POST /api/quote-requests', () => {
    it('returns the standard maintenance response while writes are frozen', async () => {
        vi.stubEnv('WRITE_FREEZE_MODE', 'true')
        const request = new Request('http://localhost/api/quote-requests', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                name: 'STG-DEMO Freeze Probe',
                phone: '0900000000',
                products: [],
            }),
        })

        const response = await POST(request as never)
        const body = await response.json()

        expect(response.status).toBe(503)
        expect(body).toMatchObject({
            success: false,
            code: 'WRITE_FREEZE_ACTIVE',
        })
        expect(submitQuoteRequest).not.toHaveBeenCalled()
    })
})
