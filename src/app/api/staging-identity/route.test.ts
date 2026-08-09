import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    queryRaw: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    default: { $queryRaw: mocks.queryRaw },
}))

import { GET } from './route'

const stagingUrl = 'https://dongphugia-staging.47-131-92-97.sslip.io'

describe('/api/staging-identity', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.queryRaw.mockResolvedValue([{
            database_name: 'synthetic_staging',
            server_address: '10.0.0.10',
            server_port: 5432,
            table_count: BigInt(46),
            synthetic_products: BigInt(3),
            canonical_synthetic_products: BigInt(3),
            sensitive_rows: BigInt(0),
        }])
    })

    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('is unavailable outside the exact staging build and hostname', async () => {
        vi.stubEnv('DPG_STAGING_PREVIEW', 'false')
        vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.dongphugia.vn')

        const response = await GET()

        expect(response.status).toBe(404)
        expect(mocks.queryRaw).not.toHaveBeenCalled()
    })

    it('returns a hash and aggregate-only staging isolation proof', async () => {
        vi.stubEnv('DPG_STAGING_PREVIEW', 'true')
        vi.stubEnv('NEXT_PUBLIC_SITE_URL', stagingUrl)

        const response = await GET()
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body).toMatchObject({
            ok: true,
            dataset: 'STG-DEMO',
            aggregates: {
                tableCount: 46,
                syntheticProducts: 3,
                canonicalSyntheticProducts: 3,
                sensitiveRows: 0,
            },
        })
        expect(body.databaseFingerprintSha256).toMatch(/^[0-9a-f]{64}$/)
        expect(JSON.stringify(body)).not.toContain('synthetic_staging')
        expect(JSON.stringify(body)).not.toContain('10.0.0.10')
    })

    it('fails closed when any sensitive table contains rows', async () => {
        vi.stubEnv('DPG_STAGING_PREVIEW', 'true')
        vi.stubEnv('NEXT_PUBLIC_SITE_URL', stagingUrl)
        mocks.queryRaw.mockResolvedValueOnce([{
            database_name: 'synthetic_staging',
            server_address: '10.0.0.10',
            server_port: 5432,
            table_count: BigInt(46),
            synthetic_products: BigInt(3),
            canonical_synthetic_products: BigInt(3),
            sensitive_rows: BigInt(1),
        }])

        const response = await GET()

        expect(response.status).toBe(503)
        expect((await response.json()).ok).toBe(false)
    })
})
