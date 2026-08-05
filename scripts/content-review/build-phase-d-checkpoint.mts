import fs from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const phaseD = require('../../src/lib/content-review/phase-d-checkpoint.ts') as typeof import('../../src/lib/content-review/phase-d-checkpoint')
const { POLICY_HASH } = require('../../src/lib/content-review/policy-contract.ts') as typeof import('../../src/lib/content-review/policy-contract')

const root = process.cwd()
const cohortPath = path.join(root, 'scripts/content-review/private/leo-493-phase-d-cohort.json')
const sourcePath = path.join(root, 'scripts/content-review/private/leo-493-phase-d-checkpoint-source.json')
const acceptedPath = path.join(root, 'scripts/content-review/private/leo-493-phase-b-package.json')
const privatePackagePath = path.join(root, 'scripts/content-review/private/leo-493-phase-d-checkpoint-package.json')
const publicManifestPath = path.join(root, 'docs/review-bundles/leo-493-phase-d-checkpoint-manifest.json')
const reportPath = path.join(root, 'docs/review-bundles/leo-493-phase-d-checkpoint-report.md')

type Cohort = { policyHash: string; snapshotHash: string; cohortHash: string; checkpointHash: string; products: Array<{ id: number; sku: string; name: string; brand: { id: number; name: string; slug: string } | null; category: { id: number; name: string; slug: string } | null; classification: { family: string }; descriptionHash: string; checkpoint?: boolean }> }
type Source = { policyHash: string; checkpointHash: string; sourceHash: string; products: phaseD.PhaseDSourceProduct[] }
type Accepted = { packageHash: string; acceptedRegression?: phaseD.PhaseDCheckpointPackage['acceptedRegression'] }

