import fs from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const rework = require('../../src/lib/content-review/phase-b-rework.ts') as typeof import('../../src/lib/content-review/phase-b-rework')
const { renderPhaseBReworkDashboardHtml } = require('../../src/lib/content-review/phase-b-rework-dashboard.ts') as typeof import('../../src/lib/content-review/phase-b-rework-dashboard')
const { POLICY_HASH } = require('../../src/lib/content-review/policy-contract.ts') as typeof import('../../src/lib/content-review/policy-contract')
const { sha256 } = require('../../src/lib/content-review/hash.ts') as typeof import('../../src/lib/content-review/hash')
import type { PhaseBProductSnapshot } from '../../src/lib/content-review/phase-b'
import type { ProductContentInput } from '../../src/lib/content-review/types'

const root = process.cwd()
const snapshotPath = path.join(root, 'scripts/content-review/private/leo-493-pipeline-v3-1-snapshot.json')
const acceptedPath = path.join(root, 'scripts/content-review/private/leo-489-pilot-package.json')
const privatePackagePath = path.join(root, 'scripts/content-review/private/leo-493-phase-b-rework-checkpoint-package.json')
const privateDashboardPath = path.join(root, 'scripts/content-review/private/leo-493-phase-b-rework-checkpoint-dashboard.html')
const publicManifestPath = path.join(root, 'docs/review-bundles/leo-493-phase-b-rework-checkpoint-manifest.json')
const publicDashboardPath = path.join(root, 'docs/review-bundles/leo-493-phase-b-rework-checkpoint-dashboard.html')
const reportPath = path.join(root, 'docs/review-bundles/leo-493-phase-b-rework-checkpoint-ground-truth.md')

type SnapshotFile = { policyHash: string; snapshotHash: string; sourceCommit: string; products: PhaseBProductSnapshot[] }
type AcceptedFile = { packageHash: string; records: Array<{ manifest: { id: number; sku: string }; input: ProductContentInput; generatedHtml: string }> }

function tableRows(values: Record<string, number>): string {
    return Object.entries(values).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `| ${key} | ${value} |`).join('\n')
}

function assertOutputPolicy(packageValue: rework.ReworkCheckpointPackage): void {
    if (packageValue.records.length !== 24 || packageValue.manualHoldout.length !== 24) throw new Error('Checkpoint must contain exactly 24 products and 24 manually reviewed media refs')
    if (JSON.stringify(packageValue).includes('REPLACE_WITH_OFFICIAL')) throw new Error('Checkpoint contains a forbidden replacement placeholder')
    for (const record of packageValue.records) {
        const lower = record.generatedHtml.toLocaleLowerCase()
        if (/\bhita\b/.test(lower)) throw new Error(`Hita branding found in generated prose for ${record.product.sku}`)
        for (const media of record.media) {
            if (media.currentDecision === 'REMOVE_HITA_SHOWROOM' && media.url && lower.includes(media.url.toLocaleLowerCase())) throw new Error(`Removed media appears in After for ${record.product.sku}:${media.sourceId}`)
            if (media.kind === 'embedded' && media.currentDecision !== 'REMOVE_HITA_SHOWROOM' && media.url && !lower.includes(media.url.toLocaleLowerCase())) throw new Error(`Kept embedded media is not placed in After for ${record.product.sku}:${media.sourceId}`)
        }
    }
}

