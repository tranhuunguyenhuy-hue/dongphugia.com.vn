import { requirePermission } from '@/lib/auth/get-current-user'
import prisma from '@/lib/prisma'
import { maskRemoteImagesForPreview } from './cleanup'
import { parseContentReviewProposal } from './proposal'
import { CONTENT_REVIEW_SOURCE, type ReviewState, type SerializedReviewDetail, type SerializedReviewQueueItem } from './types'

function proposalOrNull(value: unknown) {
    try {
        return parseContentReviewProposal(value)
    } catch {
        return null
    }
}

export async function getContentReviewQueue(filters?: {
    state?: ReviewState
    search?: string
}): Promise<SerializedReviewQueueItem[]> {
    await requirePermission('products:read')
    const decisions = await prisma.crawl_import_decisions.findMany({
        where: {
            crawl_product_snapshots: { source: CONTENT_REVIEW_SOURCE },
        },
        select: {
            id: true,
            decision: true,
            import_payload: true,
            updated_at: true,
        },
        orderBy: { updated_at: 'desc' },
        take: 250,
    })

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
    return proposals
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
        prisma.crawl_import_decisions.findMany({
            where: { crawl_product_snapshots: { source: CONTENT_REVIEW_SOURCE } },
            select: { import_payload: true },
            take: 500,
        }),
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
