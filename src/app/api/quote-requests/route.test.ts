import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/actions', () => ({ submitQuoteRequest: vi.fn() }))

import { GET } from './route'

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
