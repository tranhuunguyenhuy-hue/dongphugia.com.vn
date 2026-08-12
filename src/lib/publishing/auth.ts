import { createHash, randomBytes, randomUUID } from 'node:crypto'

import prisma from '@/lib/prisma'

import { PublishingApiError } from './errors'
import type { PublishingTransaction } from './idempotency'

export const PUBLISHING_CAPABILITIES = [
    'posts:write',
    'posts:publish',
    'media:write',
] as const

export type PublishingCapability = (typeof PUBLISHING_CAPABILITIES)[number]
export type PublishingEnvironment = 'staging' | 'production'

export type AuthenticatedMachineIdentity = {
    id: string
    sponsorUserId: number
    active: boolean
    capabilities: ReadonlySet<string>
    allowedIpAddresses: ReadonlySet<string>
}

export type PublishingCredentialRecord = {
    id: string
    environment: string
    expiresAt: Date
    revokedAt: Date | null
    lastUsedAt: Date | null
    identity: AuthenticatedMachineIdentity
}

export type PublishingAuthRepository = {
    findCredentialByHash(
        tokenHash: string,
    ): Promise<PublishingCredentialRecord | null>
    touchCredentialLastUsed(credentialId: string, now: Date): Promise<void>
}

export type PublishingAuthContext = {
    credentialId: string
    identity: AuthenticatedMachineIdentity
    /**
     * The single trusted proxy value observed during authentication. Keeping it
     * in the context lets a mutation re-check a subsequently changed IP policy
     * without accepting a caller-controlled forwarding header.
     */
    clientIp: string | null
}

/**
 * Re-check the authorization snapshot at the durable mutation boundary.
 *
 * Route authentication intentionally remains cheap and returns a snapshot for
 * reads. Writes must call this while holding the Identity, Credential and
 * capability rows so a control-plane revoke linearizes either before the
 * mutation (it is rejected) or after its committed transition.
 */
export async function lockPublishingMutationAuthorization(
    transaction: PublishingTransaction,
    input: {
        credentialId: string
        identityId: string
        environment: PublishingEnvironment
        requiredCapabilities: readonly PublishingCapability[]
        clientIp: string | null
        now?: Date
    },
): Promise<AuthenticatedMachineIdentity> {
    const now = input.now ?? new Date()
    await transaction.$queryRaw`
        SELECT id FROM publishing_machine_identities
        WHERE id = ${input.identityId}::uuid FOR UPDATE
    `
    await transaction.$queryRaw`
        SELECT id FROM publishing_credentials
        WHERE id = ${input.credentialId}::uuid FOR UPDATE
    `
    await transaction.$queryRaw`
        SELECT capability FROM publishing_identity_capabilities
        WHERE identity_id = ${input.identityId}::uuid FOR UPDATE
    `
    await transaction.$queryRaw`
        SELECT ip_address FROM publishing_identity_ip_allowlist
        WHERE identity_id = ${input.identityId}::uuid FOR UPDATE
    `

    const credential = await transaction.publishing_credentials.findUnique({
        where: { id: input.credentialId },
        include: {
            identity: {
                include: {
                    capabilities: {
                        where: { revoked_at: null },
                        select: { capability: true },
                    },
                    ip_allowlist: { select: { ip_address: true } },
                },
            },
        },
    })
    if (
        !credential
        || credential.identity_id !== input.identityId
        || credential.environment !== input.environment
        || credential.revoked_at
        || credential.expires_at.getTime() <= now.getTime()
    ) {
        throw new PublishingApiError(
            401,
            'CREDENTIAL_REVOKED',
            'Publishing credential is no longer authorized',
        )
    }
    if (!credential.identity.is_active) {
        throw new PublishingApiError(403, 'IDENTITY_DISABLED', 'Machine Identity is disabled')
    }
    const allowedIpAddresses = new Set(
        credential.identity.ip_allowlist.map(({ ip_address }) => ip_address),
    )
    if (
        allowedIpAddresses.size > 0
        && (!input.clientIp || !allowedIpAddresses.has(input.clientIp))
    ) {
        throw new PublishingApiError(
            403,
            'IP_NOT_ALLOWED',
            'Request network is not allowed for this Machine Identity',
        )
    }

    const capabilities = new Set(
        credential.identity.capabilities.map(({ capability }) => capability),
    )
    const missing = input.requiredCapabilities.find(
        (capability) => !capabilities.has(capability),
    )
    if (missing) {
        throw new PublishingApiError(
            403,
            'CAPABILITY_REQUIRED',
            'Machine Identity lacks a required capability',
            [{ field: 'capability', code: missing }],
        )
    }
    return {
        id: credential.identity.id,
        sponsorUserId: credential.identity.sponsor_user_id,
        active: credential.identity.is_active,
        capabilities,
        allowedIpAddresses,
    }
}

export function hashPublishingCredential(token: string): string {
    return createHash('sha256').update(token).digest('hex')
}

