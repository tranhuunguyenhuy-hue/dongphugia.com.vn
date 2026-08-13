import { createHash, randomUUID } from 'node:crypto'

import prisma from './database'
import { requireWritesAllowed } from '@/lib/write-freeze'

import {
    lockPublishingMutationAuthorization,
    type PublishingAuthContext,
    type PublishingEnvironment,
} from './auth'
import { writePublishingAudit } from './audit'
import { storePublishingImage } from './bunny-storage'
import { PublishingApiError } from './errors'
import {
    hashCanonicalJson,
    hashIdempotencyKey,
    IDEMPOTENCY_RETENTION_MS,
} from './idempotency'
import {
    processPublishingImage,
    type PublishingMediaPurpose,
} from './media'

type MediaResponse = {
    id: string
    purpose: string
    url: string
    variants: unknown
}

const MEDIA_OPERATION = 'media.upload'

function sourceHash(source: Buffer): string {
    return createHash('sha256').update(source).digest('hex')
}

function idempotencyConflict(message: string, code: string) {
    return new PublishingApiError(409, code, message, undefined, 2)
}

function isIdempotencyUniqueConflict(error: unknown): boolean {
    if (
        !error
        || typeof error !== 'object'
        || !('code' in error)
        || error.code !== 'P2002'
    ) {
        return false
    }
    const target =
        'meta' in error
        && error.meta
        && typeof error.meta === 'object'
        && 'target' in error.meta
            ? error.meta.target
            : undefined
    return Array.isArray(target) && target.includes('key_hash')
}

function validateExistingRecord(
    record: { request_hash: string; operation: string; status: string },
    requestHash: string,
) {
    if (
        record.operation !== MEDIA_OPERATION
        || record.request_hash !== requestHash
    ) {
        throw new PublishingApiError(
            409,
            'IDEMPOTENCY_KEY_REUSED',
            'Idempotency-Key was already used for a different request',
        )
    }
    if (record.status !== 'completed') {
        return false
    }
    return true
}

function responseFromStoredMedia(media: {
    id: string
    purpose: string
    primary_url: string | null
    variants: unknown
    status: string
}): MediaResponse {
    if (media.status !== 'ready' || !media.primary_url || !media.variants) {
        throw idempotencyConflict(
            'Managed Media with this Idempotency-Key is still processing',
            'IDEMPOTENCY_IN_PROGRESS',
        )
    }
    return {
        id: media.id,
        purpose: media.purpose,
        url: media.primary_url,
        variants: media.variants,
    }
}

