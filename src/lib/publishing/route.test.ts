// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    authenticate: vi.fn(),
    consumeRateLimit: vi.fn(),
}))

vi.mock('./auth', () => ({
    authenticatePublishingRequest: mocks.authenticate,
}))

vi.mock('./config', () => ({
    getPublishingRuntimeConfig: () => ({
        environment: 'staging',
        externalLinkHostnames: new Set(),
        internalLinkHostnames: new Set(['www.dongphugia.vn']),
        jsonRateLimit: 60,
        mediaRateLimit: 20,
        rateLimitWindowSeconds: 60,
    }),
    requirePublishingHttps: vi.fn(),
}))

vi.mock('./rate-limit', () => ({
    consumePublishingRateLimit: mocks.consumeRateLimit,
}))

import { withAuthenticatedPublishingRoute } from './route'

beforeEach(() => {
    mocks.authenticate.mockResolvedValue({
        credentialId: 'credential-id',
        identity: { id: 'identity-id' },
        clientIp: null,
    })
})

afterEach(() => {
    vi.clearAllMocks()
    delete process.env.WRITE_FREEZE_MODE
})

describe('withAuthenticatedPublishingRoute', () => {
    it('returns the standard freeze response before consuming a mutation rate-limit write', async () => {
        process.env.WRITE_FREEZE_MODE = 'true'
        const handler = vi.fn()

        const response = await withAuthenticatedPublishingRoute(
            new Request('https://www.dongphugia.vn/api/publishing/v1/posts'),
            {
                requiredCapabilities: ['posts:write'],
                bucket: 'json',
                mutation: true,
            },
            handler,
        )

        expect(response.status).toBe(503)
        await expect(response.json()).resolves.toMatchObject({
            code: 'WRITE_FREEZE_ACTIVE',
        })
        expect(mocks.consumeRateLimit).not.toHaveBeenCalled()
        expect(handler).not.toHaveBeenCalled()
    })
})
