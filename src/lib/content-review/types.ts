export const CONTENT_REVIEW_SOURCE = 'hita_cleanup_v1' as const
export const CONTENT_REVIEW_SCHEMA_VERSION = 1 as const
export const CONTENT_REVIEW_CLEANUP_VERSION = 'deterministic_html_v1' as const

export type ReviewState =
    | 'draft'
    | 'needs_review'
    | 'approved'
    | 'blocked'
    | 'rejected'
    | 'ready_to_apply'

export type ReviewTransition = 'submit' | 'approve' | 'block' | 'reject' | 'pause' | 'resume' | 'ready'

export type ReviewImageKind = 'main' | 'gallery' | 'embedded'
export type ReviewImagePolicy =
    | 'KEEP_EXISTING_BUNNY'
    | 'HITA_HOSTED_REVIEW'
    | 'EXTERNAL_REVIEW'
export type ReviewImageDecision = 'KEEP' | 'REMOVE' | 'REPLACE' | 'HUMAN_REVIEW'

export interface ReviewImage {
    kind: ReviewImageKind
    sourceUrl: string
    normalizedUrl: string
    fingerprint: string
    policy: ReviewImagePolicy
    decision: ReviewImageDecision
    replacementUrl?: string
    altText?: string
}

export interface ReviewContentSnapshot {
    descriptionHtml: string
    images: ReviewImage[]
}

export interface ContentReviewProposal {
    schemaVersion: typeof CONTENT_REVIEW_SCHEMA_VERSION
    source: typeof CONTENT_REVIEW_SOURCE
    proposalId: string
    product: {
        id: number
        sku: string
        name: string
    }
    version: number
    baseHash: string
    proposalHash: string
    generation: {
        adapter: string
        mode: 'mock'
        cleanupVersion: typeof CONTENT_REVIEW_CLEANUP_VERSION
    }
    workflow: {
        paused: boolean
        pauseReason?: string
    }
    before: ReviewContentSnapshot
    after: ReviewContentSnapshot
}

export interface ProductContentInput {
    id: number
    sku: string
    name: string
    sourceUrl: string
    descriptionHtml: string
    imageMainUrl?: string | null
    galleryImages?: Array<{
        url: string
        altText?: string | null
    }>
}

export interface SerializedReviewQueueItem {
    id: number
    productId: number
    sku: string
    name: string
    state: ReviewState
    version: number
    proposalHash: string
    totalImages: number
    pendingImages: number
    duplicateProducts: number
    paused: boolean
    updatedAt: string
}

export interface SerializedReviewQueuePage {
    items: SerializedReviewQueueItem[]
    total: number
    page: number
    pageSize: number
    totalPages: number
}

export interface SerializedReviewDetail {
    decisionId: number
    state: ReviewState
    reason: string | null
    reviewerId: number | null
    reviewedAt: string | null
    updatedAt: string
    duplicateProductIdsByFingerprint: Record<string, number[]>
    previewHtml: string
    proposal: ContentReviewProposal
}
