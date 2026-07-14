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

    it('returns health metrics without environment details', async () => {
        const response = await GET()
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body).toMatchObject({
            ok: true,
            db: {
                ok: true,
                products: 12,
                categories: 4,
            },
        })
        expect(body).not.toHaveProperty('env')
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

        expect(body).toMatchObject({
            ok: false,
            db: {
                ok: false,
                error: 'database_unavailable',
            },
        })
        expect(JSON.stringify(body)).not.toContain('password')
        expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('P1001'))
    })
})
