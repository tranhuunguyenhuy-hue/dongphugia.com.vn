import { requirePermission } from '@/lib/auth/get-current-user'
import prisma from '@/lib/prisma'
import { maskRemoteImagesForPreview } from './cleanup'
import { CONTENT_REVIEW_READ_BATCH_SIZE, readAllContentReviewPages } from './pagination'
import { parseContentReviewProposal } from './proposal'
import { CONTENT_REVIEW_SOURCE, type ReviewState, type SerializedReviewDetail, type SerializedReviewQueueItem, type SerializedReviewQueuePage } from './types'

function proposalOrNull(value: unknown) {
    try {
        return parseContentReviewProposal(value)
    } catch {
        return null
    }
}

type ReviewDecisionRow = {
    id: number
    decision: string
    import_payload: unknown
    updated_at: Date
}

async function readAllReviewDecisions(): Promise<ReviewDecisionRow[]> {
    return readAllContentReviewPages(cursor => prisma.crawl_import_decisions.findMany({
        where: {
            crawl_product_snapshots: { source: CONTENT_REVIEW_SOURCE },
        },
        select: {
            id: true,
            decision: true,
            import_payload: true,
            updated_at: true,
        },
        orderBy: { id: 'asc' },
        ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
        take: CONTENT_REVIEW_READ_BATCH_SIZE,
    }))
}

export async function getContentReviewQueue(filters?: {
    state?: ReviewState
    search?: string
    page?: number
    pageSize?: number
}): Promise<SerializedReviewQueuePage> {
    await requirePermission('products:read')
    const decisions = await readAllReviewDecisions()

    const proposals = decisions
        .map(decision => ({ decision, proposal: proposalOrNull(decision.import_payload) }))
        .filter((item): item is typeof item & { proposal: NonNullable<typeof item.proposal> } => Boolean(item.proposal))
    const impactedProducts = new Map<string, Set<number>>()
    for (const { proposal } of proposals) {
        for (const image of proposal.after.images) {
            const impacted = impactedProducts.get(image.fingerprint) || new Set<number>()
            impacted.add(proposal.product.id)
            impactedProducts.set(image.fingerprint, impacted)
        }
    }

    const normalizedSearch = filters?.search?.trim().toLowerCase()
    const allItems = proposals
        .filter(({ decision, proposal }) => {
            if (filters?.state && decision.decision !== filters.state) return false
            if (!normalizedSearch) return true
            return `${proposal.product.sku} ${proposal.product.name}`.toLowerCase().includes(normalizedSearch)
        })
        .map(({ decision, proposal }) => ({
            id: decision.id,
            productId: proposal.product.id,
            sku: proposal.product.sku,
            name: proposal.product.name,
            state: decision.decision as ReviewState,
            version: proposal.version,
            proposalHash: proposal.proposalHash,
            totalImages: proposal.after.images.length,
            pendingImages: proposal.after.images.filter(image => image.decision === 'HUMAN_REVIEW').length,
            duplicateProducts: new Set(
                proposal.after.images.flatMap(image => [...(impactedProducts.get(image.fingerprint) || [])]),
            ).size,
            paused: proposal.workflow.paused,
            updatedAt: decision.updated_at.toISOString(),
        }))
    const pageSize = Math.min(100, Math.max(1, Math.floor(filters?.pageSize || 50)))
    const total = allItems.length
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const page = Math.min(totalPages, Math.max(1, Math.floor(filters?.page || 1)))
    const start = (page - 1) * pageSize
    return {
        items: allItems.slice(start, start + pageSize),
        total,
        page,
        pageSize,
        totalPages,
    }
}

export async function getContentReviewDetail(decisionId: number): Promise<SerializedReviewDetail | null> {
    await requirePermission('products:read')
    const [decision, allPayloads] = await Promise.all([
        prisma.crawl_import_decisions.findFirst({
            where: {
                id: decisionId,
                crawl_product_snapshots: { source: CONTENT_REVIEW_SOURCE },
            },
            select: {
                id: true,
                decision: true,
                reason: true,
                reviewer_id: true,
                reviewed_at: true,
                updated_at: true,
                import_payload: true,
            },
        }),
        readAllReviewDecisions(),
    ])
    if (!decision) return null
    const proposal = proposalOrNull(decision.import_payload)
    if (!proposal) return null

    const targetFingerprints = new Set(proposal.after.images.map(image => image.fingerprint))
    const duplicateProductIdsByFingerprint: Record<string, number[]> = {}
    for (const fingerprint of targetFingerprints) duplicateProductIdsByFingerprint[fingerprint] = []
    for (const item of allPayloads) {
        const other = proposalOrNull(item.import_payload)
        if (!other) continue
        for (const fingerprint of new Set(other.after.images.map(image => image.fingerprint))) {
            if (!targetFingerprints.has(fingerprint)) continue
            duplicateProductIdsByFingerprint[fingerprint].push(other.product.id)
        }
    }

    return {
        decisionId: decision.id,
        state: decision.decision as ReviewState,
        reason: decision.reason,
        reviewerId: decision.reviewer_id,
        reviewedAt: decision.reviewed_at?.toISOString() || null,
        updatedAt: decision.updated_at.toISOString(),
        duplicateProductIdsByFingerprint,
        previewHtml: maskRemoteImagesForPreview(proposal.after.descriptionHtml),
        proposal,
    }
}
