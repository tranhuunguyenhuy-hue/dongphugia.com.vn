import type { ContentGenerationAdapter, ContentGenerationInput, ContentGenerationOutput } from './adapter'
import { cleanupProductHtml, extractEmbeddedImageUrls } from './cleanup'
import { createReviewImage, dedupeReviewImages, isBunnyAsset, isHitaHostedAsset } from './images'
import { hashObject } from './hash'
import {
    LEO_489_PILOT_MANIFEST,
    LEO_489_PILOT_MANIFEST_CHECKSUM,
    type PilotManifestEntry,
    validatePilotManifest,
    pilotManifestEntryHash,
} from './pilot-manifest'
import { generateContentReviewProposal } from './proposal'
import type { ContentReviewProposal, ProductContentInput } from './types'

export const PRECOMPUTED_PACKAGE_SCHEMA_VERSION = 1 as const
export const PRECOMPUTED_PACKAGE_SOURCE = 'hita_cleanup_v1' as const

export interface PrecomputedMediaInput {
    kind: 'main' | 'gallery' | 'embedded'
    url: string
}

export interface PrecomputedProposalRecord {
    manifest: PilotManifestEntry
    input: ProductContentInput
    requiredFacts: string[]
    generatedHtml: string
    media: PrecomputedMediaInput[]
    provenance: {
        source: 'approved_read_only_fact_sheet'
        inputHash: string
        beforeDescriptionHash: string
        afterDescriptionHash: string
        factsHash: string
    }
}

export interface PrecomputedProposalPackage {
    schemaVersion: typeof PRECOMPUTED_PACKAGE_SCHEMA_VERSION
    source: typeof PRECOMPUTED_PACKAGE_SOURCE
    manifestChecksum: typeof LEO_489_PILOT_MANIFEST_CHECKSUM
    manifestEntryHash: string
    records: PrecomputedProposalRecord[]
    packageHash: string
}

export interface PrecomputedValidationResult {
    packageHash: string
    manifestEntryHash: string
    proposals: ContentReviewProposal[]
}

function packageHashPayload(value: Omit<PrecomputedProposalPackage, 'packageHash'>): unknown {
    return {
        schemaVersion: value.schemaVersion,
        source: value.source,
        manifestChecksum: value.manifestChecksum,
        manifestEntryHash: value.manifestEntryHash,
        records: value.records,
    }
}

export function calculatePrecomputedPackageHash(value: Omit<PrecomputedProposalPackage, 'packageHash'>): string {
    return hashObject(packageHashPayload(value))
}

function assertSafeGeneratedHtml(html: string, requiredFacts: string[]): void {
    if (!html || cleanupProductHtml(html) !== html) {
        throw new Error('Precomputed after HTML must already be deterministic sanitized HTML')
    }
    if (/<\/?(script|iframe|object|embed|form)\b|\bon[a-z]+\s*=|javascript\s*:/i.test(html)) {
        throw new Error('Precomputed after HTML contains executable or blocked markup')
    }
    if (/hita/i.test(html)) throw new Error('Precomputed after HTML contains Hita branding or a Hita URL')
    const lowerHtml = html.toLocaleLowerCase()
    for (const fact of requiredFacts) {
        if (!fact.trim() || !lowerHtml.includes(fact.toLocaleLowerCase())) {
            throw new Error(`Precomputed after HTML is missing required fact: ${fact}`)
        }
    }
    if (!lowerHtml.includes('chính hãng')) throw new Error('Precomputed after HTML must include “chính hãng”')
}

function assertMediaInput(media: PrecomputedMediaInput[]): void {
    const seen = new Set<string>()
    for (const item of media) {
        if (seen.has(`${item.kind}:${item.url}`)) throw new Error('Precomputed media contains a duplicate')
        seen.add(`${item.kind}:${item.url}`)
        const validHost = isBunnyAsset(item.url) || isHitaHostedAsset(item.url)
        if (!validHost) throw new Error('Precomputed media must be an existing Bunny or Hita-hosted URL')
    }
}