export function generatePublishingCredential(
    environment: PublishingEnvironment,
): { id: string; token: string; tokenPrefix: string; tokenHash: string } {
    const publicPrefix = randomBytes(4).toString('hex')
    const secret = randomBytes(32).toString('base64url')
    const tokenPrefix = `dpgp_${environment}_${publicPrefix}`
    const token = `${tokenPrefix}_${secret}`

    return {
        id: randomUUID(),
        token,
        tokenPrefix,
        tokenHash: hashPublishingCredential(token),
    }
}

function parseBearerToken(request: Request): string {
    const authorization = request.headers.get('authorization')
    const match = authorization?.match(/^Bearer ([^\s]{32,256})$/)
    if (!match) {
        throw new PublishingApiError(
            401,
            'CREDENTIAL_REQUIRED',
            'A valid Publishing Bearer credential is required',
        )
    }
    return match[1]
}

function extractClientIp(
    request: Request,
    trustedClientIpHeader?: string,
): string | null {
    if (!trustedClientIpHeader) return null
    const value = request.headers.get(trustedClientIpHeader)
    if (!value || value.includes(',')) return null
    return value.trim() || null
}

export const prismaPublishingAuthRepository: PublishingAuthRepository = {
    async findCredentialByHash(tokenHash) {
        const credential = await prisma.publishing_credentials.findUnique({
            where: { token_hash: tokenHash },
            include: {
                identity: {
                    include: {
                        capabilities: {
                            where: { revoked_at: null },
                            select: { capability: true },
                        },
                        ip_allowlist: { select: { ip_address: true } },
                    },
                },
            },
        })

        if (!credential) return null
        return {
            id: credential.id,
            environment: credential.environment,
            expiresAt: credential.expires_at,
            revokedAt: credential.revoked_at,
            lastUsedAt: credential.last_used_at,
            identity: {
                id: credential.identity.id,
                sponsorUserId: credential.identity.sponsor_user_id,
                active: credential.identity.is_active,
                capabilities: new Set(
                    credential.identity.capabilities.map(
                        ({ capability }) => capability,
                    ),
                ),
                allowedIpAddresses: new Set(
                    credential.identity.ip_allowlist.map(
                        ({ ip_address }) => ip_address,
                    ),
                ),
            },
        }
    },
    async touchCredentialLastUsed(credentialId, now) {
        const staleBefore = new Date(now.getTime() - 5 * 60 * 1000)
        await prisma.publishing_credentials.updateMany({
            where: {
                id: credentialId,
                OR: [
                    { last_used_at: null },
                    { last_used_at: { lt: staleBefore } },
                ],
            },
            data: { last_used_at: now },
        })
    },
}

export async function authenticatePublishingRequest(
    request: Request,
    requiredCapabilities: readonly PublishingCapability[],
    options: {
        repository?: PublishingAuthRepository
        environment: PublishingEnvironment
        now?: Date
        trustedClientIpHeader?: string
    },
): Promise<PublishingAuthContext> {
    const token = parseBearerToken(request)
    const repository = options.repository ?? prismaPublishingAuthRepository
    const credential = await repository.findCredentialByHash(
        hashPublishingCredential(token),
    )

    if (!credential || credential.environment !== options.environment) {
        throw new PublishingApiError(
            401,
            'CREDENTIAL_INVALID',
            'Publishing credential is invalid',
        )
    }

    const now = options.now ?? new Date()
    if (credential.revokedAt) {
        throw new PublishingApiError(
            401,
            'CREDENTIAL_REVOKED',
            'Publishing credential has been revoked',
        )
    }
    if (credential.expiresAt.getTime() <= now.getTime()) {
        throw new PublishingApiError(
            401,
            'CREDENTIAL_EXPIRED',
            'Publishing credential has expired',
        )
    }
    if (!credential.identity.active) {
        throw new PublishingApiError(
            403,
            'IDENTITY_DISABLED',
            'Machine Identity is disabled',
        )
    }

    const clientIp = extractClientIp(request, options.trustedClientIpHeader)
    if (credential.identity.allowedIpAddresses.size > 0) {
        if (!clientIp || !credential.identity.allowedIpAddresses.has(clientIp)) {
            throw new PublishingApiError(
                403,
                'IP_NOT_ALLOWED',
                'Request network is not allowed for this Machine Identity',
            )
        }
    }

    const missingCapability = requiredCapabilities.find(
        (capability) => !credential.identity.capabilities.has(capability),
    )
    if (missingCapability) {
        throw new PublishingApiError(
            403,
            'CAPABILITY_REQUIRED',
            'Machine Identity lacks a required capability',
            [{ field: 'capability', code: missingCapability }],
        )
    }

    await repository.touchCredentialLastUsed(credential.id, now).catch(() => {
        // last_used_at is observational and must not extend or invalidate access.
    })

    return {
        credentialId: credential.id,
        identity: credential.identity,
        clientIp,
    }
}
