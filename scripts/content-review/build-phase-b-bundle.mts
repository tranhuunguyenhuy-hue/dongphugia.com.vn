import fs from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { buildPhaseBPackage, buildPhaseBRecords, assertPhaseBPackageBinding, createPhaseBDashboardModel } = require('../../src/lib/content-review/phase-b.ts') as typeof import('../../src/lib/content-review/phase-b')
const { renderPhaseBDashboardHtml } = require('../../src/lib/content-review/phase-b-dashboard.ts') as typeof import('../../src/lib/content-review/phase-b-dashboard')
const { POLICY_HASH } = require('../../src/lib/content-review/policy-contract.ts') as typeof import('../../src/lib/content-review/policy-contract')
const { sha256 } = require('../../src/lib/content-review/hash.ts') as typeof import('../../src/lib/content-review/hash')
import type { PhaseBProductSnapshot } from '../../src/lib/content-review/phase-b'
import type { ProductContentInput } from '../../src/lib/content-review/types'

const root = process.cwd()
const snapshotPath = path.join(root, 'scripts/content-review/private/leo-493-pipeline-v3-1-snapshot.json')
const acceptedPath = path.join(root, 'scripts/content-review/private/leo-489-pilot-package.json')
const privatePackagePath = path.join(root, 'scripts/content-review/private/leo-493-phase-b-package.json')
const privateDashboardPath = path.join(root, 'scripts/content-review/private/leo-493-phase-b-dashboard.html')
const publicManifestPath = path.join(root, 'docs/review-bundles/leo-493-phase-b-proposal-manifest.json')
const publicDashboardPath = path.join(root, 'docs/review-bundles/leo-493-phase-b-dashboard.html')
const reportPath = path.join(root, 'docs/review-bundles/leo-493-phase-b-ground-truth.md')

type SnapshotFile = { policyHash: string; snapshotHash: string; sourceCommit: string; products: PhaseBProductSnapshot[] }
type AcceptedFile = { packageHash: string; records: Array<{ manifest: { id: number; sku: string }; input: ProductContentInput; generatedHtml: string }> }

function countBy(values: readonly string[]): Record<string, number> {
    return values.reduce<Record<string, number>>((result, value) => { result[value] = (result[value] || 0) + 1; return result }, {})
}

function tableRows(values: Record<string, number>): string {
    return Object.entries(values).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `| ${key} | ${value} |`).join('\n')
}

function assertOutputPolicy(packageValue: ReturnType<typeof buildPhaseBPackage>): void {
    if (packageValue.records.length !== 240 || packageValue.counts.media !== 562) throw new Error(`Unexpected Phase-B inventory: products=${packageValue.records.length}; media=${packageValue.counts.media}`)
    if (JSON.stringify(packageValue.records).includes('REPLACE_WITH_OFFICIAL')) throw new Error('Phase-B package contains a replacement placeholder')
    for (const record of packageValue.records) {
        const lower = record.generatedHtml.toLocaleLowerCase()
        if (lower.includes('hita.com.vn') || /\bhita\b/.test(lower)) throw new Error(`Hita branding/link found in generated prose for ${record.product.sku}`)
        for (const media of record.media) {
            if (media.currentDecision === 'REMOVE_HITA_SHOWROOM' && media.url && lower.includes(media.url.toLocaleLowerCase())) throw new Error(`Removed media appears in After for ${record.product.sku}:${media.sourceId}`)
            if (media.kind === 'embedded' && media.currentDecision !== 'REMOVE_HITA_SHOWROOM' && media.currentDecision !== 'HUMAN_REVIEW' && media.url && !lower.includes(media.url.toLocaleLowerCase())) throw new Error(`Kept embedded media is not placed in After for ${record.product.sku}:${media.sourceId}`)
        }
    }
}

