import type { ContentReviewProposal, ReviewState, ReviewTransition } from './types'

const TRANSITIONS: Record<ReviewTransition, ReviewState[]> = {
    submit: ['draft', 'needs_review'],
    approve: ['needs_review'],
    block: ['draft', 'needs_review', 'approved'],
    reject: ['draft', 'needs_review', 'approved'],
    pause: ['draft', 'needs_review', 'approved'],
    ready: ['approved'],
}

export function nextReviewState(
    current: ReviewState,
    transition: ReviewTransition,
    proposal: ContentReviewProposal,
): ReviewState {
    if (!TRANSITIONS[transition].includes(current)) {
        throw new Error(`Invalid review transition: ${current} -> ${transition}`)
    }
    if ((transition === 'approve' || transition === 'ready')
        && proposal.after.images.some(image => image.decision === 'HUMAN_REVIEW')) {
        throw new Error('Every image must have a human decision before approval')
    }
    if (transition === 'submit') return 'needs_review'
    if (transition === 'approve') return 'approved'
    if (transition === 'block') return 'blocked'
    if (transition === 'reject') return 'rejected'
    if (transition === 'pause') return 'needs_review'
    return 'ready_to_apply'
}
