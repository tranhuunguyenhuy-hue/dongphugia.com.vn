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

function createFixturePackage(): PrecomputedProposalPackage {
    const records: PrecomputedProposalRecord[] = LEO_489_PILOT_MANIFEST.map(entry => {
        const brand = BRAND_NAMES[entry.brandSlug]
        const name = `${brand} ${entry.sku} fixture`
        const mediaHost = entry.mediaClass === 'HITA_HOSTED' ? 'https://cdn.hita.com.vn/products/review-fixture' : 'https://cdn.dongphugia.com.vn/products/review-fixture'
        const mainUrl = `${mediaHost}/${entry.id}.jpg`
        const galleryUrl = `${mediaHost}/${entry.id}-gallery.jpg`
        const embeddedUrl = `${mediaHost}/${entry.id}-embedded.jpg`
        const beforeDescriptionHtml = cleanupProductHtml(`<p>${name} được lưu trong dữ liệu sản phẩm.</p><p><img src="${embeddedUrl}" alt="${name}"></p>`)
        const generatedHtml = cleanupProductHtml(`<h2>${name}</h2><p>${name} là sản phẩm ${brand} chính hãng được chuẩn bị để đối chiếu.</p><h3>Thông tin đối chiếu</h3><ul><li><strong>SKU:</strong> ${entry.sku}</li><li><strong>Thương hiệu:</strong> ${brand}</li></ul><figure><img src="${embeddedUrl}" alt="${name} - hình 1"></figure>`)
        const input = {
            id: entry.id,
            sku: entry.sku,
            name,
            sourceUrl: `https://www.dongphugia.vn/products/review-fixture/${entry.id}`,
            descriptionHtml: beforeDescriptionHtml,
            imageMainUrl: mainUrl,
            galleryImages: [{ id: entry.id, url: galleryUrl, altText: name, sortOrder: 1 }],
            brand: { id: entry.id, name: brand, slug: entry.brandSlug },
            category: { id: entry.id, name: 'Thiết bị vệ sinh', slug: 'thiet-bi-ve-sinh' },
            structuredFacts: [{ definitionLabel: 'SKU', valueText: entry.sku }, { definitionLabel: 'Thương hiệu', valueText: brand }],
        }
        const media = [
            { kind: 'main' as const, url: mainUrl, sourceId: 'main' },
            { kind: 'gallery' as const, url: galleryUrl, sourceId: `gallery:${entry.id}` },
            { kind: 'embedded' as const, url: embeddedUrl, sourceId: 'embedded:0' },
        ]
        const requiredFacts = [brand, entry.sku]
        const mediaInventory = media.map(item => ({ kind: item.kind, sourceId: item.sourceId, url: item.url }))
        return {
            manifest: { ...entry },
            input,
            requiredFacts,
            generatedHtml,
            media,
            actualInventory: { mainCount: 1, galleryCount: 1, embeddedCount: 1, totalCount: 3 },
            provenance: {
                source: 'aws_postgresql_read_only',
                inputHash: hashObject(input),
                beforeDescriptionHash: hashObject(beforeDescriptionHtml),
                afterDescriptionHash: hashObject(generatedHtml),
                factsHash: hashObject(requiredFacts),
                sourceRecordHash: hashObject({ ...input, fixture: true }),
                mediaInventoryHash: hashObject(mediaInventory),
            },
        }
    })
    const withoutHash = {
        schemaVersion: PRECOMPUTED_PACKAGE_SCHEMA_VERSION,
        source: PRECOMPUTED_PACKAGE_SOURCE,
        manifestChecksum: LEO_489_PILOT_MANIFEST_CHECKSUM,
        inventoryExportHash: hashObject(records.map(record => record.provenance.sourceRecordHash)),
        manifestEntryHash: pilotManifestEntryHash(),
        policyHash: 'policy-fixture',
        snapshotHash: 'snapshot-fixture',
        sourceCommit: 'commit-fixture',
        records,
    }
    return { ...withoutHash, packageHash: calculatePrecomputedPackageHash(withoutHash) }
}

describe('precomputed LEO-489 proposal ingestion', () => {
    it('validates and generates all 20 proposals without a provider or persistence call', async () => {
        const result = await validateAndGeneratePrecomputedProposals(createFixturePackage())

        expect(result.proposals).toHaveLength(20)
        expect(result.proposals.every(proposal => proposal.generation.mode === 'precomputed')).toBe(true)
        expect(result.proposals.every(proposal => proposal.after.descriptionHtml.includes('chính hãng'))).toBe(true)
        expect(result.proposals.every(proposal => proposal.audit?.diff.changed)).toBe(true)
        expect(result.proposals.every(proposal => proposal.generation.telemetry)).toBe(true)
        expect(result.proposals.every(proposal => proposal.after.images).valueOf()).toBe(true)
    })

    it('fails closed on placeholder media and incomplete actual inventory', async () => {
        const packageValue = createFixturePackage()
        const placeholder = {
            ...packageValue,
            records: packageValue.records.map((record, index) => index === 0
                ? { ...record, media: record.media.map(item => ({ ...item, url: 'https://cdn.dongphugia.com.vn/leo-489-redacted/1.jpg' })) }
                : record),
        }
        await expect(validateAndGeneratePrecomputedProposals({
            ...placeholder,
            packageHash: calculatePrecomputedPackageHash(placeholder),
        })).rejects.toThrow('placeholder URL')

        const incomplete = {
            ...packageValue,
            records: packageValue.records.map((record, index) => index === 0
                ? { ...record, actualInventory: { ...record.actualInventory, galleryCount: 0 } }
                : record),
        }
        await expect(validateAndGeneratePrecomputedProposals({
            ...incomplete,
            packageHash: calculatePrecomputedPackageHash(incomplete),
        })).rejects.toThrow('media inventory counts')
    })

    it('fails closed when the contract checksum or provenance is tampered', async () => {
        const packageValue = createFixturePackage()
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

    it('fails closed when a mechanically checkable structured fact is contradicted', async () => {
        const packageValue = createFixturePackage()
        const tampered = {
            ...packageValue,
            records: packageValue.records.map((record, index) => index === 0
                ? { ...record, generatedHtml: record.generatedHtml.replaceAll(record.input.sku, 'WRONG-SKU') }
                : record),
        }
        await expect(validateAndGeneratePrecomputedProposals({
            ...tampered,
            packageHash: calculatePrecomputedPackageHash(tampered),
        })).rejects.toThrow('missing required fact')
    })
})
