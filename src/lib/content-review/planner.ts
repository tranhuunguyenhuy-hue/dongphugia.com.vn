import { hashObject } from './hash'
import type { ContentReviewProposal, ReviewState } from './types'

export const CONTENT_APPLY_ALLOWLIST = Object.freeze([
    'products.description',
    'products.image_main_url',
    'product_images.image_url',
    'product_descriptions.clean_html',
])

export interface PlannedContentOperation {
    table: 'products' | 'product_images' | 'product_descriptions'
    field: 'description' | 'image_main_url' | 'image_url' | 'clean_html'
    productId: number
    valueHash: string
    sourceFingerprint?: string
}

export interface ContentChangePlan {
    mode: 'dry-run'
    executable: false
    direction: 'apply' | 'rollback'
    source: ContentReviewProposal['source']
    proposalId: string
    proposalHash: string
    operations: PlannedContentOperation[]
}

function assertAllowlisted(operation: PlannedContentOperation): void {
    const target = `${operation.table}.${operation.field}`
    if (!CONTENT_APPLY_ALLOWLIST.includes(target)) {
        throw new Error(`Planner target is not allowlisted: ${target}`)
    }
}

export function createContentChangePlan(
    proposal: ContentReviewProposal,
    state: ReviewState,
    direction: 'apply' | 'rollback' = 'apply',
): ContentChangePlan {
    if (direction === 'apply' && state !== 'ready_to_apply') {
        throw new Error('Apply planning requires ready_to_apply state')
    }
    const snapshot = direction === 'apply' ? proposal.after : proposal.before
    const operations: PlannedContentOperation[] = [
        {
            table: 'products',
            field: 'description',
            productId: proposal.product.id,
            valueHash: hashObject(snapshot.descriptionHtml),
        },
        {
            table: 'product_descriptions',
            field: 'clean_html',
            productId: proposal.product.id,
            valueHash: hashObject(snapshot.descriptionHtml),
        },
        ...snapshot.images
            .filter(image => image.kind !== 'embedded')
            .filter(image => direction === 'rollback' || image.decision === 'KEEP' || image.decision === 'REPLACE')
            .map((image): PlannedContentOperation => ({
                table: image.kind === 'main' ? 'products' : 'product_images',
                field: image.kind === 'main' ? 'image_main_url' : 'image_url',
                productId: proposal.product.id,
                valueHash: hashObject(image.replacementUrl || image.normalizedUrl),
                sourceFingerprint: image.fingerprint,
            })),
    ]
    operations.forEach(assertAllowlisted)
    return {
        mode: 'dry-run',
        executable: false,
        direction,
        source: proposal.source,
        proposalId: proposal.proposalId,
        proposalHash: proposal.proposalHash,
        operations,
    }
}