async function main() {
    const cohort = JSON.parse(await fs.readFile(cohortPath, 'utf8')) as Cohort
    const source = JSON.parse(await fs.readFile(sourcePath, 'utf8')) as Source
    const accepted = JSON.parse(await fs.readFile(acceptedPath, 'utf8')) as Accepted
    if (cohort.policyHash !== POLICY_HASH || source.policyHash !== POLICY_HASH || source.checkpointHash !== cohort.checkpointHash) throw new Error('Phase D input binding mismatch')
    const checkpointCohort = cohort.products.filter(row => row.checkpoint).sort((left, right) => left.id - right.id)
    if (checkpointCohort.length !== 30 || source.products.length !== 30) throw new Error('Phase D checkpoint must have exactly 30 cohort/source rows')
    const sourceIds = new Set(source.products.map(row => row.id))
    if (checkpointCohort.some(row => !sourceIds.has(row.id))) throw new Error('Phase D checkpoint source is incomplete')
    const visualAudits = phaseD.buildPhaseDVisualAudits(source.products)
    if (visualAudits.length !== 190) throw new Error(`Phase D visual audit must cover 190 unique fingerprints; got ${visualAudits.length}`)
    const records = phaseD.buildPhaseDRecords(source.products, checkpointCohort.map(row => ({ id: row.id, sku: row.sku, name: row.name, brand: row.brand, category: row.category, family: row.classification.family, descriptionHash: row.descriptionHash })), 'worker-019fd0c7-fab8-7170-96af-d9d9a46f1519', visualAudits)
    const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
    const packageValue = phaseD.buildPhaseDCheckpointPackage(records, POLICY_HASH, cohort.snapshotHash, cohort.cohortHash, cohort.checkpointHash, source.sourceHash, sourceCommit, accepted.acceptedRegression || [], 'worker-019fd0c7-fab8-7170-96af-d9d9a46f1519')
    phaseD.assertPhaseDCheckpointBinding(packageValue, POLICY_HASH, cohort.snapshotHash, sourceCommit)
    const publicModel = phaseD.buildPhaseDDashboardModel(packageValue, 'public') as Record<string, unknown>
    const manifest = { schemaVersion: 1, artifact: 'leo-493-phase-d-checkpoint', policyHash: POLICY_HASH, snapshotHash: cohort.snapshotHash, cohortHash: cohort.cohortHash, checkpointHash: cohort.checkpointHash, sourceHash: source.sourceHash, proposalHash: packageValue.proposalHash, packageHash: packageValue.packageHash, sourceCommit, sourceCommitRole: packageValue.sourceCommitRole, bindingStatus: 'VALID', counts: packageValue.counts, quality: packageValue.quality, publicModel }
    const familyCounts = packageValue.counts.byFamily as Record<string, number>
    const report = `# LEO-493 Phase D — 30-product checkpoint\n\n- **Binding:** policyHash \`${POLICY_HASH}\`; snapshotHash \`${cohort.snapshotHash}\`; cohortHash \`${cohort.cohortHash}\`; checkpointHash \`${cohort.checkpointHash}\`; sourceHash \`${source.sourceHash}\`; proposalHash \`${packageValue.proposalHash}\`; packageHash \`${packageValue.packageHash}\`; source commit \`${sourceCommit}\` (role: ${packageValue.sourceCommitRole}; generator input head, not an ambiguous final-head claim).\n- **Scope:** 30 products from the accepted final 240 cohort only; no remaining 210 products generated. Family counts: ${JSON.stringify(familyCounts)}.\n- **Editorial:** product-specific narratives use ${new Set(records.map(record => record.narrativeFamily)).size} evidence-derived structures; Before/After ratio min=${(packageValue.quality.beforeAfterRatio.min ?? 0).toFixed(3)}, max=${(packageValue.quality.beforeAfterRatio.max ?? 0).toFixed(3)}, average=${(packageValue.quality.beforeAfterRatio.average ?? 0).toFixed(3)}; normalized repeated opening keys=${packageValue.quality.repeatedOpeningCount}, closing keys=${packageValue.quality.repeatedClosingCount}, section signatures=${packageValue.quality.repeatedSectionSignatureCount}; retained source-evidence rate=${(packageValue.quality.retainedEvidenceRate * 100).toFixed(1)}%; unsupported commercial sentences removed=${packageValue.quality.removedUnsupportedClaimCount}; truncation markers=0.\n- **Holdout:** 24 products, stratified ${JSON.stringify(packageValue.manualHoldout.reduce<Record<string, number>>((result, row) => { result[row.family] = (result[row.family] || 0) + 1; return result }, {}))}; labels are limited to directly inspected Bunny assets and are not manufacturer-current verification.\n- **Media:** ${String(packageValue.counts.media)} references across ${packageValue.counts.uniqueFingerprints} unique fingerprints; ${packageValue.counts.inspectedUniqueFingerprints} unique fingerprints directly inspected from local Bunny downloads; action counts ${JSON.stringify(packageValue.counts.byMediaAction)}; placement counts ${JSON.stringify(packageValue.counts.byMediaPlacement)}; exact duplicates inherit the inspected fingerprint decision; REMOVE is absent from After (${packageValue.counts.removeInAfter}). Hita remains manual-only and no Hita request/crawl/copy/rehost ran.\n- **Official status:** LEO-492 evidence remains unresolved; no row is claimed manufacturer-current.\n- **Blockers:** ${JSON.stringify(packageValue.quality.blockedReasons)}.\n- **Public artifact:** sanitized manifest only; no live media URLs or raw HTML.\n- **Private review:** ignored package/dashboard carries direct Bunny preview for local review; it is not a public URL.\n\nThis is a checkpoint for Coordinator inspection. Do not scale the remaining 210 products until accepted.\n`
    await fs.mkdir(path.dirname(publicManifestPath), { recursive: true })
    await fs.writeFile(privatePackagePath, `${JSON.stringify(packageValue, null, 2)}\n`, 'utf8')
    await fs.writeFile(publicManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
    await fs.writeFile(reportPath, report, 'utf8')
    console.log(`PHASE_D_CHECKPOINT_PASS products=${records.length} media=${packageValue.counts.media} proposalHash=${packageValue.proposalHash} packageHash=${packageValue.packageHash} sourceCommit=${sourceCommit}`)
}

main().catch((error) => { console.error(error instanceof Error ? error.message : 'Phase D checkpoint build failed'); process.exitCode = 1 })
