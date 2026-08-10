import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMocks = vi.hoisted(() => ({
    countProducts: vi.fn(),
    countCategories: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    default: {
        products: { count: prismaMocks.countProducts },
        categories: { count: prismaMocks.countCategories },
    },
}))

import { GET } from './route'

describe('GET /api/health', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        prismaMocks.countProducts.mockResolvedValue(12)
        prismaMocks.countCategories.mockResolvedValue(4)
    })

    it('returns a bounded ready response without environment details', async () => {
        const response = await GET()
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body).toEqual({ ok: true })
        expect(body).not.toHaveProperty('env')
        expect(body).not.toHaveProperty('region')
        expect(JSON.stringify(body)).not.toContain('DATABASE_URL')
        expect(JSON.stringify(body)).not.toContain('postgresql://')
    })

    it('does not expose raw database errors', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        prismaMocks.countProducts.mockRejectedValue(Object.assign(
            new Error('postgresql://user:password@db.example.test'),
            { code: 'P1001' },
        ))

        const response = await GET()
        const body = await response.json()

        expect(response.status).toBe(503)
        expect(body).toEqual({ ok: false, error: 'service_unavailable' })
        expect(JSON.stringify(body)).not.toContain('password')
        expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('P1001'))
    })
})
