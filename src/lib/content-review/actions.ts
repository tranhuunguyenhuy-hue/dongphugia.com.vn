'use server'

import type { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth/get-current-user'
import prisma from '@/lib/prisma'
import { cleanupProductHtml, extractEmbeddedImageUrls } from './cleanup'
import { createReviewImage, dedupeReviewImages, normalizeImageUrl, validateImageDecision } from './images'
import { parseContentReviewProposal, rehashProposal } from './proposal'
import { nextReviewState } from './state-machine'
import { CONTENT_REVIEW_SOURCE, type ReviewImageDecision, type ReviewState, type ReviewTransition } from './types'

export type ContentReviewActionResult = { success: true } | { success: false; error: string }

function requireReason(value: string): string {
    const reason = value.trim()
    if (reason.length < 3) throw new Error('Reason is required for the audit trail')
    if (reason.length > 200) throw new Error('Reason must be 200 characters or fewer')
    return reason
}

type ReviewTransaction = {
    crawl_import_decisions: Pick<typeof prisma.crawl_import_decisions, 'findFirst'>
}

async function loadReviewDecision(transaction: ReviewTransaction, decisionId: number) {
    const record = await transaction.crawl_import_decisions.findFirst({
        where: {
            id: decisionId,
            crawl_product_snapshots: { source: CONTENT_REVIEW_SOURCE },
        },
        select: {
            id: true,
            decision: true,
            import_payload: true,
        },
    })
    if (!record) throw new Error('Review proposal not found')
    return { record, proposal: parseContentReviewProposal(record.import_payload) }
}

function revalidateReview(decisionId: number) {
    revalidatePath('/admin/products/content-review')
    revalidatePath(`/admin/products/content-review/${decisionId}`)
}

export async function saveProposalDescription(
    decisionId: number,
    descriptionHtml: string,
    reasonValue: string,
): Promise<ContentReviewActionResult> {
    try {
        const actor = await requireRole('admin')
        const reason = requireReason(reasonValue)
        await prisma.$transaction(async transaction => {
            const { proposal } = await loadReviewDecision(transaction, decisionId)
            const previousHash = proposal.proposalHash
            const cleanedHtml = cleanupProductHtml(descriptionHtml)
            const preserved = proposal.after.images.filter(image => image.kind !== 'embedded')
            const existingEmbedded = new Map(
                proposal.after.images
                    .filter(image => image.kind === 'embedded')
                    .map(image => [image.fingerprint, image]),
            )
            const embedded = extractEmbeddedImageUrls(cleanedHtml).map(url => {
                const candidate = createReviewImage('embedded', url)
                return existingEmbedded.get(candidate.fingerprint) || candidate
            })
            const updated = rehashProposal({
                ...proposal,
                version: proposal.version + 1,
                workflow: { paused: false },
                after: {
                    descriptionHtml: cleanedHtml,
                    images: dedupeReviewImages([...preserved, ...embedded]),
                },
            })
            await transaction.crawl_import_decisions.update({
                where: { id: decisionId },
                data: {
                    decision: 'needs_review',
                    reason,
                    reviewer_id: null,
                    reviewed_at: null,
                    import_payload: updated as unknown as Prisma.InputJsonValue,
                    updated_at: new Date(),
                },
            })
            await transaction.audit_logs.create({
                data: {
                    user_id: actor.id,
                    action: 'CONTENT_REVIEW_EDIT_DESCRIPTION',
                    entity_type: 'crawl_import_decisions',
                    entity_id: decisionId,
                    old_value: { source: CONTENT_REVIEW_SOURCE, proposal_version: proposal.version, proposal_hash: previousHash },
                    new_value: { source: CONTENT_REVIEW_SOURCE, reason, proposal_version: updated.version, proposal_hash: updated.proposalHash },
                },
            })
        })
        revalidateReview(decisionId)
        return { success: true }
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unable to edit proposal' }
    }
}

export async function setProposalImageDecision(
    decisionId: number,
    fingerprint: string,
    decision: ReviewImageDecision,
    reasonValue: string,
    replacementValue?: string,
): Promise<ContentReviewActionResult> {
    try {
        const actor = await requireRole('admin')
        const reason = requireReason(reasonValue)
        await prisma.$transaction(async transaction => {
            const replacementUrl = replacementValue ? normalizeImageUrl(replacementValue) : undefined
            const candidates = await transaction.crawl_import_decisions.findMany({
                where: { crawl_product_snapshots: { source: CONTENT_REVIEW_SOURCE } },
                select: { id: true, import_payload: true },
                take: 500,
            })
            const impacted = candidates.flatMap(candidate => {
                try {
                    const proposal = parseContentReviewProposal(candidate.import_payload)
                    return proposal.after.images.some(image => image.fingerprint === fingerprint)
                        ? [{ candidate, proposal }]
                        : []
                } catch {
                    return []
                }
            })
            if (!impacted.some(item => item.candidate.id === decisionId)) throw new Error('Review image not found')
            const impactedProductIds = impacted.map(item => item.proposal.product.id)

            for (const { candidate, proposal } of impacted) {
                const images = proposal.after.images.filter(image => image.fingerprint === fingerprint)
                images.forEach(image => validateImageDecision(image, decision, replacementUrl))
                const updated = rehashProposal({
                    ...proposal,
                    version: proposal.version + 1,
                    workflow: { paused: false },
                    after: {
                        ...proposal.after,
                        images: proposal.after.images.map(image => {
                            if (image.fingerprint !== fingerprint) return image
                            if (decision === 'REPLACE' && replacementUrl) {
                                return { ...image, decision, replacementUrl }
                            }
                            const { replacementUrl: _removedReplacement, ...withoutReplacement } = image
                            return { ...withoutReplacement, decision }
                        }),
                    },
                })
                await transaction.crawl_import_decisions.update({
                    where: { id: candidate.id },
                    data: {
                        decision: 'needs_review',
                        reason,
                        reviewer_id: null,
                        reviewed_at: null,
                        import_payload: updated as unknown as Prisma.InputJsonValue,
                        updated_at: new Date(),
                    },
                })
                await transaction.audit_logs.create({
                    data: {
                        user_id: actor.id,
                        action: 'CONTENT_REVIEW_EDIT_IMAGE_SHARED_HASH',
                        entity_type: 'crawl_import_decisions',
                        entity_id: candidate.id,
                        old_value: { source: CONTENT_REVIEW_SOURCE, proposal_version: proposal.version, proposal_hash: proposal.proposalHash },
                        new_value: {
                            source: CONTENT_REVIEW_SOURCE,
                            reason,
                            image_fingerprint: fingerprint,
                            image_decision: decision,
                            impacted_product_ids: impactedProductIds,
                            proposal_version: updated.version,
                            proposal_hash: updated.proposalHash,
                        },
                    },
                })
            }
        })
        revalidateReview(decisionId)
        return { success: true }
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unable to decide image' }
    }
}

export async function transitionContentReview(
    decisionId: number,
    transition: ReviewTransition,
    reasonValue: string,
): Promise<ContentReviewActionResult> {
    try {
        const actor = await requireRole('admin')
        const reason = requireReason(reasonValue)
        await prisma.$transaction(async transaction => {
            const { record, proposal } = await loadReviewDecision(transaction, decisionId)
            const current = record.decision as ReviewState
            const next = nextReviewState(current, transition, proposal)
            const updated = transition === 'pause'
                ? rehashProposal({
                    ...proposal,
                    version: proposal.version + 1,
                    workflow: { paused: true, pauseReason: reason },
                })
                : proposal.workflow.paused
                    ? rehashProposal({
                        ...proposal,
                        version: proposal.version + 1,
                        workflow: { paused: false },
                    })
                    : proposal
            await transaction.crawl_import_decisions.update({
                where: { id: decisionId },
                data: {
                    decision: next,
                    reason,
                    reviewer_id: actor.id,
                    reviewed_at: new Date(),
                    import_payload: updated as unknown as Prisma.InputJsonValue,
                    updated_at: new Date(),
                },
            })
            await transaction.audit_logs.create({
                data: {
                    user_id: actor.id,
                    action: `CONTENT_REVIEW_${transition.toUpperCase()}`,
                    entity_type: 'crawl_import_decisions',
                    entity_id: decisionId,
                    old_value: { source: CONTENT_REVIEW_SOURCE, state: current, proposal_hash: proposal.proposalHash },
                    new_value: {
                        source: CONTENT_REVIEW_SOURCE,
                        reason,
                        state: next,
                        proposal_version: updated.version,
                        proposal_hash: updated.proposalHash,
                    },
                },
            })
        })
        revalidateReview(decisionId)
        return { success: true }
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unable to transition review' }
    }
}