async function main(): Promise<void> {
    const snapshot = JSON.parse(await fs.readFile(snapshotPath, 'utf8')) as SnapshotFile
    const accepted = JSON.parse(await fs.readFile(acceptedPath, 'utf8')) as AcceptedFile
    if (snapshot.policyHash !== POLICY_HASH) throw new Error('Snapshot policy hash does not match current v3.1 contract')
    const acceptedBySku = new Map(accepted.records.map(record => [record.manifest.sku, { html: record.generatedHtml, input: record.input }]))
    const sourceCommit = process.env.LEO_493_PHASE_B_SOURCE_COMMIT || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
    const records = buildPhaseBRecords(snapshot.products, acceptedBySku)
    const snapshotSkus = new Set(snapshot.products.map(product => product.sku))
    const acceptedRegression = accepted.records.map(record => ({
        id: record.manifest.id,
        sku: record.manifest.sku,
        afterDescriptionHash: sha256(record.generatedHtml),
        sourcePackageHash: accepted.packageHash,
        inSnapshot: snapshotSkus.has(record.manifest.sku),
    })).sort((a, b) => a.sku.localeCompare(b.sku))
    const packageValue = buildPhaseBPackage(records, POLICY_HASH, snapshot.snapshotHash, sourceCommit, acceptedRegression)
    assertPhaseBPackageBinding(packageValue, POLICY_HASH, snapshot.snapshotHash)
    assertOutputPolicy(packageValue)

    const privateModel = createPhaseBDashboardModel(packageValue, 'private')
    const publicModel = createPhaseBDashboardModel(packageValue, 'public')
    const publicManifest = {
        schemaVersion: packageValue.schemaVersion,
        source: packageValue.source,
        policyHash: packageValue.policyHash,
        snapshotHash: packageValue.snapshotHash,
        proposalHash: packageValue.proposalHash,
        packageHash: packageValue.packageHash,
        sourceCommit: packageValue.sourceCommit,
        counts: packageValue.counts,
        holdout: {
            total: packageValue.counts.holdout,
            humanLabeledAcceptedRegression: packageValue.records.filter(record => record.holdout && record.narrativeFamily === 'accepted-regression').length,
            pendingHumanLabel: packageValue.records.filter(record => record.holdout && record.narrativeFamily !== 'accepted-regression').length,
        },
        acceptedRegression: packageValue.acceptedRegression,
        products: packageValue.records.map(record => ({
            id: record.product.id,
            sku: record.product.sku,
            brand: record.product.brandSlug,
            category: record.product.categorySlug,
            updatedAt: record.product.updatedAt,
            beforeDescriptionHash: record.provenance.beforeDescriptionHash,
            afterDescriptionHash: record.provenance.afterDescriptionHash,
            mediaInventoryHash: record.provenance.mediaInventoryHash,
            mediaCount: record.media.length,
            mediaActions: countBy(record.media.map(media => media.currentDecision)),
            editorialReview: record.editorial.editorialReview,
            blockedReasons: record.blockedReasons,
            holdout: record.holdout,
        })).sort((a, b) => a.id - b.id),
    }
    const report = `# LEO-493 Phase B ground truth and first-pass report

Offline proposal-only package for the canonical 240-product snapshot. This report intentionally contains no raw HTML, live media URL, secret, private row or PII.

## Binding

- Policy contract: v3.1
- policyHash: \`${packageValue.policyHash}\`
- snapshotHash: \`${packageValue.snapshotHash}\`
- proposalHash: \`${packageValue.proposalHash}\`
- packageHash: \`${packageValue.packageHash}\`
- source commit used for generation: \`${packageValue.sourceCommit}\`
- products/media: **${packageValue.counts.products} / ${packageValue.counts.media}**

## Ground-truth holdout

The holdout is deterministic and stratified by accepted regression coverage plus the lowest-id Phase-B records. The ${publicManifest.holdout.humanLabeledAcceptedRegression} accepted-regression records overlapping the 240-row snapshot are coordinator/PM-accepted human labels; the remaining ${publicManifest.holdout.pendingHumanLabel} selected records are explicitly pending human label and are not treated as accepted. The full accepted pilot set is retained as ${packageValue.acceptedRegression.length} hash-bound references; ${packageValue.acceptedRegression.filter(item => !item.inSnapshot).length} are outside this INAX-only snapshot and are not regenerated in this package.

## Editorial first pass

| Result | Count |
|---|---:|
${tableRows(packageValue.counts.byEditorialReview)}

Products with any explicit blocker/review reason: **${packageValue.counts.blocked}**. Sparse source, unclear media and non-inline-safe embedded media remain visible review reasons; no reason is silently converted into approval.

## Media decisions

| Action | Count |
|---|---:|
${tableRows(packageValue.counts.byMediaAction)}

Confirmed showroom/store/display removals are the only XOÁ action. Unknown non-showroom media remain GIỮ TẠM with residual-risk evidence. No replacement placeholder or new description asset is generated.

## Split by category and risk

### Category

| Category | Products |
|---|---:|
${tableRows(packageValue.counts.byCategory)}

### Media risk

| Risk | Products |
|---|---:|
${tableRows(packageValue.counts.byRisk)}

## Safety and next action

- Existing embedded assets are retained in After when policy permits; confirmed showroom assets never appear in After.
- Accepted 20-product prose uses the stored accepted HTML unchanged after deterministic cleanup.
- No automatic Hita request/crawl/copy/rehost occurs; Bunny preview is private-dashboard only and Hita is manual one-asset view.
- This is a proposal package only. **Next action: independent coordinator review of the 240-product package and holdout before any later content phase.**
`
    await fs.mkdir(path.dirname(privatePackagePath), { recursive: true })
    await fs.mkdir(path.dirname(publicManifestPath), { recursive: true })
    await fs.writeFile(privatePackagePath, `${JSON.stringify(packageValue, null, 2)}\n`, 'utf8')
    await fs.writeFile(privateDashboardPath, renderPhaseBDashboardHtml(privateModel, 'private'), 'utf8')
    await fs.writeFile(publicManifestPath, `${JSON.stringify(publicManifest, null, 2)}\n`, 'utf8')
    await fs.writeFile(publicDashboardPath, renderPhaseBDashboardHtml(publicModel, 'public'), 'utf8')
    await fs.writeFile(reportPath, report, 'utf8')
    const publicText = `${JSON.stringify(publicManifest)}${renderPhaseBDashboardHtml(publicModel, 'public')}${report}`
    if (/REPLACE_WITH_OFFICIAL|https?:\/\/|<script\s+src=|rawSnapshot|descriptionHtml\s*:/i.test(publicText)) throw new Error('Public Phase-B artifact contains a prohibited URL/raw field')
    console.log(JSON.stringify({ products: packageValue.counts.products, media: packageValue.counts.media, policyHash: packageValue.policyHash, snapshotHash: packageValue.snapshotHash, proposalHash: packageValue.proposalHash, packageHash: packageValue.packageHash, sourceCommit: packageValue.sourceCommit, byBrand: packageValue.counts.byBrand, byCategory: packageValue.counts.byCategory, byRisk: packageValue.counts.byRisk, byMediaAction: packageValue.counts.byMediaAction, byEditorialReview: packageValue.counts.byEditorialReview, holdout: publicManifest.holdout, blocked: packageValue.counts.blocked, publicManifestSha256: sha256(JSON.stringify(publicManifest)), publicDashboardSha256: sha256(renderPhaseBDashboardHtml(publicModel, 'public')), reportSha256: sha256(report), databaseWrites: false, remoteFetches: false }))
}

main().catch(error => { console.error(error instanceof Error ? error.message : 'Phase-B bundle failed'); process.exitCode = 1 })
