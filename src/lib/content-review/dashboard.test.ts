import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { createDashboardModel, buildDeterministicReviewExport, renderDashboardHtml, sanitizeHtmlForDashboard } from './dashboard'
import { hashObject } from './hash'
import { LEO_489_PILOT_MANIFEST, LEO_489_PILOT_MANIFEST_CHECKSUM, pilotManifestEntryHash } from './pilot-manifest'
import type { PrecomputedProposalPackage } from './precomputed'
import type { ContentReviewProposal } from './types'
import type { DashboardModel } from './dashboard'

function committedModel(): DashboardModel {
    const html = fs.readFileSync(path.join(process.cwd(), 'docs/review-bundles/leo-489-pilot-dashboard.html'), 'utf8')
    const match = html.match(/const MODEL = (\{[\s\S]*?\});\nconst STORAGE_KEY/)
    if (!match) throw new Error('Committed dashboard model is missing')
    return JSON.parse(match[1]) as DashboardModel
}

function bundleClassifications(): Array<{ sku: string; sourceId: string; classification: Record<string, unknown> }> {
    const bundle = fs.readFileSync(path.join(process.cwd(), 'docs/review-bundles/leo-489-pilot-review.md'), 'utf8')
    return bundle.split(/^## /m).slice(1).flatMap(section => {
        const sku = section.match(/- SKU: `([^`]+)`/)?.[1]
        const block = section.match(/- Exact image decisions:\n```text\n([\s\S]*?)\n```/)?.[1]
        if (!sku || !block) throw new Error(`Bundle classification block missing for ${sku || 'unknown'}`)
        return block.split('\n').filter(Boolean).map(line => {
            const prefix = line.split(' — classification ')[0]
            const classificationText = line.split(' — classification ')[1]
            const sourceId = prefix.match(/^(.+): (?:main|gallery|embedded) —/)?.[1]
            if (!sourceId || !classificationText) throw new Error(`Malformed bundle classification line: ${line}`)
            return { sku, sourceId, classification: JSON.parse(classificationText) as Record<string, unknown> }
        })
    })
}

function actionCounts(values: Array<{ action: string }>): Record<string, number> {
    const counts: Record<string, number> = {
        KEEP_VERIFIED: 0,
        REMOVE_CONFIRMED_HITA: 0,
        REMOVE_UNVERIFIED_THIRD_PARTY: 0,
        REPLACE_WITH_OFFICIAL: 0,
        HUMAN_REVIEW: 0,
    }
    for (const value of values) counts[value.action] = (counts[value.action] || 0) + 1
    return counts
}

function fixturePackage(): { packageValue: PrecomputedProposalPackage; proposals: ContentReviewProposal[] } {
    const records = LEO_489_PILOT_MANIFEST.map((entry) => {
        const host = entry.mediaClass === 'HITA_HOSTED' ? 'https://cdn.hita.com.vn/review' : 'https://cdn.dongphugia.com.vn/review'
        const mainUrl = `${host}/${entry.id}.jpg`
        const input = {
            id: entry.id,
            sku: entry.sku,
            name: `Product ${entry.sku}`,
            sourceUrl: `https://www.dongphugia.vn/p/${entry.id}`,
            descriptionHtml: `<p>Before ${entry.sku}</p><p><img src="${mainUrl}" alt="${entry.sku}"></p>`,
            imageMainUrl: mainUrl,
            galleryImages: [],
            brand: { id: entry.id, name: entry.brandSlug, slug: entry.brandSlug },
            category: { id: entry.id, name: 'Category', slug: 'category' },
            structuredFacts: [{ definitionLabel: 'SKU', valueText: entry.sku }],
        }
        const generatedHtml = `<h2>${entry.sku}</h2><p>${entry.sku} chính hãng</p>`
        const media = [{ kind: 'main' as const, url: mainUrl, sourceId: 'main' }]
        const provenance = {
            source: 'aws_postgresql_read_only' as const,
            inputHash: hashObject(input),
            beforeDescriptionHash: hashObject(input.descriptionHtml),
            afterDescriptionHash: hashObject(generatedHtml),
            factsHash: hashObject([entry.sku]),
            sourceRecordHash: hashObject(input),
            mediaInventoryHash: hashObject(media),
        }
        return { manifest: entry, input, requiredFacts: [entry.sku], generatedHtml, media, actualInventory: { mainCount: 1, galleryCount: 0, embeddedCount: 1, totalCount: 1 }, provenance }
    })
    const withoutHash = { schemaVersion: 1 as const, source: 'hita_cleanup_v1' as const, manifestChecksum: LEO_489_PILOT_MANIFEST_CHECKSUM, inventoryExportHash: hashObject(records), manifestEntryHash: pilotManifestEntryHash(), records }
    const packageValue = { ...withoutHash, packageHash: hashObject(withoutHash) } as PrecomputedProposalPackage
    const proposals = records.map((record) => ({
        schemaVersion: 1 as const, source: 'hita_cleanup_v1' as const, proposalId: String(record.input.id), product: { id: record.input.id, sku: record.input.sku, name: record.input.name }, version: 1, baseHash: 'base', proposalHash: 'proposal', generation: { adapter: 'test', mode: 'precomputed' as const, cleanupVersion: 'deterministic_html_v1' as const }, workflow: { paused: false }, before: { descriptionHtml: record.input.descriptionHtml, images: [] }, after: { descriptionHtml: record.generatedHtml, images: [] }, audit: { beforeDescriptionHash: record.provenance.beforeDescriptionHash, afterDescriptionHash: record.provenance.afterDescriptionHash, diff: { algorithm: 'deterministic_char_window_v1' as const, changed: true, addedCharacters: 10, removedCharacters: 4, commonPrefixCharacters: 2, commonSuffixCharacters: 3 } },
    })) as ContentReviewProposal[]
    return { packageValue, proposals }
}