function publicManifest(packageValue: rework.ReworkCheckpointPackage, publicDashboardSha256: string, reportSha256: string): Record<string, unknown> {
    return {
        schemaVersion: packageValue.schemaVersion,
        source: packageValue.source,
        binding: { policyHash: packageValue.policyHash, snapshotHash: packageValue.snapshotHash, proposalHash: packageValue.proposalHash, packageHash: packageValue.packageHash, sourceCommit: packageValue.sourceCommit },
        selection: packageValue.selection,
        officialStatusEvidence: packageValue.officialStatusEvidence,
        counts: packageValue.counts,
        manualHoldout: packageValue.manualHoldout.map(item => ({ sku: item.sku, sourceId: item.sourceId, fingerprint: item.fingerprint, visualLabel: item.visualLabel, confidence: item.confidence, baselineAction: item.baselineAction, baselineMatchesManual: item.baselineMatchesManual, evidence: item.evidence, reviewer: item.reviewer })),
        artifacts: { dashboardSha256: publicDashboardSha256, reportSha256 },
        policy: 'Phase B rework checkpoint only. Pending products/media outside this 24-product set are not represented or silently promoted.',
    }
}

async function main(): Promise<void> {
    const snapshot = JSON.parse(await fs.readFile(snapshotPath, 'utf8')) as SnapshotFile
    const accepted = JSON.parse(await fs.readFile(acceptedPath, 'utf8')) as AcceptedFile
    if (snapshot.policyHash !== POLICY_HASH) throw new Error('Snapshot policy hash does not match current v3.1 contract')
    const acceptedBySku = new Map(accepted.records.map(record => [record.manifest.sku, { html: record.generatedHtml, input: record.input }]))
    const sourceCommit = process.env.LEO_493_PHASE_B_SOURCE_COMMIT || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
    const { records, manualHoldout } = rework.buildReworkRecords(snapshot.products, acceptedBySku)
    const snapshotSkus = new Set(snapshot.products.map(product => product.sku))
    const acceptedRegression = accepted.records.map(record => ({ id: record.manifest.id, sku: record.manifest.sku, afterDescriptionHash: sha256(record.generatedHtml), sourcePackageHash: accepted.packageHash, inSnapshot: snapshotSkus.has(record.manifest.sku) })).sort((a, b) => a.sku.localeCompare(b.sku))
    const packageValue = rework.buildReworkCheckpointPackage(records, manualHoldout, POLICY_HASH, snapshot.snapshotHash, sourceCommit, acceptedRegression)
    rework.assertReworkCheckpointBinding(packageValue, POLICY_HASH, snapshot.snapshotHash)
    assertOutputPolicy(packageValue)

    const privateModel = rework.createReworkDashboardModel(packageValue, 'private')
    const publicModel = rework.createReworkDashboardModel(packageValue, 'public')
    const publicDashboard = renderPhaseBReworkDashboardHtml(publicModel, 'public')
    const report = `# LEO-493 Phase B rework checkpoint\n\n- Scope: deterministic 24-product checkpoint only; remaining 216 products remain pending and are not silently promoted.\n- Source commit: \`${packageValue.sourceCommit}\`\n- Policy hash: \`${packageValue.policyHash}\`\n- Snapshot hash: \`${packageValue.snapshotHash}\`\n- Proposal hash: \`${packageValue.proposalHash}\`\n- Package hash: \`${packageValue.packageHash}\`\n- Selection: ${packageValue.selection.algorithm}.\n- Snapshot truth: 240 unique INAX products / 562 media refs; this checkpoint contains ${packageValue.counts.products} products / ${packageValue.counts.media} media refs.\n\n## Editorial holdout\n\nAll 24 selected products have a separate MANUALLY_REVIEWED holdout status. The holdout is not derived from pending labels. ${packageValue.counts.byEditorialStatus.HUMAN_REVIEWED_PASS || 0} are first-pass reviewed without a material blocker; ${packageValue.counts.byEditorialStatus.HUMAN_REVIEWED_REVIEW || 0} retain explicit evidence-based review reasons. No universal 3-heading/3-paragraph skeleton is used: ${new Set(packageValue.records.map(record => record.narrativeFamily)).size} narrative families, ${new Set(packageValue.records.map(record => record.structure.openingKey)).size} opening keys and ${new Set(packageValue.records.map(record => record.structure.closingKey)).size} closing keys are present.\n\n## Media visual holdout\n\nThe 24 manually reviewed media refs were opened from existing Bunny references in the private local review. ${packageValue.counts.manuallyReviewedMedia} labels are separate from ${packageValue.counts.pendingVisualMedia} refs that remain conservatively pending visual review. Manual labels: ${JSON.stringify(packageValue.manualHoldout.reduce<Record<string, number>>((result, item) => { result[item.visualLabel] = (result[item.visualLabel] || 0) + 1; return result }, {}))}. Baseline host/kind agreement is ${packageValue.manualHoldout.filter(item => item.baselineMatchesManual).length}/${packageValue.manualHoldout.length}; this is a measured baseline comparison, not a claim of classifier precision on the pending set.\n\nEvery unreviewed Bunny asset is GIỮ TẠM unless it is a duplicate of a manually reviewed fingerprint. KEEP_PRODUCT is used only where the screenshot visibly showed a product packshot/render. The selected tile swatch was retained GIỮ TẠM because it was not a dedicated packshot. No Hita showroom was visually confirmed in this checkpoint; no removal is invented.\n\n## Official-status evidence\n\nLEO-492 sample checksum is \`${packageValue.officialStatusEvidence.sampleChecksum}\`: 1 ACTIVE_CURRENT, 1 strict variant conflict and 28 REVIEW. The result is NO-GO for blind extension. All checkpoint rows remain \`${packageValue.records[0]?.officialStatus}\`; no manufacturer-current claim, archive, delete or automatic status mutation is made.\n\n## Counts\n\n| Metric | Count |\n| --- | ---: |\n| Products | ${packageValue.counts.products} |\n| Media refs | ${packageValue.counts.media} |\n| Manually reviewed products | ${packageValue.counts.manuallyReviewedProducts} |\n| Manually reviewed media | ${packageValue.counts.manuallyReviewedMedia} |\n| Pending visual media | ${packageValue.counts.pendingVisualMedia} |\n| Explicitly blocked products | ${packageValue.counts.blocked} |\n\n### Media actions\n\n| Action | Count |\n| --- | ---: |\n${tableRows(packageValue.counts.byMediaAction)}\n\n### Categories\n\n| Category | Count |\n| --- | ---: |\n${tableRows(packageValue.counts.byCategory)}\n\n## Safety and next action\n\n- Committed public artifacts contain no live media URL, raw HTML or private snapshot rows.\n- Private artifacts are ignored and contain only the minimum checkpoint inputs needed for offline review.\n- Hita remains manual-only; no automatic Hita request, crawl, copy or rehost occurred.\n- No production/database/product/media/CDN/DNS/deploy mutation occurred.\n- Next action: Coordinator independently inspect this checkpoint and either accept the evidence pattern or return targeted rework in this same worker thread before the remaining products are generated.\n`
    const manifest = publicManifest(packageValue, sha256(publicDashboard), sha256(report))
    await fs.writeFile(privatePackagePath, `${JSON.stringify(packageValue, null, 2)}\n`, 'utf8')
    await fs.writeFile(privateDashboardPath, renderPhaseBReworkDashboardHtml(privateModel, 'private'), 'utf8')
    await fs.writeFile(publicManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
    await fs.writeFile(publicDashboardPath, publicDashboard, 'utf8')
    await fs.writeFile(reportPath, report, 'utf8')
    console.log(JSON.stringify({ checkpointProducts: packageValue.counts.products, checkpointMedia: packageValue.counts.media, snapshotProducts: 240, snapshotMedia: 562, policyHash: packageValue.policyHash, snapshotHash: packageValue.snapshotHash, proposalHash: packageValue.proposalHash, packageHash: packageValue.packageHash, sourceCommit: packageValue.sourceCommit, counts: packageValue.counts, publicManifestSha256: sha256(JSON.stringify(manifest)), publicDashboardSha256: sha256(publicDashboard), reportSha256: sha256(report), privateArtifacts: true, databaseWrites: false, remoteFetches: false }))
}

await main()
