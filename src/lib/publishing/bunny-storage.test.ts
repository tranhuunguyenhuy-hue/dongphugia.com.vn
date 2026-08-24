import { afterEach, describe, expect, it, vi } from 'vitest'

import { storePublishingImage } from './bunny-storage'

describe('Publishing Bunny storage URL contract', () => {
    afterEach(() => {
        vi.restoreAllMocks()
        for (const name of [
            'PUBLISHING_BUNNY_STORAGE_ENVIRONMENT',
            'PUBLISHING_BUNNY_STORAGE_ZONE_NAME',
            'PUBLISHING_BUNNY_STORAGE_API_KEY',
            'PUBLISHING_BUNNY_STORAGE_HOSTNAME',
            'PUBLISHING_BUNNY_CDN_HOSTNAME',
        ]) {
            delete process.env[name]
        }
    })

    it('writes canonical CDN URLs when the runtime still has a legacy hostname', async () => {
        process.env.PUBLISHING_BUNNY_STORAGE_ENVIRONMENT = 'production'
        process.env.PUBLISHING_BUNNY_STORAGE_ZONE_NAME = 'publishing-zone'
        process.env.PUBLISHING_BUNNY_STORAGE_API_KEY = 'test-only-placeholder'
        process.env.PUBLISHING_BUNNY_STORAGE_HOSTNAME = 'storage.example.com'
        process.env.PUBLISHING_BUNNY_CDN_HOSTNAME = 'dpg-publishing-production.b-cdn.net'
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            body: null,
        } as Response)

        const result = await storePublishingImage({
            environment: 'production',
            identityId: 'identity-id',
            assetId: 'asset-id',
            purpose: 'inline',
            processed: {
                sourceWidth: 960,
                sourceHeight: 640,
                variants: [{
                    targetWidth: 960,
                    width: 960,
                    height: 640,
                    bytes: 42,
                    format: 'webp',
                    buffer: Buffer.from('test-image'),
                }],
            },
        })

        expect(result.primaryUrl).toBe(
            'https://media.dongphugia.vn/publishing/identity-id/asset-id/inline.w960.webp',
        )
        expect(result.variants[0]?.url).toBe(result.primaryUrl)
    })
})