describe('LEO-489 offline dashboard', () => {
    it('covers exactly the approved 20 products and keeps the dashboard deterministic', () => {
        const { packageValue, proposals } = fixturePackage()
        const model = createDashboardModel(packageValue, proposals, 'public')
        expect(model.products).toHaveLength(20)
        expect(model.products.map((product) => product.id)).toEqual(LEO_489_PILOT_MANIFEST.map((entry) => entry.id).sort((a, b) => a - b))
        const first = renderDashboardHtml(model, 'public')
        expect(first).toBe(renderDashboardHtml(model, 'public'))
        expect(first).not.toContain('cdn.hita.com.vn')
        expect(first).not.toContain('cdn.dongphugia.com.vn')
    })

    it('sanitizes executable markup and removes automatic media sources in the PR artifact', () => {
        const { packageValue, proposals } = fixturePackage()
        const model = createDashboardModel(packageValue, proposals, 'public')
        const html = renderDashboardHtml(model, 'public')
        expect(sanitizeHtmlForDashboard('<script>alert(1)</script><img src="https://cdn.hita.com.vn/a.jpg" onerror="bad()">', model.products[0].media, 'public')).not.toMatch(/script|onerror|src=/i)
        expect(html).not.toMatch(/<img[^>]+src=/i)
        expect(html).not.toMatch(/fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|\/api\/|prisma|DATABASE_URL/i)
    })

    it('keeps the committed artifact sanitized and free of raw input payload fields', () => {
        const artifact = fs.readFileSync(path.join(process.cwd(), 'docs/review-bundles/leo-489-pilot-dashboard.html'), 'utf8')
        expect(artifact).toContain('LEO-489 Pilot Review Dashboard')
        expect(artifact).not.toMatch(/https?:\/\/[^\s"'<>]+/i)
        expect(artifact).not.toMatch(/cdn\.hita\.com\.vn|cdn\.dongphugia\.com\.vn|www\.dongphugia\.vn/i)
        expect(artifact).not.toMatch(/DATABASE_URL|DIRECT_URL|BUNNY_STORAGE_API_KEY|structuredFacts|imageMainUrl|galleryImages|sourceUrl|rawValue/i)
        expect(artifact).not.toMatch(/<script\b[^>]*src=|<img\b[^>]*src=/i)
    })

    it('keeps exact 160-reference classification coverage and the golden case out of all-Bunny-KEEP state', () => {
        const bundle = fs.readFileSync(path.join(process.cwd(), 'docs/review-bundles/leo-489-pilot-review.md'), 'utf8')
        const classified = bundle.match(/— proposed [A-Z_]+ — origin [A-Z_]+ — confidence (?:HIGH|MEDIUM|LOW) — cluster [^—]+ — official (?:VERIFIED|NOT_VERIFIED|NOT_APPLICABLE) — duplicate [a-f0-9]{64} —/g) || []
        expect(classified).toHaveLength(160)
        const golden = bundle.slice(bundle.indexOf('## 14.'), bundle.indexOf('## 15.'))
        const goldenEntries = bundleClassifications().filter(entry => entry.sku === 'SFV-900SX')
        expect(goldenEntries).toHaveLength(24)
        expect(goldenEntries.filter(entry => entry.classification.action === 'REMOVE_CONFIRMED_HITA')).toHaveLength(10)
        expect(goldenEntries.filter(entry => entry.classification.action === 'REMOVE_UNVERIFIED_THIRD_PARTY')).toHaveLength(5)
        expect(golden).toContain('main: main — KEEP_EXISTING_BUNNY → KEEP — proposed KEEP_VERIFIED')
        expect(golden).not.toMatch(/gallery:310885:[^\n]+proposed KEEP_VERIFIED/)
    })

    it('keeps dashboard, bundle, export, duplicate propagation and totals exactly aligned', () => {
        const model = committedModel()
        const modelMedia = model.products.flatMap(product => product.media.map(media => ({ sku: product.sku, media })))
        const expectedCounts = { KEEP_VERIFIED: 9, REMOVE_CONFIRMED_HITA: 25, REMOVE_UNVERIFIED_THIRD_PARTY: 16, REPLACE_WITH_OFFICIAL: 110, HUMAN_REVIEW: 0 }
        expect(model.products).toHaveLength(20)
        expect(modelMedia).toHaveLength(160)
        expect(actionCounts(modelMedia.map(({ media }) => media.classification))).toEqual(expectedCounts)

        const bundle = bundleClassifications()
        expect(bundle).toHaveLength(160)
        expect(actionCounts(bundle.map(entry => ({ action: String(entry.classification.action) })))).toEqual(expectedCounts)
        const header = fs.readFileSync(path.join(process.cwd(), 'docs/review-bundles/leo-489-pilot-review.md'), 'utf8').match(/Media v2\.1 proposed actions: ([^\n]+)/)?.[1]
        expect(header).toContain('0 HUMAN_REVIEW')
        expect(header).toContain('9 KEEP_VERIFIED')
        expect(header).toContain('25 REMOVE_CONFIRMED_HITA')
        expect(header).toContain('16 REMOVE_UNVERIFIED_THIRD_PARTY')
        expect(header).toContain('110 REPLACE_WITH_OFFICIAL')

        const exported = JSON.parse(buildDeterministicReviewExport(model)) as { products: Array<{ sku: string; images: Array<{ sourceId: string; fingerprint: string; classification: Record<string, unknown> }> }> }
        const bundleByReference = new Map(bundle.map(entry => [`${entry.sku}:${entry.sourceId}`, entry.classification]))
        for (const { sku, media } of modelMedia) {
            const exportMedia = exported.products.find(product => product.sku === sku)?.images.find(image => image.sourceId === media.sourceId)
            expect(exportMedia?.classification).toEqual(media.classification)
            expect(bundleByReference.get(`${sku}:${media.sourceId}`)).toEqual(media.classification)
        }

        for (const product of model.products) {
            const byFingerprint = new Map<string, object>()
            for (const media of product.media) {
                const prior = byFingerprint.get(media.fingerprint)
                if (prior) expect(media.classification).toEqual(prior)
                byFingerprint.set(media.fingerprint, media.classification)
            }
        }
    })

    it('never classifies a main reference as a removal action', () => {
        const { packageValue, proposals } = fixturePackage()
        const model = createDashboardModel(packageValue, proposals, 'private')
        const mainActions = model.products.map((product) => product.media.find((media) => media.kind === 'main')?.classification.action)
        expect(mainActions).toHaveLength(20)
        expect(mainActions.every((action) => action === 'KEEP_VERIFIED' || action === 'REPLACE_WITH_OFFICIAL')).toBe(true)
    })

    it('keeps Hita unloaded in private mode and only exposes deterministic local exports', () => {
        const { packageValue, proposals } = fixturePackage()
        const model = createDashboardModel(packageValue, proposals, 'private')
        const html = renderDashboardHtml(model, 'private')
        expect(html).toContain('cdn.hita.com.vn')
        expect(html).not.toMatch(/<img[^>]+src="[^"]*hita\.com\.vn/i)
        const stateA = { products: { '2698': 'KEEP' }, images: { '2698:main': 'HUMAN_REVIEW' } }
        const stateB = { images: { '2698:main': 'HUMAN_REVIEW' }, products: { '2698': 'KEEP' } }
        expect(buildDeterministicReviewExport(model, stateA)).toBe(buildDeterministicReviewExport(model, stateB))
        expect(buildDeterministicReviewExport(model, stateA)).not.toMatch(/exportedAt|timestamp|https?:\/\//i)
    })
})
