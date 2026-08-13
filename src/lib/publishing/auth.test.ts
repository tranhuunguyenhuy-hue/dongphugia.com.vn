import { describe, expect, it, vi } from 'vitest'

import { PublishingApiError } from './errors'
import {
    authenticatePublishingRequest,
    hashPublishingCredential,
    type PublishingAuthRepository,
} from './auth'

const token = 'dpgp_staging_abcd1234_test-secret-value'

function repository(
    overrides: Partial<
        NonNullable<
            Awaited<ReturnType<PublishingAuthRepository['findCredentialByHash']>>
        >
    > = {},
): PublishingAuthRepository {
    return {
        findCredentialByHash: vi.fn().mockResolvedValue({
            id: 'credential-id',
            environment: 'staging',
            expiresAt: new Date('2026-09-01T00:00:00.000Z'),
            revokedAt: null,
            lastUsedAt: null,
            identity: {
                id: 'identity-id',
                sponsorUserId: 7,
                active: true,
                capabilities: new Set(['posts:write', 'posts:publish']),
                allowedIpAddresses: new Set(),
            },
            ...overrides,
        }),
        touchCredentialLastUsed: vi.fn().mockResolvedValue(undefined),
    }
}

describe('authenticatePublishingRequest', () => {
    it('authenticates one Machine Identity and checks required capabilities', async () => {
        const repo = repository()

        const context = await authenticatePublishingRequest(
            new Request('https://www.dongphugia.vn/api/publishing/v1/taxonomy', {
                headers: { authorization: `Bearer ${token}` },
            }),
            ['posts:write'],
            {
                repository: repo,
                environment: 'staging',
                now: new Date('2026-08-12T00:00:00.000Z'),
            },
        )

        expect(context.identity.id).toBe('identity-id')
        expect(context.clientIp).toBeNull()
        expect(repo.findCredentialByHash).toHaveBeenCalledWith(
            hashPublishingCredential(token),
        )
    })

    it('carries the validated trusted IP into a write context for boundary re-checking', async () => {
        const repo = repository({
            identity: {
                id: 'identity-id',
                sponsorUserId: 7,
                active: true,
                capabilities: new Set(['posts:write']),
                allowedIpAddresses: new Set(['203.0.113.10']),
            },
        })

        const context = await authenticatePublishingRequest(
            new Request('https://www.dongphugia.vn/api/publishing/v1/posts', {
                headers: {
                    authorization: `Bearer ${token}`,
                    'x-trusted-client-ip': '203.0.113.10',
                },
            }),
            ['posts:write'],
            {
                repository: repo,
                environment: 'staging',
                trustedClientIpHeader: 'x-trusted-client-ip',
            },
        )

        expect(context.clientIp).toBe('203.0.113.10')
    })

    it('returns the stable expired-credential error', async () => {
        const repo = repository({
            expiresAt: new Date('2026-08-01T00:00:00.000Z'),
        })

        await expect(
            authenticatePublishingRequest(
                new Request('https://www.dongphugia.vn/api/publishing/v1/taxonomy', {
                    headers: { authorization: `Bearer ${token}` },
                }),
                [],
                {
                    repository: repo,
                    environment: 'staging',
                    now: new Date('2026-08-12T00:00:00.000Z'),
                },
            ),
        ).rejects.toEqual(
            new PublishingApiError(
                401,
                'CREDENTIAL_EXPIRED',
                'Publishing credential has expired',
            ),
        )
    })

    it('denies a missing capability without treating the token as invalid', async () => {
        const repo = repository()

        await expect(
            authenticatePublishingRequest(
                new Request('https://www.dongphugia.vn/api/publishing/v1/posts', {
                    headers: { authorization: `Bearer ${token}` },
                }),
                ['media:write'],
                {
                    repository: repo,
                    environment: 'staging',
                    now: new Date('2026-08-12T00:00:00.000Z'),
                },
            ),
        ).rejects.toMatchObject({
            status: 403,
            code: 'CAPABILITY_REQUIRED',
        })
    })
})
