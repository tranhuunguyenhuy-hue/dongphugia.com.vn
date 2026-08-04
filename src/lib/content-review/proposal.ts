import { MockContentGenerationAdapter, type ContentGenerationAdapter } from './adapter'
import { cleanupProductHtml, extractEmbeddedImageUrls } from './cleanup'
import { hashObject, sha256 } from './hash'
import { createReviewImage, dedupeReviewImages } from './images'
import {
    CONTENT_REVIEW_CLEANUP_VERSION,
    CONTENT_REVIEW_SCHEMA_VERSION,
    CONTENT_REVIEW_SOURCE,
    type ContentReviewProposal,
    type ProductContentInput,
    type ReviewImage,
} from './types'

function buildImages(input: ProductContentInput): ReviewImage[] {
    return dedupeReviewImages([
        ...(input.imageMainUrl ? [createReviewImage('main', input.imageMainUrl, input.name)] : []),
        ...(input.galleryImages || []).map(image => createReviewImage('gallery', image.url, image.altText)),
        ...extractEmbeddedImageUrls(input.descriptionHtml).map(url => createReviewImage('embedded', url)),
    ])
}

function proposalHashPayload(proposal: Omit<ContentReviewProposal, 'proposalHash'>): unknown {
    return {
        schemaVersion: proposal.schemaVersion,
        source: proposal.source,
        proposalId: proposal.proposalId,
        product: proposal.product,
        version: proposal.version,
        generation: proposal.generation,
        workflow: proposal.workflow,
        after: proposal.after,
    }
}

export function rehashProposal(
    proposal: Omit<ContentReviewProposal, 'proposalHash'> | ContentReviewProposal,
): ContentReviewProposal {
    const withoutHash = { ...proposal } as ContentReviewProposal
    delete (withoutHash as Partial<ContentReviewProposal>).proposalHash
    return {
        ...proposal,
        proposalHash: hashObject(proposalHashPayload(withoutHash)),
    } as ContentReviewProposal
}

export async function generateContentReviewProposal(
    input: ProductContentInput,
    adapter: ContentGenerationAdapter = new MockContentGenerationAdapter(),
): Promise<ContentReviewProposal> {
    const beforeImages = buildImages(input)
    const cleanedHtml = cleanupProductHtml(input.descriptionHtml)
    const generated = await adapter.generate({ sku: input.sku, name: input.name, cleanedHtml })
    const afterImages = dedupeReviewImages([
        ...beforeImages.filter(image => image.kind !== 'embedded'),
        ...extractEmbeddedImageUrls(generated.html).map(url => createReviewImage('embedded', url)),
    ])
    const baseHash = hashObject({
        descriptionHtml: input.descriptionHtml,
        images: beforeImages.map(image => image.normalizedUrl),
    })
    const proposalWithoutHash: Omit<ContentReviewProposal, 'proposalHash'> = {
        schemaVersion: CONTENT_REVIEW_SCHEMA_VERSION,
        source: CONTENT_REVIEW_SOURCE,
        proposalId: sha256(`${CONTENT_REVIEW_SOURCE}:${input.id}:${baseHash}`),
        product: { id: input.id, sku: input.sku, name: input.name },
        version: 1,
        baseHash,
        generation: {
            adapter: generated.adapter,
            mode: generated.mode,
            cleanupVersion: CONTENT_REVIEW_CLEANUP_VERSION,
        },
        workflow: { paused: false },
        before: { descriptionHtml: input.descriptionHtml, images: beforeImages },
        after: { descriptionHtml: generated.html, images: afterImages },
    }
    return rehashProposal(proposalWithoutHash)
}

export function parseContentReviewProposal(value: unknown): ContentReviewProposal {
    if (!value || typeof value !== 'object') throw new Error('Invalid content review proposal')
    const proposal = value as ContentReviewProposal
    if (proposal.source !== CONTENT_REVIEW_SOURCE || proposal.schemaVersion !== CONTENT_REVIEW_SCHEMA_VERSION) {
        throw new Error('Unsupported content review proposal')
    }
    if (!proposal.product || !proposal.after || !Array.isArray(proposal.after.images)) {
        throw new Error('Incomplete content review proposal')
    }
    return proposal
}
