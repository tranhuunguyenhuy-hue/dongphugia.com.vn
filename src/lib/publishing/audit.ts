import { createHash } from 'node:crypto'

import type { PublishingTransaction } from './idempotency'

export function hashPublishingContent(contentHtml: string): string {
    return createHash('sha256').update(contentHtml).digest('hex')
}

export async function writePublishingAudit(
    transaction: PublishingTransaction,
    input: {
        actorKind: 'machine' | 'scheduler' | 'admin'
        identityId?: string
        adminActorId?: number
        sponsorUserId?: number
        action: string
        postId?: number
        externalId?: string
        requestId?: string
        idempotencyKeyHash?: string
        fromVersion?: number
        toVersion?: number
        fromState?: string
        toState?: string
        changedFields?: string[]
        contentHtml?: string
        metadata?: Record<string, string | number | boolean | null>
        now?: Date
    },
): Promise<void> {
    await transaction.publishing_audit_events.create({
        data: {
            actor_kind: input.actorKind,
            identity_id: input.identityId,
            admin_actor_id: input.adminActorId,
            sponsor_user_id: input.sponsorUserId,
            action: input.action,
            post_id: input.postId,
            external_id: input.externalId,
            request_id: input.requestId,
            idempotency_key_hash: input.idempotencyKeyHash,
            from_version: input.fromVersion,
            to_version: input.toVersion,
            from_state: input.fromState,
            to_state: input.toState,
            changed_fields: input.changedFields ?? [],
            content_hash: input.contentHtml
                ? hashPublishingContent(input.contentHtml)
                : undefined,
            metadata: input.metadata,
            created_at: input.now,
        },
    })
}
