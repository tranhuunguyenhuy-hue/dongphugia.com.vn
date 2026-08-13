// @vitest-environment node

import { afterEach, describe, expect, it } from 'vitest'

import { uploadPublishingMedia } from './media-upload'
import { mutatePublishingPost } from './posts'

const auth = {
    credentialId: '11111111-1111-4111-8111-111111111111',
    identity: {
        id: '22222222-2222-4222-8222-222222222222',
        sponsorUserId: 1,
        active: true,
        capabilities: new Set(['posts:write', 'posts:publish', 'media:write']),
        allowedIpAddresses: new Set<string>(),
    },
    clientIp: null,
}

const config = {
    environment: 'staging' as const,
    externalLinkHostnames: new Set<string>(),
    internalLinkHostnames: new Set(['www.dongphugia.vn']),
    jsonRateLimit: 60,
    mediaRateLimit: 20,
    rateLimitWindowSeconds: 60,
}

afterEach(() => {
    delete process.env.WRITE_FREEZE_MODE
})

describe('Publishing mutation write-freeze boundary', () => {
    it('rejects a Blog Post mutation before opening an idempotency operation', async () => {
        process.env.WRITE_FREEZE_MODE = 'true'

        await expect(
            mutatePublishingPost({
                auth,
                externalId: 'freeze-post',
                idempotencyKey: 'freeze-post-operation',
                requestId: '33333333-3333-4333-8333-333333333333',
                create: true,
                mutation: {
                    title: 'Freeze probe',
                    excerpt: '',
                    content_html: '',
                    category_slug: 'stg-demo-blog',
                    tag_slugs: [],
                    publication: { mode: 'draft' },
                },
                config,
            }),
        ).rejects.toMatchObject({ code: 'WRITE_FREEZE_ACTIVE' })
    })

    it('rejects Managed Media before image processing or storage', async () => {
        process.env.WRITE_FREEZE_MODE = 'true'

        await expect(
            uploadPublishingMedia({
                auth,
                environment: 'staging',
                idempotencyKey: 'freeze-media-operation',
                purpose: 'inline',
                declaredMime: 'image/jpeg',
                source: Buffer.from('not processed while frozen'),
                requestId: '44444444-4444-4444-8444-444444444444',
            }),
        ).rejects.toMatchObject({ code: 'WRITE_FREEZE_ACTIVE' })
    })
})