function expectedMediaDecision(media: PrecomputedMediaInput) {
    const image = createReviewImage(media.kind, media.url)
    return { policy: image.policy, decision: image.decision }
}

function validateRecord(record: PrecomputedProposalRecord, manifest: PilotManifestEntry): void {
    if (JSON.stringify(record.manifest) !== JSON.stringify(manifest)) {
        throw new Error(`Precomputed record identity does not match manifest for product ${manifest.id}`)
    }
    if (record.input.id !== manifest.id || record.input.sku !== manifest.sku) {
        throw new Error(`Precomputed input identity does not match manifest for product ${manifest.id}`)
    }
    if (!record.input.name || !record.input.sourceUrl) throw new Error(`Missing input identity for product ${manifest.id}`)
    if (!record.requiredFacts.includes(record.input.sku)) throw new Error(`SKU fact is not declared for product ${manifest.id}`)
    assertSafeGeneratedHtml(record.generatedHtml, record.requiredFacts)
    assertMediaInput(record.media)
    const imageInput = dedupeReviewImages([
        ...(record.input.imageMainUrl ? [createReviewImage('main', record.input.imageMainUrl)] : []),
        ...(record.input.galleryImages || []).map(image => createReviewImage('gallery', image.url, image.altText)),
        ...extractEmbeddedImageUrls(record.input.descriptionHtml).map(url => createReviewImage('embedded', url)),
    ])
    const inputHash = hashObject(record.input)
    const beforeDescriptionHash = hashObject(record.input.descriptionHtml)
    const afterDescriptionHash = hashObject(record.generatedHtml)
    const factsHash = hashObject(record.requiredFacts)
    if (record.provenance.source !== 'approved_read_only_fact_sheet'
        || record.provenance.inputHash !== inputHash
        || record.provenance.beforeDescriptionHash !== beforeDescriptionHash
        || record.provenance.afterDescriptionHash !== afterDescriptionHash
        || record.provenance.factsHash !== factsHash) {
        throw new Error(`Before/after provenance mismatch for product ${manifest.id}`)
    }
    for (const media of record.media) {
        const decision = expectedMediaDecision(media)
        if (decision.policy === 'HITA_HOSTED_REVIEW' && decision.decision !== 'HUMAN_REVIEW') {
            throw new Error(`Hita-hosted media must remain HUMAN_REVIEW for product ${manifest.id}`)
        }
        if (decision.policy === 'KEEP_EXISTING_BUNNY' && decision.decision !== 'KEEP') {
            throw new Error(`Existing Bunny media must remain KEEP for product ${manifest.id}`)
        }
    }
    if (record.manifest.mediaClass === 'HITA_HOSTED'
        && !record.media.some(media => isHitaHostedAsset(media.url))) {
        throw new Error(`HITA_HOSTED manifest entry is missing Hita-hosted media evidence for product ${manifest.id}`)
    }
    const inputMediaUrls = new Set(imageInput.map(image => image.normalizedUrl))
    const recordMediaUrls = new Set(record.media.map(media => createReviewImage(media.kind, media.url).normalizedUrl))
    if (inputMediaUrls.size !== recordMediaUrls.size || [...inputMediaUrls].some(url => !recordMediaUrls.has(url))) {
        throw new Error(`Media provenance does not match the read-only input for product ${manifest.id}`)
    }
    if (imageInput.some(image => image.policy === 'HITA_HOSTED_REVIEW' && image.decision !== 'HUMAN_REVIEW')) {
        throw new Error(`Hita-hosted input media must remain HUMAN_REVIEW for product ${manifest.id}`)
    }
}

