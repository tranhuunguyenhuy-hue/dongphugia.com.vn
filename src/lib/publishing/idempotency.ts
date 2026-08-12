import { createHash, randomUUID } from 'node:crypto'

import { Prisma } from '@prisma/client'

import prisma from '@/lib/prisma'

import { PublishingApiError } from './errors'

export const IDEMPOTENCY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

export type IdempotentMutationResult<T> = {
    status: number
    body: T
    resourceType?: string
    resourceId?: string
}

export type PublishingTransaction = Parameters<
    Parameters<typeof prisma.$transaction>[0]
>[0]

function canonicalize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonicalize)
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, child]) => [key, canonicalize(child)]),
        )
    }
    return value
}

export function hashCanonicalJson(value: unknown): string {
    return createHash('sha256')
        .update(JSON.stringify(canonicalize(value)))
        .digest('hex')
}

export function hashIdempotencyKey(key: string): string {
    return createHash('sha256').update(key).digest('hex')
}

export function readIdempotencyReplay<T>(
    record: {
        request_hash: string
        operation: string
        status: string
        response_status: number | null
        safe_response: Prisma.JsonValue | null
    },
    requestHash: string,
    operation: string,
): IdempotentMutationResult<T> {
    if (
        record.request_hash !== requestHash
        || record.operation !== operation
    ) {
        throw new PublishingApiError(
            409,
            'IDEMPOTENCY_KEY_REUSED',
            'Idempotency-Key was already used for a different request',
        )
    }
    if (
        record.status !== 'completed'
        || record.response_status === null
        || record.safe_response === null
    ) {
        throw new PublishingApiError(
            409,
            'IDEMPOTENCY_IN_PROGRESS',
            'An operation with this Idempotency-Key is still in progress',
            undefined,
            2,
        )
    }

    return {
        status: record.response_status,
        body: record.safe_response as T,
    }
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
    return (
        Array.isArray(target)
        && target.includes('identity_id')
        && target.includes('key_hash')
    )
}

export async function runIdempotentJsonMutation<T extends Prisma.JsonObject>(
    input: {
        identityId: string
        key: string
        operation: string
        request: unknown
        now?: Date
    },
    mutate: (
        transaction: PublishingTransaction,
        context: { keyHash: string; requestHash: string },
    ) => Promise<IdempotentMutationResult<T>>,
    retryCount = 0,
): Promise<IdempotentMutationResult<T> & { replayed: boolean }> {
    const now = input.now ?? new Date()
    const keyHash = hashIdempotencyKey(input.key)
    const requestHash = hashCanonicalJson(input.request)

    try {
        return await prisma.$transaction(async (transaction) => {
            const existing =
                await transaction.publishing_idempotency_records.findUnique({
                    where: {
                        identity_id_key_hash: {
                            identity_id: input.identityId,
                            key_hash: keyHash,
                        },
                    },
                })

            if (existing && existing.expires_at.getTime() > now.getTime()) {
                return {
                    ...readIdempotencyReplay<T>(
                        existing,
                        requestHash,
                        input.operation,
                    ),
                    replayed: true,
                }
            }
            if (existing) {
                await transaction.publishing_idempotency_records.delete({
                    where: { id: existing.id },
                })
            }

            const recordId = randomUUID()
            await transaction.publishing_idempotency_records.create({
                data: {
                    id: recordId,
                    identity_id: input.identityId,
                    key_hash: keyHash,
                    request_hash: requestHash,
                    operation: input.operation,
                    expires_at: new Date(
                        now.getTime() + IDEMPOTENCY_RETENTION_MS,
                    ),
                },
            })

            const result = await mutate(transaction, { keyHash, requestHash })
            await transaction.publishing_idempotency_records.update({
                where: { id: recordId },
                data: {
                    status: 'completed',
                    response_status: result.status,
                    safe_response: result.body,
                    resource_type: result.resourceType,
                    resource_id: result.resourceId,
                    completed_at: now,
                },
            })

            return { ...result, replayed: false }
        })
    } catch (error) {
        if (!isIdempotencyUniqueConflict(error)) throw error
        const existing =
            await prisma.publishing_idempotency_records.findUnique({
                where: {
                    identity_id_key_hash: {
                        identity_id: input.identityId,
                        key_hash: keyHash,
                    },
                },
            })
        if (!existing) {
            if (retryCount >= 1) {
                throw new PublishingApiError(
                    409,
                    'IDEMPOTENCY_IN_PROGRESS',
                    'An operation with this Idempotency-Key is still resolving',
                    undefined,
                    2,
                )
            }
            return runIdempotentJsonMutation(input, mutate, retryCount + 1)
        }
        return {
            ...readIdempotencyReplay<T>(existing, requestHash, input.operation),
            replayed: true,
        }
    }
}