export async function uploadPublishingMedia(input: {
    auth: PublishingAuthContext
    environment: PublishingEnvironment
    idempotencyKey: string
    purpose: PublishingMediaPurpose
    declaredMime: string
    source: Buffer
    requestId: string
    now?: Date
}): Promise<{ status: number; body: MediaResponse; replayed: boolean }> {
    requireWritesAllowed('publishing.media.upload')
    const now = input.now ?? new Date()
    const binaryHash = sourceHash(input.source)
    const requestHash = hashCanonicalJson({
        purpose: input.purpose,
        declared_mime: input.declaredMime,
        source_sha256: binaryHash,
        source_bytes: input.source.byteLength,
    })
    const keyHash = hashIdempotencyKey(input.idempotencyKey)
    // Avoid spending native image-processing CPU for a credential that was
    // revoked after route authentication. The reservation below rechecks again
    // under the durable write transaction.
    await prisma.$transaction((transaction) =>
        lockPublishingMutationAuthorization(transaction, {
            credentialId: input.auth.credentialId,
            identityId: input.auth.identity.id,
            environment: input.environment,
            requiredCapabilities: ['media:write'],
            clientIp: input.auth.clientIp,
        }),
    )
    const processed = await processPublishingImage(
        input.source,
        input.declaredMime,
        input.purpose,
    )

    type Reservation =
        | { completed: true; body: MediaResponse }
        | { completed: false; mediaId: string }

    const reserve = async (): Promise<Reservation> =>
        prisma.$transaction(async (transaction) => {
            await lockPublishingMutationAuthorization(transaction, {
                credentialId: input.auth.credentialId,
                identityId: input.auth.identity.id,
                environment: input.environment,
                requiredCapabilities: ['media:write'],
                clientIp: input.auth.clientIp,
            })
            requireWritesAllowed('publishing.media.reserve')
            const existing =
                await transaction.publishing_idempotency_records.findUnique({
                    where: {
                        identity_id_key_hash: {
                            identity_id: input.auth.identity.id,
                            key_hash: keyHash,
                        },
                    },
                })
            if (existing && existing.expires_at.getTime() > now.getTime()) {
                const completed = validateExistingRecord(existing, requestHash)
                if (completed) {
                    const media = existing.resource_id
                        ? await transaction.publishing_managed_media.findUnique({
                            where: { id: existing.resource_id },
                            select: {
                                id: true,
                                purpose: true,
                                primary_url: true,
                                variants: true,
                                status: true,
                            },
                        })
                        : null
                    if (!media) {
                        throw new PublishingApiError(
                            500,
                            'IDEMPOTENCY_RESOURCE_MISSING',
                            'Managed Media replay resource is unavailable',
                        )
                    }
                    return { completed: true, body: responseFromStoredMedia(media) }
                }
                if (!existing.resource_id) {
                    throw idempotencyConflict(
                        'Managed Media with this Idempotency-Key is still processing',
                        'IDEMPOTENCY_IN_PROGRESS',
                    )
                }
                return { completed: false, mediaId: existing.resource_id }
            }
            if (existing) {
                await transaction.publishing_idempotency_records.delete({
                    where: { id: existing.id },
                })
            }

            const mediaId = randomUUID()
            await transaction.publishing_idempotency_records.create({
                data: {
                    id: randomUUID(),
                    identity_id: input.auth.identity.id,
                    key_hash: keyHash,
                    request_hash: requestHash,
                    operation: MEDIA_OPERATION,
                    resource_type: 'managed_media',
                    resource_id: mediaId,
                    expires_at: new Date(
                        now.getTime() + IDEMPOTENCY_RETENTION_MS,
                    ),
                },
            })
            await transaction.publishing_managed_media.create({
                data: {
                    id: mediaId,
                    identity_id: input.auth.identity.id,
                    purpose: input.purpose,
                    source_mime: input.declaredMime,
                    source_bytes: input.source.byteLength,
                    source_sha256: binaryHash,
                    source_width: processed.sourceWidth,
                    source_height: processed.sourceHeight,
                    storage_path:
                        `publishing/${input.auth.identity.id}/${mediaId}`,
                },
            })
            return { completed: false, mediaId }
        })

    let reservation: Reservation
    try {
        reservation = await reserve()
    } catch (error) {
        if (!isIdempotencyUniqueConflict(error)) throw error
        reservation = await reserve()
    }
    if (reservation.completed) {
        return { status: 200, body: reservation.body, replayed: true }
    }

    requireWritesAllowed('publishing.media.store')
    const stored = await storePublishingImage({
        environment: input.environment,
        identityId: input.auth.identity.id,
        assetId: reservation.mediaId,
        purpose: input.purpose,
        processed,
    })
    const response: MediaResponse = {
        id: reservation.mediaId,
        purpose: input.purpose,
        url: stored.primaryUrl,
        variants: stored.variants,
    }
    await prisma.$transaction(async (transaction) => {
        await lockPublishingMutationAuthorization(transaction, {
            credentialId: input.auth.credentialId,
            identityId: input.auth.identity.id,
            environment: input.environment,
            requiredCapabilities: ['media:write'],
            clientIp: input.auth.clientIp,
        })
        requireWritesAllowed('publishing.media.commit')
        await transaction.publishing_managed_media.update({
            where: { id: reservation.mediaId },
            data: {
                status: 'ready',
                storage_path: stored.storagePath,
                primary_url: stored.primaryUrl,
                variants: stored.variants,
                updated_at: now,
            },
        })
        await transaction.publishing_idempotency_records.update({
            where: {
                identity_id_key_hash: {
                    identity_id: input.auth.identity.id,
                    key_hash: keyHash,
                },
            },
            data: {
                status: 'completed',
                response_status: 201,
                safe_response: {
                    media_id: response.id,
                    purpose: response.purpose,
                    url: response.url,
                    variants: response.variants as never,
                },
                completed_at: now,
            },
        })
        await writePublishingAudit(transaction, {
            actorKind: 'machine',
            identityId: input.auth.identity.id,
            sponsorUserId: input.auth.identity.sponsorUserId,
            action: 'media.uploaded',
            requestId: input.requestId,
            idempotencyKeyHash: keyHash,
            changedFields: ['purpose', 'source_sha256', 'variants'],
            metadata: {
                media_id: response.id,
                purpose: response.purpose,
                source_sha256: binaryHash,
                source_bytes: input.source.byteLength,
            },
            now,
        })
    })
    return { status: 201, body: response, replayed: false }
}