export function validatePrecomputedPackage(value: unknown): PrecomputedProposalPackage {
    if (!value || typeof value !== 'object') throw new Error('Invalid precomputed proposal package')
    const packageValue = value as PrecomputedProposalPackage
    if (packageValue.schemaVersion !== PRECOMPUTED_PACKAGE_SCHEMA_VERSION
        || packageValue.source !== PRECOMPUTED_PACKAGE_SOURCE
        || packageValue.manifestChecksum !== LEO_489_PILOT_MANIFEST_CHECKSUM) {
        throw new Error('Unsupported precomputed proposal package')
    }
    validatePilotManifest(packageValue.records?.map(record => record.manifest))
    if (packageValue.manifestEntryHash !== pilotManifestEntryHash()) {
        throw new Error('Precomputed package manifest entry hash mismatch')
    }
    const byId = new Map(packageValue.records.map(record => [record.manifest.id, record]))
    if (byId.size !== LEO_489_PILOT_MANIFEST.length) throw new Error('Precomputed package must contain exactly 20 unique records')
    for (const manifest of LEO_489_PILOT_MANIFEST) {
        const record = byId.get(manifest.id)
        if (!record) throw new Error(`Precomputed package is missing product ${manifest.id}`)
        validateRecord(record, manifest)
    }
    const expectedHash = calculatePrecomputedPackageHash(packageValue)
    if (packageValue.packageHash !== expectedHash) throw new Error('Precomputed package hash mismatch')
    return packageValue
}

export class PrecomputedContentGenerationAdapter implements ContentGenerationAdapter {
    readonly name = 'precomputed_offline_v1'
    private readonly recordsByIdentity: Map<string, PrecomputedProposalRecord>

    constructor(records: readonly PrecomputedProposalRecord[]) {
        this.recordsByIdentity = new Map(records.map(record => [`${record.input.id}:${record.input.sku}`, record]))
    }

    async generate(input: ContentGenerationInput): Promise<ContentGenerationOutput> {
        const record = input.id === undefined
            ? undefined
            : this.recordsByIdentity.get(`${input.id}:${input.sku}`)
        if (!record) throw new Error(`No precomputed proposal for ${input.sku}`)
        if (cleanupProductHtml(input.cleanedHtml) !== input.cleanedHtml) {
            throw new Error(`Input cleanup is not deterministic for ${input.sku}`)
        }
        return {
            html: record.generatedHtml,
            adapter: this.name,
            mode: 'precomputed',
            provenance: {
                source: record.provenance.source,
                beforeHash: record.provenance.beforeDescriptionHash,
                afterHash: record.provenance.afterDescriptionHash,
                factsHash: record.provenance.factsHash,
                manifestChecksum: LEO_489_PILOT_MANIFEST_CHECKSUM,
            },
        }
    }
}

export async function validateAndGeneratePrecomputedProposals(value: unknown): Promise<PrecomputedValidationResult> {
    const packageValue = validatePrecomputedPackage(value)
    const adapter = new PrecomputedContentGenerationAdapter(packageValue.records)
    const proposals = await Promise.all(packageValue.records.map(record => generateContentReviewProposal(record.input, adapter)))
    for (const [index, proposal] of proposals.entries()) {
        const record = packageValue.records[index]
        if (proposal.product.id !== record.manifest.id
            || proposal.product.sku !== record.manifest.sku
            || proposal.generation.mode !== 'precomputed'
            || proposal.generation.provenance?.beforeHash !== record.provenance.beforeDescriptionHash
            || proposal.generation.provenance?.afterHash !== record.provenance.afterDescriptionHash) {
            throw new Error(`Generated proposal identity/provenance mismatch for product ${record.manifest.id}`)
        }
        assertSafeGeneratedHtml(proposal.after.descriptionHtml, record.requiredFacts)
        for (const image of proposal.after.images) {
            if (image.policy === 'HITA_HOSTED_REVIEW' && image.decision !== 'HUMAN_REVIEW') {
                throw new Error(`Generated Hita-hosted media is not gated for product ${record.manifest.id}`)
            }
            if (image.policy === 'KEEP_EXISTING_BUNNY' && image.decision !== 'KEEP') {
                throw new Error(`Generated Bunny media is not kept for product ${record.manifest.id}`)
            }
        }
    }
    return {
        packageHash: packageValue.packageHash,
        manifestEntryHash: packageValue.manifestEntryHash,
        proposals,
    }
}
