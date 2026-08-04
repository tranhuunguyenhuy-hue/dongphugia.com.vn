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

function estimateTokens(value: string): number {
    return Math.ceil([...value].length / 4)
}

function deterministicDiff(before: string, after: string) {
    let prefix = 0
    while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix += 1
    let suffix = 0
    while (
        suffix < before.length - prefix
        && suffix < after.length - prefix
        && before[before.length - suffix - 1] === after[after.length - suffix - 1]
    ) suffix += 1
    return {
        algorithm: 'deterministic_char_window_v1' as const,
        changed: before !== after,
        addedCharacters: after.length - prefix - suffix,
        removedCharacters: before.length - prefix - suffix,
        commonPrefixCharacters: prefix,
        commonSuffixCharacters: suffix,
    }
}

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
    const generated = await adapter.generate({ id: input.id, sku: input.sku, name: input.name, cleanedHtml })
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
            ...(generated.provenance ? { provenance: generated.provenance } : {}),
            telemetry: {
                beforeCharacters: [...input.descriptionHtml].length,
                afterCharacters: [...generated.html].length,
                beforeTokenEstimate: estimateTokens(input.descriptionHtml),
                afterTokenEstimate: estimateTokens(generated.html),
                characterDelta: [...generated.html].length - [...input.descriptionHtml].length,
                tokenEstimateDelta: estimateTokens(generated.html) - estimateTokens(input.descriptionHtml),
            },
        },
        workflow: { paused: false },
        before: { descriptionHtml: input.descriptionHtml, images: beforeImages },
        after: { descriptionHtml: generated.html, images: afterImages },
        audit: {
            beforeDescriptionHash: hashObject(input.descriptionHtml),
            afterDescriptionHash: hashObject(generated.html),
            diff: deterministicDiff(input.descriptionHtml, generated.html),
        },
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
