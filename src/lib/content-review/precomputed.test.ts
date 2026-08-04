import { describe, expect, it } from 'vitest'
import { cleanupProductHtml } from './cleanup'
import { hashObject } from './hash'
import {
    calculatePrecomputedPackageHash,
    PRECOMPUTED_PACKAGE_SCHEMA_VERSION,
    PRECOMPUTED_PACKAGE_SOURCE,
    validateAndGeneratePrecomputedProposals,
    type PrecomputedProposalPackage,
    type PrecomputedProposalRecord,
} from './precomputed'
import {
    LEO_489_PILOT_MANIFEST,
    LEO_489_PILOT_MANIFEST_CHECKSUM,
    pilotManifestEntryHash,
} from './pilot-manifest'

const BRAND_NAMES: Record<string, string> = {
    'american-standard': 'American Standard',
    atmor: 'ATMOR',
    caesar: 'Caesar',
    inax: 'INAX',
    moen: 'Moen',
    toto: 'TOTO',
    viglacera: 'Viglacera',
}

function createSyntheticPackage(): PrecomputedProposalPackage {
    const records: PrecomputedProposalRecord[] = LEO_489_PILOT_MANIFEST.map(entry => {
        const brand = BRAND_NAMES[entry.brandSlug]
        const name = `${brand} ${entry.sku}`
        const url = entry.mediaClass === 'HITA_HOSTED'
            ? `https://cdn.hita.com.vn/leo-489-redacted/${entry.id}.jpg`
            : `https://cdn.dongphugia.com.vn/leo-489-redacted/${entry.id}.jpg`
        const isEmbedded = entry.mediaClass === 'EMBEDDED'
        const beforeDescriptionHtml = `<p>${brand} ${entry.sku}.</p>${isEmbedded ? `<p><img src="${url}" alt="${name}"></p>` : ''}`
        const generatedHtml = cleanupProductHtml(`<p>${brand} ${entry.sku} chính hãng.</p>${isEmbedded ? `<p><img src="${url}" alt="${name}"></p>` : ''}`)
        const input = {
            id: entry.id,
            sku: entry.sku,
            name,
            sourceUrl: `offline://leo-489/${entry.id}`,
            descriptionHtml: beforeDescriptionHtml,
            ...(isEmbedded ? {} : { imageMainUrl: url }),
        }
        const requiredFacts = [brand, entry.sku]
        return {
            manifest: { ...entry },
            input,
            requiredFacts,
            generatedHtml,
            media: [{ kind: isEmbedded ? 'embedded' : 'main', url }],
            provenance: {
                source: 'approved_read_only_fact_sheet',
                inputHash: hashObject(input),
                beforeDescriptionHash: hashObject(beforeDescriptionHtml),
                afterDescriptionHash: hashObject(generatedHtml),
                factsHash: hashObject(requiredFacts),
            },
        }
    })
    const withoutHash = {
        schemaVersion: PRECOMPUTED_PACKAGE_SCHEMA_VERSION,
        source: PRECOMPUTED_PACKAGE_SOURCE,
        manifestChecksum: LEO_489_PILOT_MANIFEST_CHECKSUM,
        manifestEntryHash: pilotManifestEntryHash(),
        records,
    }
    return { ...withoutHash, packageHash: calculatePrecomputedPackageHash(withoutHash) }
}

describe('precomputed LEO-489 proposal ingestion', () => {
    it('validates and generates all 20 proposals without a provider or persistence call', async () => {
        const result = await validateAndGeneratePrecomputedProposals(createSyntheticPackage())

        expect(result.proposals).toHaveLength(20)
        expect(result.proposals.every(proposal => proposal.generation.mode === 'precomputed')).toBe(true)
        expect(result.proposals.every(proposal => proposal.after.descriptionHtml.includes('chính hãng'))).toBe(true)
        expect(result.proposals.every(proposal => proposal.audit?.diff.changed)).toBe(true)
        expect(result.proposals.every(proposal => proposal.generation.telemetry)).toBe(true)
        expect(result.proposals.filter(proposal => proposal.after.images.some(image => image.policy === 'HITA_HOSTED_REVIEW'))).toHaveLength(4)
        expect(result.proposals.filter(proposal => proposal.after.images.some(image => image.policy === 'KEEP_EXISTING_BUNNY'))).toHaveLength(16)
    })

    it('fails closed when the contract checksum or provenance is tampered', async () => {
        const packageValue = createSyntheticPackage()
        await expect(validateAndGeneratePrecomputedProposals({
            ...packageValue,
            manifestChecksum: 'wrong',
        })).rejects.toThrow('Unsupported precomputed proposal package')

        const tampered = {
            ...packageValue,
            records: packageValue.records.map((record, index) => index === 0
                ? { ...record, provenance: { ...record.provenance, afterDescriptionHash: 'wrong' } }
                : record),
        }
        await expect(validateAndGeneratePrecomputedProposals({
            ...tampered,
            packageHash: calculatePrecomputedPackageHash(tampered),
        })).rejects.toThrow('Before/after provenance mismatch')
    })
})
