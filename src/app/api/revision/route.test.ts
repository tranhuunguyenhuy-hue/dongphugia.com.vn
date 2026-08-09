import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'

describe('/api/revision', () => {
    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('returns only bounded non-secret candidate identity', async () => {
        vi.stubEnv('DPG_SOURCE_REVISION', 'a'.repeat(40))
        vi.stubEnv('DPG_BUILD_RUN_ID', '12345')
        vi.stubEnv('DPG_STAGING_PREVIEW', 'true')

        const response = await GET()

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({
            ok: true,
            sourceRevision: 'a'.repeat(40),
            buildRunId: '12345',
            stagingPreview: true,
        })
        expect(response.headers.get('cache-control')).toBe('no-store')
    })

    it('fails closed when build identity is absent', async () => {
        const response = await GET()
        expect(response.status).toBe(503)
    })
})
