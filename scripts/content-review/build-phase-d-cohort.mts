import fs from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { hashObject } = require('../../src/lib/content-review/hash') as typeof import('../../src/lib/content-review/hash')
const { POLICY_HASH, POLICY_CONTRACT } = require('../../src/lib/content-review/policy-contract') as typeof import('../../src/lib/content-review/policy-contract')
const { PHASE_D_CHECKPOINT_QUOTAS, PHASE_D_FAMILY_QUOTAS, phaseDSelectionHash, selectPhaseDCohort } = require('../../src/lib/content-review/phase-d-selection') as typeof import('../../src/lib/content-review/phase-d-selection')

const root = process.cwd()
const inputPath = path.join(root, 'scripts/content-review/private/leo-493-phase-c-inventory.json')
const publicPath = path.join(root, 'docs/review-bundles/leo-493-phase-d-cohort-manifest.json')
const privatePath = path.join(root, 'scripts/content-review/private/leo-493-phase-d-cohort.json')

type Input = { policyHash: string; snapshotHash: string; products: Parameters<typeof selectPhaseDCohort>[0] }

function publicRow(row: Input['products'][number], checkpoint: boolean) {
    return {
        id: row.id,
        sku: row.sku,
        brand: row.brand?.slug || null,
        category: row.category?.slug || null,
        updatedAt: row.updatedAt,
        descriptionHash: row.descriptionHash,
        visibleLength: row.visibleLength,
        embeddedCount: row.classification.embeddedCount,
        mediaRisk: row.classification.mediaRisk,
        family: row.classification.family,
        selectionReasons: row.selectionReasons,
        checkpoint,
    }
}

async function main() {
    const input = JSON.parse(await fs.readFile(inputPath, 'utf8')) as Input
    if (input.policyHash !== POLICY_HASH) throw new Error('Phase C policy hash mismatch')
    const final = selectPhaseDCohort(input.products, PHASE_D_FAMILY_QUOTAS, 240)
    const checkpoint = selectPhaseDCohort(final.selected, PHASE_D_CHECKPOINT_QUOTAS, 30)
    const checkpointIds = new Set(checkpoint.selected.map((row) => row.id))
    const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
    const cohortHash = phaseDSelectionHash(final)
    const checkpointHash = phaseDSelectionHash(checkpoint)
    const products = final.selected.map((row) => publicRow(row, checkpointIds.has(row.id)))
    const canonical = {
        schemaVersion: 1,
        artifact: 'leo-493-phase-d-cohort',
        contractVersion: POLICY_CONTRACT.version,
        policyHash: POLICY_HASH,
        snapshotHash: input.snapshotHash,
        proposalHash: null,
        sourceCommit,
        bindingStatus: 'COHORT_ONLY_NO_PROPOSAL',
        selectionAlgorithm: 'rewrite_important_only; unique_description_hash_groups_first; richer_visible_length_then_embedded_count; brand_coverage_priority; global_brand_cap_45_percent_when_qualified_alternatives_exist; deterministic_sku_id_tiebreak',
        familyQuotas: PHASE_D_FAMILY_QUOTAS,
        checkpointQuotas: PHASE_D_CHECKPOINT_QUOTAS,
        cohortHash,
        checkpointHash,
        counts: { cohort: final.selected.length, checkpoint: checkpoint.selected.length, eligibleRewriteImportant: input.products.filter((row) => row.classification.gate === 'REWRITE_IMPORTANT').length },
        cohortBrandCounts: final.brandCounts,
        cohortFamilyCounts: final.familyCounts,
        checkpointBrandCounts: checkpoint.brandCounts,
        checkpointFamilyCounts: checkpoint.familyCounts,
        products,
    }
    const manifestChecksum = hashObject(canonical)
    const privateProducts = final.selected.map((row) => ({ ...row, checkpoint: checkpointIds.has(row.id) })).sort((left, right) => left.id - right.id)
    const privateValue = { ...canonical, manifestChecksum, products: privateProducts }
    await fs.mkdir(path.dirname(publicPath), { recursive: true })
    await fs.writeFile(publicPath, `${JSON.stringify({ ...canonical, manifestChecksum }, null, 2)}\n`, 'utf8')
    await fs.writeFile(privatePath, `${JSON.stringify(privateValue, null, 2)}\n`, 'utf8')
    console.log(`PHASE_D_COHORT_PASS cohort=${final.selected.length} checkpoint=${checkpoint.selected.length} cohortHash=${cohortHash} checkpointHash=${checkpointHash} manifestChecksum=${manifestChecksum} sourceCommit=${sourceCommit}`)
}

main().catch((error) => { console.error(error instanceof Error ? error.message : 'Phase D cohort failed'); process.exitCode = 1 })
